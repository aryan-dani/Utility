import { describe, expect, it } from "vitest";
import { soonestExamFromRecords } from "./examCountdown";

describe("soonestExamFromRecords", () => {
  const now = new Date(2026, 10, 5);

  it("picks the soonest open exam and skips finished ones", () => {
    const exam = soonestExamFromRecords(
      [
        {
          "2026-11-04": [{ id: "past", text: "Past exam", done: false }],
          "2026-11-20": [{ id: "later", text: "End exam", done: false }],
          "2026-11-08": [
            { id: "done", text: "Mid exam", done: true },
            { id: "next", text: "Quiz exam", done: false },
          ],
        },
      ],
      now,
    );
    expect(exam).toEqual({
      date: "2026-11-08",
      text: "Quiz exam",
      daysUntil: 3,
    });
  });

  it("ignores tasks that are not exams", () => {
    expect(
      soonestExamFromRecords(
        [{ "2026-11-06": [{ id: "a", text: "Read notes", done: false }] }],
        now,
      ),
    ).toBeNull();
  });
});
