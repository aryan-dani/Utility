import { describe, expect, it } from "vitest";
import { titleFromFirstMessage } from "./chatTitle";

describe("titleFromFirstMessage", () => {
  it("returns New Chat for blank input", () => {
    expect(titleFromFirstMessage("   ")).toBe("New Chat");
  });

  it("strips lead-ins and keeps the first clause", () => {
    expect(
      titleFromFirstMessage(
        "Outline UI/UX heuristic evaluation steps for a Sem 5 mini-project.",
      ),
    ).toBe("UI/UX heuristic evaluation steps for a Sem 5…");
  });

  it("is deterministic for the same question", () => {
    const q = "Explain overfitting vs underfitting in Machine Learning with examples";
    expect(titleFromFirstMessage(q)).toBe(titleFromFirstMessage(q));
    expect(titleFromFirstMessage(q)).toBe(
      "Overfitting vs underfitting in Machine Learning…",
    );
  });

  it("keeps short titles intact", () => {
    expect(titleFromFirstMessage("What is a semaphore?")).toBe("A semaphore");
  });
});
