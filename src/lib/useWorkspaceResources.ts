"use client";

import { useEffect, useState } from "react";
import type { ResourceItem } from "@/lib/dataFetcher";
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
  /** Server workspace_catalogs.updated_at — used to detect Drive syncs. */
  updatedAt: string | null;
  savedAt?: number;
};

/** Soft paint cache only; network always revalidates in the background. */
const STORAGE_TTL_MS = 1000 * 60 * 30;
const STORAGE_PREFIX = "utility.workspace.v6:";

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CacheEntry>>();

function cacheKey(year: string, branch: string, semester: number): string {
  return `v6:${year}:${branch}:${semester}`;
}

function storageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function isFresh(entry: CacheEntry | undefined, ttl: number): entry is CacheEntry {
  if (!entry?.savedAt) return false;
  return Date.now() - entry.savedAt < ttl;
}

function readStored(storage: Storage, key: string): CacheEntry | null {
  try {
    const raw = storage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!isFresh(parsed, STORAGE_TTL_MS)) {
      storage.removeItem(storageKey(key));
      return null;
    }
    if (!Array.isArray(parsed.resources) || parsed.resources.length === 0) {
      storage.removeItem(storageKey(key));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function readSession(key: string): CacheEntry | null {
  if (typeof window === "undefined") return null;
  return readStored(sessionStorage, key) ?? readStored(localStorage, key);
}

function writeSession(key: string, entry: CacheEntry) {
  if (typeof window === "undefined") return;
  if (entry.resources.length === 0) return;
  const raw = JSON.stringify(entry);
  try {
    sessionStorage.setItem(storageKey(key), raw);
  } catch {
    // quota / private mode — ignore
  }
  try {
    localStorage.setItem(storageKey(key), raw);
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
  if (mem && mem.resources.length > 0) return mem;
  const session = readSession(key);
  if (session) {
    cache.set(key, session);
    return session;
  }
  return null;
}

/** Exported for unit tests — Drive sync must replace painted cache entries. */
export function catalogChanged(
  prev: Pick<CacheEntry, "resources" | "syllabusUrl" | "updatedAt"> | null,
  next: Pick<CacheEntry, "resources" | "syllabusUrl" | "updatedAt">,
): boolean {
  if (!prev) return true;
  if (prev.updatedAt && next.updatedAt && prev.updatedAt !== next.updatedAt) {
    return true;
  }
  if (prev.resources.length !== next.resources.length) return true;
  if (prev.syllabusUrl !== next.syllabusUrl) return true;
  return false;
}

async function fetchWorkspaceFromNetwork(
  academicYear: string,
  branch: string,
  semester: number,
): Promise<CacheEntry> {
  const key = cacheKey(academicYear, branch, semester);
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    // No fixed ?v= bump — uploads revalidate server tags; client always
    // revalidates in the background and compares updatedAt.
    const res = await fetch(
      `/api/resources/list?year=${encodeURIComponent(academicYear)}&branch=${encodeURIComponent(branch)}&semester=${semester}`,
    );
    if (!res.ok) throw new Error("Failed to load resources");
    const data = await res.json();
    const resources: ResourceItem[] = Array.isArray(data.resources)
      ? data.resources
      : [];
    const syllabusUrl =
      (typeof data.syllabusUrl === "string" && data.syllabusUrl) ||
      deriveSyllabusUrlFromResources(resources);
    const updatedAt =
      typeof data.updatedAt === "string" && data.updatedAt
        ? data.updatedAt
        : res.headers.get("X-Catalog-Updated-At");
    const entry: CacheEntry = {
      resources,
      subjects: deriveSubjects(resources),
      syllabusUrl,
      updatedAt,
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
  // Prefer a fresh network read so command palette / one-shots see uploads.
  return fetchWorkspaceFromNetwork(academicYear, branch, semester);
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
      localStorage.removeItem(storageKey(key));
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
    let cancelled = false;
    const painted = getCachedEntry(key);

    // Stale-while-revalidate: paint cache immediately, always hit the network
    // so Drive uploads appear without bumping a manual ?v= cache key.
    fetchWorkspaceFromNetwork(academicYear, branch, semester)
      .then((entry) => {
        if (cancelled) return;
        if (catalogChanged(painted, entry) || !painted) {
          setResources(entry.resources);
          setSubjects(entry.subjects);
          setSyllabusUrl(entry.syllabusUrl);
        }
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        if (!painted) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
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
