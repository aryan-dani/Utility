import { describe, expect, it } from "vitest";
import { applyGrade, computeNextReview } from "@/lib/srs/scheduling";

describe("computeNextReview", () => {
  it("uses interval [1,2,4,7,14] days per box", () => {
    const from = new Date(2026, 8, 5); // Sep 5
    expect(computeNextReview(1, from)).toBe("2026-09-06");
    expect(computeNextReview(2, from)).toBe("2026-09-07");
    expect(computeNextReview(3, from)).toBe("2026-09-09");
    expect(computeNextReview(4, from)).toBe("2026-09-12");
    expect(computeNextReview(5, from)).toBe("2026-09-19");
  });

  it("caps interval at box 5 (14 days)", () => {
    const from = new Date(2026, 0, 1);
    expect(computeNextReview(6, from)).toBe("2026-01-15");
  });
});

describe("applyGrade", () => {
  const today = new Date(2026, 8, 5);

  it("passes advance box and schedule next review", () => {
    const result = applyGrade({ box: 2 }, true, today);
    expect(result.box).toBe(3);
    expect(result.nextReview).toBe("2026-09-09");
  });

  it("caps box at 5 on pass", () => {
    const result = applyGrade({ box: 5 }, true, today);
    expect(result.box).toBe(5);
    expect(result.nextReview).toBe("2026-09-19");
  });

  it("easy jumps two boxes", () => {
    const result = applyGrade({ box: 2 }, "easy", today);
    expect(result.box).toBe(4);
    expect(result.nextReview).toBe("2026-09-12");
  });
});
