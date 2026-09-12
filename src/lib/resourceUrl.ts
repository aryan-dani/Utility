import { ResourceCategory } from "@/lib/dataFetcher";

export type ResourceFilter = "all" | "social" | ResourceCategory;

const FILTER_VALUES = new Set<string>([
  "all",
  "social",
  "notes",
  "question-bank",
  "solved-question-bank",
  "ppt",
  "pyq",
  "writeup",
  "codes",
  "other",
]);

export function parseResourceFilter(
  value: string | null | undefined,
): ResourceFilter {
  if (!value) return "all";
  const normalized = value.toLowerCase();
  return FILTER_VALUES.has(normalized)
    ? (normalized as ResourceFilter)
    : "all";
}

/** Match a URL subject slug to a real subject name (case-insensitive). */
export function resolveSubjectName(
  slug: string | null | undefined,
  subjectNames: string[],
): string | null {
  if (!slug || subjectNames.length === 0) return null;
  const decoded = decodeURIComponent(slug).trim();
  if (!decoded) return null;
  const exact = subjectNames.find((name) => name === decoded);
  if (exact) return exact;
  const lower = decoded.toLowerCase();
  return subjectNames.find((name) => name.toLowerCase() === lower) ?? null;
}

export function subjectToSlug(subject: string): string {
  return encodeURIComponent(subject);
}

/** Parse a 1-based page number from RAG section labels like "Page 12". */
export function pageFromSectionLabel(
  label: string | undefined,
): number | null {
  if (!label) return null;
  const m = label.match(/page\s*(\d+)/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Normalize folder deep-link ids: scoped or legacy assignment-1, unit-2, year-2024, other */
export function parseResourceFolder(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const normalized = decodeURIComponent(value).trim().toLowerCase();
  if (!normalized) return null;
  const legacy =
    /^(assignment-[\da-z]+|unit-\d+|year-\d{4}|other)$/i.test(normalized);
  if (legacy) return normalized;
  const scoped = /^.+::(assignment-[\da-z]+|unit-\d+|year-\d{4}|other)$/i.test(
    normalized,
  );
  if (scoped) return normalized;
  return null;
}

export function buildResourcesHref(opts: {
  academicYear?: string;
  branch: string;
  semester: number | string;
  subject?: string | null;
  filter?: ResourceFilter | null;
  folder?: string | null;
  view?: string | null;
  page?: number | null;
}): string {
  const params = new URLSearchParams();
  if (opts.academicYear) params.set("year", opts.academicYear);
  params.set("branch", opts.branch);
  params.set("semester", String(opts.semester));
  if (opts.subject) params.set("subject", subjectToSlug(opts.subject));
  if (opts.filter && opts.filter !== "all") params.set("filter", opts.filter);
  if (opts.folder) params.set("folder", opts.folder);
  if (opts.view) params.set("view", opts.view);
  if (opts.page && opts.page > 0) params.set("page", String(opts.page));
  return `/resources?${params.toString()}`;
}
