"use client";

import { useEffect, useState } from "react";
import type { ResourceItem } from "@/lib/dataFetcher";
import { isCatalogNetworkFailure, requestCampusHop } from "@/lib/siteOrigins";
import { useAcademicStore } from "@/store/academicStore";

export type WorkspaceResourcesState = {
  resources: ResourceItem[];
  subjects: string[];
  syllabusUrl: string | null;
  loading: boolean;
  error: string | null;
  academicYear: string;
  branch: string;
  semester: number;
};

type CacheEntry = {
  resources: ResourceItem[];
  subjects: string[];
  syllabusUrl: string | null;
  savedAt?: number;
};

const MEMORY_TTL_MS = 1000 * 60 * 60; // 1h in-tab
const STORAGE_TTL_MS = 1000 * 60 * 60 * 12; // 12h across reloads
const STORAGE_PREFIX = "utility.workspace.v2:";

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CacheEntry>>();

function cacheKey(year: string, branch: string, semester: number): string {
  // v2: list API returns dedicated syllabusUrl (Syllabus subject is excluded from vault files)
  return `v2:${year}:${branch}:${semester}`;
}

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function isFresh(entry: CacheEntry | undefined, ttl: number): entry is CacheEntry {
  if (!entry?.savedAt) return false;
  return Date.now() - entry.savedAt < ttl;
}

function readSession(key: string): CacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!isFresh(parsed, STORAGE_TTL_MS)) {
      sessionStorage.removeItem(storageKey(key));
      return null;
    }
    if (!Array.isArray(parsed.resources)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(key: string, entry: CacheEntry) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // quota / private mode — ignore
  }
}

function deriveSubjects(resources: ResourceItem[]): string[] {
  return Array.from(
    new Set(
      resources
        .map((r) => r.subject_name)
        .filter((name): name is string => typeof name === "string" && name.length > 0),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function deriveSyllabusUrlFromResources(
  resources: ResourceItem[],
): string | null {
  const hit = resources.find((r) => {
    const t = r.title.toLowerCase();
    const subject = (r.subject_name || "").toLowerCase();
    return (
      (subject === "syllabus" || t.includes("syllabus")) &&
      !t.includes("notes")
    );
  });
  return hit?.file_url ?? null;
}

function getCachedEntry(key: string): CacheEntry | null {
  const mem = cache.get(key);
  if (isFresh(mem, MEMORY_TTL_MS)) return mem;
  const session = readSession(key);
  if (session) {
    cache.set(key, session);
    return session;
  }
  return null;
}

async function loadWorkspace(
  academicYear: string,
  branch: string,
  semester: number,
): Promise<CacheEntry> {
  const key = cacheKey(academicYear, branch, semester);
  const hit = getCachedEntry(key);
  if (hit) return hit;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    let res: Response;
    try {
      res = await fetch(
        `/api/resources/list?year=${encodeURIComponent(academicYear)}&branch=${encodeURIComponent(branch)}&semester=${semester}`,
      );
    } catch (error) {
      if (isCatalogNetworkFailure(error)) requestCampusHop();
      throw error;
    }
    if (!res.ok) throw new Error("Failed to load resources");
    const data = await res.json();
    const resources: ResourceItem[] = Array.isArray(data.resources)
      ? data.resources
      : [];
    // Prefer dedicated Firestore Syllabus subject URL (excluded from the vault list).
    const syllabusUrl =
      (typeof data.syllabusUrl === "string" && data.syllabusUrl) ||
      deriveSyllabusUrlFromResources(resources);
    const entry: CacheEntry = {
      resources,
      subjects: deriveSubjects(resources),
      syllabusUrl,
      savedAt: Date.now(),
    };
    cache.set(key, entry);
    writeSession(key, entry);
    return entry;
  })().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

/** Client-side workspace catalog with module-level cache (shared across Resources/Ask/Syllabus). */
export async function loadWorkspaceResources(
  academicYear: string,
  branch: string,
  semester: number,
): Promise<CacheEntry> {
  return loadWorkspace(academicYear, branch, semester);
}

export function clearWorkspaceResourcesCache(
  academicYear: string,
  branch: string,
  semester: number,
): void {
  const key = cacheKey(academicYear, branch, semester);
  cache.delete(key);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(storageKey(key));
    } catch {
      // ignore
    }
  }
}

export function useWorkspaceResources(): WorkspaceResourcesState & {
  retry: () => void;
} {
  const { academicYear, branch, semester } = useAcademicStore();
  const key = cacheKey(academicYear, branch, semester);

  const [resources, setResources] = useState<ResourceItem[]>(
    () => getCachedEntry(key)?.resources ?? [],
  );
  const [subjects, setSubjects] = useState<string[]>(
    () => getCachedEntry(key)?.subjects ?? [],
  );
  const [syllabusUrl, setSyllabusUrl] = useState<string | null>(
    () => getCachedEntry(key)?.syllabusUrl ?? null,
  );
  const [loading, setLoading] = useState(() => !getCachedEntry(key));
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const [prevKey, setPrevKey] = useState(key);
  if (prevKey !== key) {
    setPrevKey(key);
    const hit = getCachedEntry(key);
    if (hit) {
      setResources(hit.resources);
      setSubjects(hit.subjects);
      setSyllabusUrl(hit.syllabusUrl);
      setLoading(false);
      setError(null);
    } else {
      setResources([]);
      setSubjects([]);
      setSyllabusUrl(null);
      setLoading(true);
      setError(null);
    }
  }

  useEffect(() => {
    // Cache hits are applied during render via the prevKey pattern above.
    // retry() deletes the cache entry before bumping retryNonce.
    if (getCachedEntry(key)) return;

    let cancelled = false;
    loadWorkspace(academicYear, branch, semester)
      .then((entry) => {
        if (cancelled) return;
        setResources(entry.resources);
        setSubjects(entry.subjects);
        setSyllabusUrl(entry.syllabusUrl);
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [key, academicYear, branch, semester, retryNonce]);

  const retry = () => {
    clearWorkspaceResourcesCache(academicYear, branch, semester);
    setError(null);
    setLoading(true);
    setRetryNonce((n) => n + 1);
  };

  return {
    resources,
    subjects,
    syllabusUrl,
    loading,
    error,
    academicYear,
    branch,
    semester,
    retry,
  };
}
