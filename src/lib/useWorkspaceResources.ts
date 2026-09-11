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
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CacheEntry>>();

function cacheKey(year: string, branch: string, semester: number): string {
  // v2: list API returns dedicated syllabusUrl (Syllabus subject is excluded from vault files)
  return `v2:${year}:${branch}:${semester}`;
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

async function loadWorkspace(
  academicYear: string,
  branch: string,
  semester: number,
): Promise<CacheEntry> {
  const key = cacheKey(academicYear, branch, semester);
  const hit = cache.get(key);
  if (hit) return hit;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const res = await fetch(
      `/api/resources/list?year=${encodeURIComponent(academicYear)}&branch=${encodeURIComponent(branch)}&semester=${semester}`,
    );
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
    };
    cache.set(key, entry);
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
  cache.delete(cacheKey(academicYear, branch, semester));
}

export function useWorkspaceResources(): WorkspaceResourcesState & {
  retry: () => void;
} {
  const { academicYear, branch, semester } = useAcademicStore();
  const key = cacheKey(academicYear, branch, semester);

  const [resources, setResources] = useState<ResourceItem[]>(
    () => cache.get(key)?.resources ?? [],
  );
  const [subjects, setSubjects] = useState<string[]>(
    () => cache.get(key)?.subjects ?? [],
  );
  const [syllabusUrl, setSyllabusUrl] = useState<string | null>(
    () => cache.get(key)?.syllabusUrl ?? null,
  );
  const [loading, setLoading] = useState(() => !cache.has(key));
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const [prevKey, setPrevKey] = useState(key);
  if (prevKey !== key) {
    setPrevKey(key);
    const hit = cache.get(key);
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
    if (cache.has(key)) return;

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
    cache.delete(key);
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
