import { localDateKey } from "@/lib/dateLocal";

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type ParsedTask = {
  text: string;
  date: string;
  label: string;
};

function nextWeekday(now: Date, target: number): Date {
  const next = new Date(now);
  next.setHours(12, 0, 0, 0);
  const delta = (target - now.getDay() + 7) % 7;
  next.setDate(now.getDate() + delta);
  return next;
}

/** Pull "by Friday" / "on tomorrow" out of a planner phrase. */
export function parseTaskWhen(input: string, now = new Date()): ParsedTask {
  const trimmed = input.trim();
  const match = trimmed.match(
    /\b(?:by|on)\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  );
  if (!match) {
    return { text: trimmed, date: localDateKey(now), label: "today" };
  }
  const word = match[1].toLowerCase();
  let when = new Date(now);
  if (word === "tomorrow") {
    when = new Date(now);
    when.setDate(now.getDate() + 1);
  } else if (word !== "today") {
    const index = WEEKDAYS.indexOf(word as (typeof WEEKDAYS)[number]);
    when = nextWeekday(now, index);
  }
  const text = trimmed.replace(match[0], "").replace(/\s{2,}/g, " ").trim();
  return {
    text: text || trimmed,
    date: localDateKey(when),
    label: word,
  };
}
