import type { ResourceItem } from "@/lib/dataFetcher";

const STORAGE_KEY = "utility_recent_resources";
const MAX_RECENT = 12;

export type RecentResource = {
  id: string;
  title: string;
  subject_name: string;
  category: string;
  file_url: string;
  academic_year?: string;
  branch?: string;
  semester?: number;
  page?: number;
  viewedAt: number;
};

function readAll(): RecentResource[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: RecentResource[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_RECENT)));
  } catch {
    // quota / private mode
  }
}

export function getRecentResources(): RecentResource[] {
  return readAll().sort((a, b) => b.viewedAt - a.viewedAt);
}

export function pushRecentResource(
  item: Pick<ResourceItem, "id" | "title" | "subject_name" | "category" | "file_url">,
  scope?: { academicYear?: string; branch?: string; semester?: number; page?: number | null },
): RecentResource[] {
  const prev = readAll().find((r) => r.id === item.id);
  const page = scope?.page && scope.page > 0 ? Math.floor(scope.page) : prev?.page;
  const next: RecentResource = {
    id: item.id,
    title: item.title,
    subject_name: item.subject_name,
    category: item.category,
    file_url: item.file_url,
    academic_year: scope?.academicYear,
    branch: scope?.branch,
    semester: scope?.semester,
    page,
    viewedAt: Date.now(),
  };
  const filtered = readAll().filter((r) => r.id !== item.id);
  const list = [next, ...filtered].slice(0, MAX_RECENT);
  writeAll(list);
  return list;
}

/** Keep the last PDF page on the most recent open of this file. */
export function updateRecentPage(id: string, page: number): void {
  if (!id || !(page > 0)) return;
  const all = readAll();
  const idx = all.findIndex((r) => r.id === id);
  if (idx < 0) return;
  all[idx] = { ...all[idx], page: Math.floor(page) };
  writeAll(all);
}

export { STORAGE_KEY as RECENT_RESOURCES_KEY };
