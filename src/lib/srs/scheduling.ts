import { localDateKey } from "@/lib/dateLocal";

const INTERVALS = [1, 2, 4, 7, 14]; // Box 1 = 1 day, Box 2 = 2 days, etc.

/** Compute the next review date for a Leitner box using local calendar days. */
export function computeNextReview(box: number, fromDate?: Date): string {
  const days = INTERVALS[Math.min(box - 1, INTERVALS.length - 1)] || 1;
  const d = fromDate ? new Date(fromDate) : new Date();
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

export interface GradeableCard {
  box: number;
}

export interface GradeResult {
  box: number;
  nextReview: string;
}

export type GradeChoice = "hard" | "good" | "easy";

/** Apply a Leitner grade. `true` is Good, `false` is Hard. Easy jumps two boxes. */
export function applyGrade(
  card: GradeableCard,
  grade: boolean | GradeChoice,
  today?: Date,
): GradeResult {
  const todayKey = localDateKey(today ?? new Date());
  const choice: GradeChoice =
    grade === true ? "good" : grade === false ? "hard" : grade;
  if (choice === "hard") {
    return { box: 1, nextReview: todayKey };
  }
  const jump = choice === "easy" ? 2 : 1;
  const nextBox = Math.min(card.box + jump, 5);
  return {
    box: nextBox,
    nextReview: computeNextReview(nextBox, today),
  };
}
