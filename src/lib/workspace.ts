import type { AcademicYear, Branch, Semester } from "@/lib/academic/scope";
import {
  ACADEMIC_YEAR_SET,
  BRANCH_SET,
  DEFAULT_ACADEMIC_YEAR,
  LEGACY_ACADEMIC_YEAR,
  SEMESTER_SET,
} from "@/lib/academic/scope";

export type { AcademicYear, Branch, Semester };
export { DEFAULT_ACADEMIC_YEAR, LEGACY_ACADEMIC_YEAR };

/** Fallback when URL, prefs, and localStorage are all empty. */
export const DEFAULT_BRANCH: Branch = "AIDS";
export const DEFAULT_SEMESTER: Semester = 5;

export const WORKSPACE_STORAGE_KEY = "utility-workspace";

/**
 * Bump when DEFAULT_ACADEMIC_YEAR rolls forward. Prefs / localStorage saved
 * under an older version are coerced onto the new current year so students
 * are not stuck browsing an empty archive vault after the rollover.
 * Explicit archive picks written at the current version are kept.
 */
export const WORKSPACE_SCOPE_VERSION = 2;

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
  /** Absent or stale → migrate year to DEFAULT_ACADEMIC_YEAR. */
  scopeVersion?: number | null;
};

export type ResolvedWorkspace = {
  academicYear: AcademicYear;
  branch: Branch;
  semester: Semester;
};

export type MigratedWorkspacePrefs = ResolvedWorkspace & {
  scopeVersion: number;
  /** True when year was upgraded from a pre-rollover pref. */
  migrated: boolean;
};

/**
 * Coerce saved prefs onto the current academic year after a rollover.
 * URL params are not passed through here — callers apply URL first.
 */
export function migrateWorkspacePrefs(
  prefs?: WorkspacePrefs | null,
): MigratedWorkspacePrefs {
  const version =
    typeof prefs?.scopeVersion === "number" &&
    Number.isFinite(prefs.scopeVersion)
      ? prefs.scopeVersion
      : 0;
  const branch = parseBranch(prefs?.branch) ?? DEFAULT_BRANCH;
  const semester = parseSemester(prefs?.semester) ?? DEFAULT_SEMESTER;
  const savedYear = parseAcademicYear(prefs?.academicYear);

  if (version >= WORKSPACE_SCOPE_VERSION) {
    return {
      academicYear: savedYear ?? DEFAULT_ACADEMIC_YEAR,
      branch,
      semester,
      scopeVersion: WORKSPACE_SCOPE_VERSION,
      migrated: false,
    };
  }

  // Stale prefs from last year's "current" (now LEGACY) → follow the new default.
  return {
    academicYear: DEFAULT_ACADEMIC_YEAR,
    branch,
    semester,
    scopeVersion: WORKSPACE_SCOPE_VERSION,
    migrated: savedYear !== DEFAULT_ACADEMIC_YEAR,
  };
}

/** Resolve workspace: URL params win, then migrated prefs, then defaults. */
export function resolveWorkspace(
  params: {
    year?: string | null;
    branch?: string | null;
    semester?: string | null;
  },
  prefs?: WorkspacePrefs | null,
): ResolvedWorkspace {
  const migrated = migrateWorkspacePrefs(prefs);
  const academicYear =
    parseAcademicYear(params.year) ?? migrated.academicYear;
  const branch = parseBranch(params.branch) ?? migrated.branch;
  const semester = parseSemester(params.semester) ?? migrated.semester;
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
      JSON.stringify({
        academicYear,
        branch,
        semester,
        scopeVersion: WORKSPACE_SCOPE_VERSION,
      }),
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
