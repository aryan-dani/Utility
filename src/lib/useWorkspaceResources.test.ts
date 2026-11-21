import { describe, expect, it } from "vitest";
import { catalogChanged } from "./useWorkspaceResources";

describe("catalogChanged", () => {
  it("treats a newer updatedAt as a catalog change after Drive sync", () => {
    expect(
      catalogChanged(
        {
          resources: [{ id: "1" } as never],
          syllabusUrl: null,
          updatedAt: "2026-11-21T10:00:00.000Z",
        },
        {
          resources: [{ id: "1" } as never, { id: "2" } as never],
          syllabusUrl: null,
          updatedAt: "2026-11-21T14:30:00.000Z",
        },
      ),
    ).toBe(true);
  });

  it("detects empty → populated without relying on updatedAt", () => {
    expect(
      catalogChanged(
        { resources: [], syllabusUrl: null, updatedAt: null },
        {
          resources: [{ id: "1" } as never],
          syllabusUrl: null,
          updatedAt: "2026-11-21T14:30:00.000Z",
        },
      ),
    ).toBe(true);
  });
});
