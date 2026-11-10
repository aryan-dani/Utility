import { describe, expect, it, vi } from "vitest";
import {
  findOfficialSubject,
  loadSemesterCatalog,
  mitWpuHubPaths,
  parseBranchParam,
  parseSemesterParam,
  publicResourceTitles,
  slugifySubject,
} from "./mitWpuCatalog";

vi.mock("@/lib/dataFetcher", () => ({
  getSubjectsFromDB: vi.fn(async () => {
    throw new Error("Could not load the default credentials.");
  }),
  getWorkspaceList: vi.fn(async () => {
    throw new Error("Could not load the default credentials.");
  }),
}));

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

  it("finds AIDS official outlines only", () => {
    const hit = findOfficialSubject("AIDS", 3, "data-structures");
    expect(hit?.name).toBe("Data Structures");
    expect(findOfficialSubject("CSE", 3, "data-structures")).toBeNull();
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

  it("lists hub paths for sitemap seeds", () => {
    const paths = mitWpuHubPaths();
    expect(paths).toContain("/mit-wpu");
    expect(paths).toContain("/mit-wpu/aids");
    expect(paths).toContain("/mit-wpu/aids/semester/5");
    expect(paths).toContain("/mit-wpu/ask-ai");
  });

  it("returns an empty catalog when Firebase Admin credentials are missing", async () => {
    await expect(loadSemesterCatalog("AIDS", 3)).resolves.toEqual({
      subjects: [],
      resources: [],
      resourceCount: 0,
    });
  });
});
