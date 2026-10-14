import type { AcademicYear, Branch, Semester } from "@/lib/academic/scope";
import {
  ACADEMIC_YEAR_SET,
  BRANCH_SET,
  DEFAULT_ACADEMIC_YEAR,
  SEMESTER_SET,
} from "@/lib/academic/scope";

export type { AcademicYear, Branch, Semester };
export { DEFAULT_ACADEMIC_YEAR };

/** Fallback when URL, prefs, and localStorage are all empty. */
export const DEFAULT_BRANCH: Branch = "AIDS";
export const DEFAULT_SEMESTER: Semester = 5;

export const WORKSPACE_STORAGE_KEY = "utility-workspace";

export function parseAcademicYear(
  value: string | null | undefined,
): AcademicYear | null {
  if (!value) return null;
  const trimmed = value.trim();
  return ACADEMIC_YEAR_SET.has(trimmed) ? (trimmed as AcademicYear) : null;
}

export function parseBranch(value: string | null | undefined): Branch | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return BRANCH_SET.has(upper) ? (upper as Branch) : null;
}

export function parseSemester(
  value: string | number | null | undefined,
): Semester | null {
  if (value === null || value === undefined || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || !SEMESTER_SET.has(num)) return null;
  return num as Semester;
}

export type WorkspacePrefs = {
  academicYear?: string | null;
  branch?: string | null;
  semester?: string | number | null;
};

export type ResolvedWorkspace = {
  academicYear: AcademicYear;
  branch: Branch;
  semester: Semester;
};

/** Resolve workspace: URL params win, then prefs, then defaults. */
export function resolveWorkspace(
  params: {
    year?: string | null;
    branch?: string | null;
    semester?: string | null;
  },
  prefs?: WorkspacePrefs | null,
): ResolvedWorkspace {
  const academicYear =
    parseAcademicYear(params.year) ??
    parseAcademicYear(prefs?.academicYear) ??
    DEFAULT_ACADEMIC_YEAR;
  const branch =
    parseBranch(params.branch) ??
    parseBranch(prefs?.branch) ??
    DEFAULT_BRANCH;
  const semester =
    parseSemester(params.semester) ??
    parseSemester(prefs?.semester) ??
    DEFAULT_SEMESTER;
  return { academicYear, branch, semester };
}

export function readStoredWorkspace(): WorkspacePrefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkspacePrefs;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStoredWorkspace(
  academicYear: AcademicYear,
  branch: Branch,
  semester: Semester,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify({ academicYear, branch, semester }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

/** Safe same-origin path for post-login redirects. */
export function sanitizeRedirectTo(
  value: string | null | undefined,
  fallback = "/planner",
): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://") || trimmed.includes("\\")) return fallback;
  return trimmed;
}

export function workspaceQuery(
  academicYear: AcademicYear,
  branch: Branch,
  semester: Semester,
  scope?: { subject?: string; unit?: string },
): string {
  const params = new URLSearchParams();
  params.set("year", academicYear);
  params.set("branch", branch);
  params.set("semester", String(semester));
  if (scope?.subject) params.set("subject", scope.subject);
  if (scope?.unit) params.set("unit", scope.unit);
  return params.toString();
}
