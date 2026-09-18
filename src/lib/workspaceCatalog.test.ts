import { describe, expect, it } from "vitest";
import { workspaceCatalogId } from "@/lib/workspaceCatalog";

describe("workspaceCatalogId", () => {
  it("builds a stable doc id", () => {
    expect(workspaceCatalogId("2026-2027", "AIDS", 5)).toBe(
      "2026-2027__AIDS__5",
    );
  });
});
