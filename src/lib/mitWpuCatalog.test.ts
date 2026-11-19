import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  findOfficialSubject,
  isJunkSubjectSlug,
  loadSemesterCatalog,
  matchSubjectResources,
  mitWpuHubPaths,
  mitWpuSubjectPaths,
  officialCanonicalSlug,
  officialRedirectSlug,
  parseBranchParam,
  parseSemesterParam,
  publicResourceTitles,
  semesterHasIndexableSubjects,
  semesterSubjectLinks,
  slugifySubject,
} from "./mitWpuCatalog";
import { AIDS_SEM_3_SUBJECTS_2026 } from "./syllabusData";
import type { SubjectItem } from "./dataFetcher";

const { getSubjectsFromDB, getWorkspaceList } = vi.hoisted(() => ({
  getSubjectsFromDB: vi.fn(
    async (
      _year: string,
      _branch: string,
      _semester: number,
    ): Promise<SubjectItem[]> => {
      throw new Error("Could not load the default credentials.");
    },
  ),
  getWorkspaceList: vi.fn(async () => {
    throw new Error("Could not load the default credentials.");
  }),
}));

vi.mock("@/lib/dataFetcher", () => ({
  getSubjectsFromDB,
  getWorkspaceList,
}));

beforeEach(() => {
  getSubjectsFromDB.mockReset();
  getWorkspaceList.mockReset();
  getSubjectsFromDB.mockImplementation(async () => {
    throw new Error("Could not load the default credentials.");
  });
  getWorkspaceList.mockImplementation(async () => {
    throw new Error("Could not load the default credentials.");
  });
});

describe("mitWpuCatalog", () => {
  it("slugifies subject names stably", () => {
    expect(slugifySubject("Data Structures")).toBe("data-structures");
    expect(slugifySubject("AI & Expert Systems")).toBe("ai-and-expert-systems");
  });

  it("parses branch and semester params", () => {
    expect(parseBranchParam("aids")).toBe("AIDS");
    expect(parseBranchParam("nope")).toBeNull();
    expect(parseSemesterParam("5")).toBe(5);
    expect(parseSemesterParam("99")).toBeNull();
  });

  it("finds AIDS official outlines by name or code slug", () => {
    expect(findOfficialSubject("AIDS", 3, "data-structures")?.name).toBe(
      "Data Structures",
    );
    expect(findOfficialSubject("AIDS", 3, "ds")?.code).toBe("DS");
    expect(findOfficialSubject("CSE", 3, "data-structures")).toBeNull();
  });

  it("redirects code aliases to the canonical full-name slug", () => {
    expect(officialRedirectSlug("AIDS", 3, "ds")).toBe("data-structures");
    expect(officialRedirectSlug("AIDS", 3, "data-structures")).toBeNull();
    expect(
      officialCanonicalSlug(AIDS_SEM_3_SUBJECTS_2026[0]),
    ).toBe("data-structures");
  });

  it("matches catalog resources tagged with the official code", () => {
    const official = findOfficialSubject("AIDS", 3, "data-structures");
    const titles = matchSubjectResources(
      [
        {
          title: "DS_Unit_1.pdf",
          category: "ppt",
          subject_name: "DS",
        },
        {
          title: "Other.pdf",
          category: "notes",
          subject_name: "DBMS",
        },
      ],
      "Data Structures",
      official,
    );
    expect(titles.map((entry) => entry.title)).toEqual(["DS_Unit_1.pdf"]);
  });

  it("strips download URLs from public resource titles", () => {
    const titles = publicResourceTitles([
      {
        id: "1",
        title: "Unit 1 notes",
        file_url: "https://drive.google.com/file/d/x",
        created_at: new Date().toISOString(),
        subject_name: "Data Structures",
        category: "notes",
        drive_file_id: "secret",
      },
    ]);
    expect(titles[0]).toEqual({
      title: "Unit 1 notes",
      category: "notes",
      subject_name: "Data Structures",
    });
    expect(JSON.stringify(titles)).not.toContain("drive.google");
    expect(JSON.stringify(titles)).not.toContain("secret");
  });

  it("lists hub paths without empty semester shells", () => {
    const paths = mitWpuHubPaths();
    expect(paths).toContain("/mit-wpu");
    expect(paths).toContain("/mit-wpu/aids");
    expect(paths).toContain("/mit-wpu/ask-ai");
    expect(paths).not.toContain("/mit-wpu/aids/semester/5");
  });

  it("treats general as a junk subject and empty AIDS Sem 1 as non-indexable", () => {
    expect(isJunkSubjectSlug("general")).toBe(true);
    expect(semesterHasIndexableSubjects("AIDS", 1, [])).toBe(false);
    expect(semesterHasIndexableSubjects("AIDS", 3, [])).toBe(true);
  });

  it("prefers official full names over catalog code folders in semester links", () => {
    const links = semesterSubjectLinks("AIDS", 3, [
      {
        id: "1",
        name: "DS",
        branch: "AIDS",
        semester: 3,
      },
      {
        id: "2",
        name: "general",
        branch: "AIDS",
        semester: 3,
      },
      {
        id: "3",
        name: "Custom Elective",
        branch: "AIDS",
        semester: 3,
      },
    ]);
    expect(links.some((entry) => entry.slug === "data-structures")).toBe(true);
    expect(links.some((entry) => entry.slug === "ds")).toBe(false);
    expect(links.some((entry) => entry.slug === "general")).toBe(false);
    expect(links.some((entry) => entry.slug === "custom-elective")).toBe(true);
  });

  it("returns an empty catalog when Firebase Admin credentials are missing", async () => {
    await expect(loadSemesterCatalog("AIDS", 3)).resolves.toEqual({
      subjects: [],
      resources: [],
      resourceCount: 0,
    });
  });

  it("emits official name slugs and skips code aliases in subject paths", async () => {
    getSubjectsFromDB.mockImplementation(
      async (_year, branch, semester) => {
        if (branch === "AIDS" && semester === 3) {
          return [
            { id: "1", name: "DS", branch: "AIDS", semester: 3 },
            { id: "2", name: "general", branch: "AIDS", semester: 3 },
            { id: "3", name: "Custom Elective", branch: "AIDS", semester: 3 },
          ];
        }
        throw new Error("Could not load the default credentials.");
      },
    );

    const paths = await mitWpuSubjectPaths();
    const sem3 = paths.filter(
      (entry) => entry.branch === "aids" && entry.semester === "3",
    );
    expect(sem3.some((entry) => entry.subject === "data-structures")).toBe(
      true,
    );
    expect(sem3.some((entry) => entry.subject === "ds")).toBe(false);
    expect(sem3.some((entry) => entry.subject === "general")).toBe(false);
    expect(sem3.some((entry) => entry.subject === "custom-elective")).toBe(
      true,
    );
  });
});
