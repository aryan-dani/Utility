/** Single source of truth for academic scope options. */

export const ACADEMIC_YEARS = ["2026-2027", "2025-2026"] as const;
export type AcademicYear = (typeof ACADEMIC_YEARS)[number];

export const DEFAULT_ACADEMIC_YEAR: AcademicYear = "2026-2027";
export const LEGACY_ACADEMIC_YEAR: AcademicYear = "2025-2026";

export const BRANCHES = ["AIDS", "CSE", "ECE"] as const;
export type Branch = (typeof BRANCHES)[number];

export const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export type Semester = (typeof SEMESTERS)[number];

export const ACADEMIC_YEAR_SET = new Set<string>(ACADEMIC_YEARS);
export const BRANCH_SET = new Set<string>(BRANCHES);
export const SEMESTER_SET = new Set<number>(SEMESTERS);

/** Matches Drive folder prefix e.g. 2025-2026 */
export const ACADEMIC_YEAR_PATH_RE = /^\d{4}-\d{4}$/;

export const ACADEMIC_YEAR_OPTIONS: { value: AcademicYear; label: string }[] = [
  { value: "2026-2027", label: "2026-2027 (current)" },
  { value: "2025-2026", label: "2025-2026 (archive)" },
];

export const ACADEMIC_YEAR_OPTIONS_SHORT: { value: AcademicYear; label: string }[] = [
  { value: "2026-2027", label: "2026-27" },
  { value: "2025-2026", label: "2025-26" },
];

/** Sidebar trigger labels - year number only; current/archive is shown as a hint. */
export const ACADEMIC_YEAR_OPTIONS_SIDEBAR: { value: AcademicYear; label: string; menuLabel: string }[] = [
  { value: "2026-2027", label: "2026–2027", menuLabel: "2026–2027 · Current" },
  { value: "2025-2026", label: "2025–2026", menuLabel: "2025–2026 · Archive" },
];

/** Short labels (sidebar, admin). */
export const BRANCH_OPTIONS = BRANCHES.map((value) => ({
  value,
  label: value,
}));

/** Long labels (profile settings). */
export const BRANCH_OPTIONS_LONG: { value: Branch; label: string }[] = [
  { value: "AIDS", label: "Artificial Intelligence & Data Science" },
  { value: "CSE", label: "Computer Science & Engineering" },
  { value: "ECE", label: "Electronics & Communication Engineering" },
];

export const SEMESTER_OPTIONS = SEMESTERS.map((value) => ({
  value,
  label: `Semester ${value}`,
}));

export const SEMESTER_OPTIONS_SHORT = SEMESTERS.map((value) => ({
  value,
  label: `Sem ${value}`,
}));

export function isAcademicYear(value: string): value is AcademicYear {
  return ACADEMIC_YEAR_SET.has(value);
}

export function isBranch(value: string): value is Branch {
  return BRANCH_SET.has(value);
}

export function isSemester(value: number): value is Semester {
  return SEMESTER_SET.has(value);
}

/** Treat missing academic_year on Firestore docs as the legacy archive year. */
export function matchesAcademicYear(
  docYear: string | undefined | null,
  requestedYear: AcademicYear,
): boolean {
  if (!docYear) return requestedYear === LEGACY_ACADEMIC_YEAR;
  return docYear === requestedYear;
}
