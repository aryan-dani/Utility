import { describe, it, expect } from "vitest";
import {
  rankQuestions,
  QUESTION_CATEGORIES,
  QUESTION_BODY_MAX,
  ANSWER_BODY_MAX,
  ATTACHMENT_MAX,
  type QAQuestion,
} from "./types";

function makeQuestion(partial: Partial<QAQuestion>): QAQuestion {
  return {
    id: "q-1",
    academic_year: "2026-2027",
    branch: "AIDS",
    semester: 5,
    subject_name: "Machine Learning",
    category: "doubt",
    author_uid: "user-123",
    author_name: "Student",
    body: "How does gradient descent work?",
    attachments: [],
    status: "open",
    upvotes: 0,
    answer_count: 0,
    ai_auto_answered: false,
    needs_human: false,
    created_at: new Date("2026-09-10T10:00:00Z").toISOString(),
    last_activity_at: new Date("2026-09-10T10:00:00Z").toISOString(),
    ...partial,
  };
}

describe("QA constants and types", () => {
  it("defines standard categories", () => {
    expect(QUESTION_CATEGORIES.map((c) => c.value)).toEqual([
      "doubt",
      "homework",
      "general",
    ]);
  });

  it("sets safe bounds for body and attachments", () => {
    expect(QUESTION_BODY_MAX).toBeGreaterThanOrEqual(1000);
    expect(ANSWER_BODY_MAX).toBeGreaterThanOrEqual(1000);
    expect(ATTACHMENT_MAX).toBe(4);
  });
});

describe("rankQuestions", () => {
  it("ranks open questions before resolved questions", () => {
    const qOpen = makeQuestion({ id: "open-q", status: "open", upvotes: 1 });
    const qResolved = makeQuestion({ id: "res-q", status: "resolved", upvotes: 50 });

    const ranked = rankQuestions([qResolved, qOpen]);
    expect(ranked[0].id).toBe("open-q");
    expect(ranked[1].id).toBe("res-q");
  });

  it("ranks higher upvotes ahead within the same status", () => {
    const qLow = makeQuestion({ id: "low", upvotes: 2 });
    const qHigh = makeQuestion({ id: "high", upvotes: 10 });

    const ranked = rankQuestions([qLow, qHigh]);
    expect(ranked[0].id).toBe("high");
    expect(ranked[1].id).toBe("low");
  });

  it("ranks unanswered questions ahead of answered ones when upvotes are equal", () => {
    const qAnswered = makeQuestion({
      id: "answered",
      upvotes: 3,
      answer_count: 2,
    });
    const qUnanswered = makeQuestion({
      id: "unanswered",
      upvotes: 3,
      answer_count: 0,
    });

    const ranked = rankQuestions([qAnswered, qUnanswered]);
    expect(ranked[0].id).toBe("unanswered");
    expect(ranked[1].id).toBe("answered");
  });

  it("prioritizes older unanswered questions (waiting longest for help)", () => {
    const qOlder = makeQuestion({
      id: "older",
      answer_count: 0,
      upvotes: 0,
      created_at: new Date("2026-09-08T00:00:00Z").toISOString(),
    });
    const qNewer = makeQuestion({
      id: "newer",
      answer_count: 0,
      upvotes: 0,
      created_at: new Date("2026-09-10T00:00:00Z").toISOString(),
    });

    const ranked = rankQuestions([qNewer, qOlder]);
    expect(ranked[0].id).toBe("older");
    expect(ranked[1].id).toBe("newer");
  });

  it("prioritizes most recent activity for answered questions", () => {
    const qActiveRecent = makeQuestion({
      id: "recent-act",
      answer_count: 2,
      upvotes: 1,
      last_activity_at: new Date("2026-09-12T12:00:00Z").toISOString(),
    });
    const qActiveOlder = makeQuestion({
      id: "older-act",
      answer_count: 3,
      upvotes: 1,
      last_activity_at: new Date("2026-09-11T12:00:00Z").toISOString(),
    });

    const ranked = rankQuestions([qActiveOlder, qActiveRecent]);
    expect(ranked[0].id).toBe("recent-act");
    expect(ranked[1].id).toBe("older-act");
  });

  it("does not mutate the original array", () => {
    const original = [
      makeQuestion({ id: "1", upvotes: 1 }),
      makeQuestion({ id: "2", upvotes: 5 }),
    ];
    const originalCopy = [...original];
    rankQuestions(original);
    expect(original).toEqual(originalCopy);
  });
});
