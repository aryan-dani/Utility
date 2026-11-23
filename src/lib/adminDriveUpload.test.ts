import { describe, expect, it } from "vitest";
import {
  assertCanonicalDestPath,
  buildAdminDestPath,
  buildAdminRemoteName,
  normalizeSubjectCode,
  previewAdminUpload,
} from "@/lib/adminDriveUpload";

describe("normalizeSubjectCode", () => {
  it("accepts letters digits and underscores", () => {
    expect(normalizeSubjectCode("gml")).toBe("GML");
    expect(normalizeSubjectCode("pbl-iii")).toBe("PBL_III");
  });

  it("rejects invalid subject codes", () => {
    expect(normalizeSubjectCode("GML!")).toBeNull();
    expect(normalizeSubjectCode("")).toBeNull();
  });
});

describe("buildAdminDestPath", () => {
  it("builds the canonical Sem_N_Notes path", () => {
    expect(
      buildAdminDestPath({
        year: "2026-2027",
        branch: "AIDS",
        semester: 5,
        subject: "GML",
        category: "notes",
      }),
    ).toBe("2026-2027/AIDS/Sem_5_AIDS/Sem_5_Notes/GML");
  });

  it("rejects a path that is not produced by the form fields", () => {
    expect(() =>
      assertCanonicalDestPath("2026-2027/AIDS/random/GML", {
        year: "2026-2027",
        branch: "AIDS",
        semester: 5,
        subject: "GML",
        category: "notes",
      }),
    ).toThrow(/must match/);
  });
});

describe("buildAdminRemoteName", () => {
  const base = {
    year: "2026-2027",
    branch: "AIDS",
    semester: 5,
    subject: "GML",
  } as const;

  it("names notes with Unit_N_Notes", () => {
    expect(
      buildAdminRemoteName({
        ...base,
        category: "notes",
        unit: "1",
        extension: "pdf",
      }),
    ).toBe("GML_Unit_1_Notes.pdf");
  });

  it("names presentations with Unit_N", () => {
    expect(
      buildAdminRemoteName({
        ...base,
        category: "ppt",
        unit: "2",
        extension: "pptx",
      }),
    ).toBe("GML_Unit_2.pptx");
  });

  it("names PYQ with year and term", () => {
    expect(
      buildAdminRemoteName({
        ...base,
        category: "pyq",
        examYear: 2024,
        examTerm: "End",
        extension: "pdf",
      }),
    ).toBe("GML_PYQ_2024_End.pdf");
  });

  it("names question banks", () => {
    expect(
      buildAdminRemoteName({
        ...base,
        category: "qb",
        qbYear: 2024,
        qbSolved: true,
        extension: "pdf",
      }),
    ).toBe("GML_QB_2024_Solved.pdf");
  });

  it("names writeups and codes with semester prefix", () => {
    expect(
      buildAdminRemoteName({
        ...base,
        category: "writeups",
        writeupNumber: "1",
        extension: "pdf",
      }),
    ).toBe("Sem_5_GML_WriteUp_1.pdf");
    expect(
      buildAdminRemoteName({
        ...base,
        category: "codes",
        assignmentNumber: "1A",
        extension: "zip",
      }),
    ).toBe("Sem_5_GML_Assignment_1A.zip");
  });

  it("rejects disallowed extensions", () => {
    expect(() =>
      buildAdminRemoteName({
        ...base,
        category: "notes",
        unit: "1",
        extension: "exe",
      }),
    ).toThrow(/not allowed/);
  });
});

describe("previewAdminUpload", () => {
  it("returns dest and remote name together", () => {
    expect(
      previewAdminUpload({
        year: "2026-2027",
        branch: "AIDS",
        semester: 5,
        subject: "GML",
        category: "notes",
        unit: "1",
        extension: "pdf",
      }),
    ).toEqual({
      destPath: "2026-2027/AIDS/Sem_5_AIDS/Sem_5_Notes/GML",
      remoteName: "GML_Unit_1_Notes.pdf",
      fullPath: "2026-2027/AIDS/Sem_5_AIDS/Sem_5_Notes/GML/GML_Unit_1_Notes.pdf",
    });
  });
});
