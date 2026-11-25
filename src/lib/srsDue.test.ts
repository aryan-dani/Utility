import { afterEach, describe, expect, it, vi } from "vitest";
import { countDueCards } from "@/lib/srsDue";

describe("countDueCards", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ignores cards missing nextReviewDate and counts only cards due on or before today", () => {
    const cards = [
      { nextReviewDate: "2026-11-24" },
      { nextReviewDate: "2026-11-25" },
      { nextReviewDate: "2026-11-26" },
      {},
      { nextReviewDate: "" },
    ];
    vi.stubGlobal("window", {});
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify(cards),
    });

    expect(countDueCards("2026-11-25")).toBe(2);
  });
});
