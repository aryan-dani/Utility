import { describe, expect, it } from "vitest";
import { homePayloadIsEmpty } from "./homeApi";

describe("homePayloadIsEmpty", () => {
  it("treats an empty doubt board as a miss so Firestore can answer", () => {
    expect(homePayloadIsEmpty("/v1/qa/questions", { questions: [] })).toBe(true);
    expect(
      homePayloadIsEmpty("/v1/qa/questions", { questions: [{ id: "1" }] }),
    ).toBe(false);
  });

  it("treats a never-written clipboard as a miss", () => {
    expect(homePayloadIsEmpty("/v1/clipboard", { text: "", updated_at: null })).toBe(
      true,
    );
    expect(
      homePayloadIsEmpty("/v1/clipboard", { text: "hi", updated_at: "2026-01-01" }),
    ).toBe(false);
  });
});
