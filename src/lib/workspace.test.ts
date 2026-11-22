import { describe, expect, it } from "vitest";
import {
  parseAcademicYear,
  parseBranch,
  parseSemester,
  resolveWorkspace,
  migrateWorkspacePrefs,
  sanitizeRedirectTo,
  workspaceQuery,
  DEFAULT_ACADEMIC_YEAR,
  DEFAULT_BRANCH,
  DEFAULT_SEMESTER,
  LEGACY_ACADEMIC_YEAR,
  WORKSPACE_SCOPE_VERSION,
} from "@/lib/workspace";

describe("parseAcademicYear", () => {
  it("parses valid years and rejects invalid", () => {
    expect(parseAcademicYear("2026-2027")).toBe("2026-2027");
    expect(parseAcademicYear(" 2025-2026 ")).toBe("2025-2026");
    expect(parseAcademicYear("nope")).toBeNull();
    expect(parseAcademicYear(null)).toBeNull();
  });
});

describe("parseBranch", () => {
  it("uppercases and validates", () => {
    expect(parseBranch("aids")).toBe("AIDS");
    expect(parseBranch("CSE")).toBe("CSE");
    expect(parseBranch("xyz")).toBeNull();
    expect(parseBranch(undefined)).toBeNull();
  });
});

describe("parseSemester", () => {
  it("parses numbers and strings in range", () => {
    expect(parseSemester(5)).toBe(5);
    expect(parseSemester("3")).toBe(3);
    expect(parseSemester(0)).toBeNull();
    expect(parseSemester("")).toBeNull();
    expect(parseSemester(null)).toBeNull();
  });
});

describe("migrateWorkspacePrefs", () => {
  it("upgrades stale archive prefs to the current academic year", () => {
    expect(
      migrateWorkspacePrefs({
        academicYear: LEGACY_ACADEMIC_YEAR,
        branch: "CSE",
        semester: 5,
      }),
    ).toEqual({
      academicYear: DEFAULT_ACADEMIC_YEAR,
      branch: "CSE",
      semester: 5,
      scopeVersion: WORKSPACE_SCOPE_VERSION,
      migrated: true,
    });
  });

  it("keeps an explicit archive pick at the current scope version", () => {
    expect(
      migrateWorkspacePrefs({
        academicYear: LEGACY_ACADEMIC_YEAR,
        branch: "CSE",
        semester: 5,
        scopeVersion: WORKSPACE_SCOPE_VERSION,
      }),
    ).toEqual({
      academicYear: LEGACY_ACADEMIC_YEAR,
      branch: "CSE",
      semester: 5,
      scopeVersion: WORKSPACE_SCOPE_VERSION,
      migrated: false,
    });
  });
});

describe("resolveWorkspace", () => {
  it("lets URL win over prefs over defaults", () => {
    expect(resolveWorkspace({})).toEqual({
      academicYear: DEFAULT_ACADEMIC_YEAR,
      branch: DEFAULT_BRANCH,
      semester: DEFAULT_SEMESTER,
    });

    expect(
      resolveWorkspace(
        {},
        { academicYear: LEGACY_ACADEMIC_YEAR, branch: "CSE", semester: 2 },
      ),
    ).toEqual({
      academicYear: DEFAULT_ACADEMIC_YEAR,
      branch: "CSE",
      semester: 2,
    });

    expect(
      resolveWorkspace(
        { year: "2026-2027", branch: "ECE", semester: "7" },
        { academicYear: LEGACY_ACADEMIC_YEAR, branch: "CSE", semester: 2 },
      ),
    ).toEqual({
      academicYear: "2026-2027",
      branch: "ECE",
      semester: 7,
    });
  });
});

describe("sanitizeRedirectTo", () => {
  it("rejects open redirects and accepts safe paths", () => {
    expect(sanitizeRedirectTo("//evil.com")).toBe("/planner");
    expect(sanitizeRedirectTo("https://evil.com")).toBe("/planner");
    expect(sanitizeRedirectTo("/path\\to")).toBe("/planner");
    expect(sanitizeRedirectTo("/planner?x=1")).toBe("/planner?x=1");
  });
});

describe("workspaceQuery", () => {
  it("builds query string", () => {
    expect(workspaceQuery("2026-2027", "AIDS", 5)).toBe(
      "year=2026-2027&branch=AIDS&semester=5",
    );
  });
});
