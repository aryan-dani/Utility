import { describe, expect, it } from "vitest";
import {
  buildCatalogScopes,
  catalogScopeId,
  type ResourceRow,
  type SubjectRow,
} from "./catalogBuild.js";

const subjects: SubjectRow[] = [
  { id: "s-gml", name: "GML", academicYear: "2026-2027", branch: "AIDS", semester: 5 },
  { id: "s-ml", name: "Machine Learning", academicYear: "2026-2027", branch: "AIDS", semester: 5 },
];

function resource(overrides: Partial<ResourceRow> & { id: string }): ResourceRow {
  return {
    title: "GML_Unit_1_Notes.pdf",
    category: "notes",
    subjectId: "s-gml",
    academicYear: "2026-2027",
    branch: "AIDS",
    semester: 5,
    driveFileId: `drive-${overrides.id}`,
    drivePath: "2026-2027/AIDS/Sem_5_AIDS/Sem_5_Notes/GML/GML_Unit_1_Notes.pdf",
    fileUrl: `https://drive.google.com/file/d/${overrides.id}/preview`,
    native: null,
    updatedAt: new Date("2026-11-20T10:00:00.000Z"),
    ...overrides,
  };
}

describe("catalogScopeId", () => {
  it("uses the year, branch, semester format the site already reads", () => {
    expect(catalogScopeId("2026-2027", "AIDS", 5)).toBe("2026-2027__AIDS__5");
  });
});

describe("buildCatalogScopes", () => {
  it("groups resources and subjects by academic scope", () => {
    const scopes = buildCatalogScopes(
      [
        resource({ id: "r1" }),
        resource({ id: "r2", semester: 4, academicYear: "2025-2026" }),
      ],
      subjects,
    );
    expect(scopes.map((s) => s.id)).toEqual([
      "2025-2026__AIDS__4",
      "2026-2027__AIDS__5",
    ]);
    const sem5 = scopes.find((s) => s.id === "2026-2027__AIDS__5");
    expect(sem5?.resourceCount).toBe(1);
    expect(sem5?.payload.subjects.map((s) => s.name)).toEqual(["GML", "Machine Learning"]);
  });

  it("keeps subject-only scopes so the subject list still shows", () => {
    const scopes = buildCatalogScopes([], subjects);
    expect(scopes).toHaveLength(1);
    expect(scopes[0].resourceCount).toBe(0);
    expect(scopes[0].payload.subjects).toHaveLength(2);
  });

  it("maps subject_name from the subject row and falls back to Unknown", () => {
    const scopes = buildCatalogScopes(
      [resource({ id: "r1" }), resource({ id: "r2", subjectId: null })],
      subjects,
    );
    const names = scopes[0].payload.resources.map((r) => r.subject_name);
    expect(names).toEqual(["GML", "Unknown"]);
  });

  it("uses the syllabus file url when a syllabus resource exists", () => {
    const scopes = buildCatalogScopes(
      [
        resource({
          id: "syl",
          title: "AIDS Sem 5 Syllabus.pdf",
          drivePath: "2026-2027/AIDS/Sem_5_AIDS/Syllabus/AIDS Sem 5 Syllabus.pdf",
        }),
        resource({ id: "r1" }),
      ],
      subjects,
    );
    expect(scopes[0].payload.syllabusUrl).toBe("https://drive.google.com/file/d/syl/preview");
  });

  it("returns a stable hash for identical content regardless of input order", () => {
    const a = buildCatalogScopes([resource({ id: "r1" }), resource({ id: "r2" })], subjects);
    const b = buildCatalogScopes([resource({ id: "r2" }), resource({ id: "r1" })], [...subjects].reverse());
    expect(a[0].contentHash).toBe(b[0].contentHash);
  });

  it("changes the hash when a resource changes, so only that scope is rewritten", () => {
    const before = buildCatalogScopes([resource({ id: "r1" })], subjects);
    const after = buildCatalogScopes(
      [resource({ id: "r1", title: "GML_Unit_1_Notes_v2.pdf" })],
      subjects,
    );
    expect(before[0].contentHash).not.toBe(after[0].contentHash);
  });
});
