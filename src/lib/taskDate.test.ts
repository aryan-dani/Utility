import { describe, expect, it } from "vitest";
import { parseTaskWhen } from "@/lib/taskDate";

describe("parseTaskWhen", () => {
  const friday = new Date(2026, 9, 16);

  it("keeps an undated task on today", () => {
    const parsed = parseTaskWhen("finish CN lab writeup", friday);
    expect(parsed.date).toBe("2026-10-16");
    expect(parsed.text).toBe("finish CN lab writeup");
    expect(parsed.label).toBe("today");
  });

  it("schedules by Friday on that weekday", () => {
    const parsed = parseTaskWhen("finish CN lab writeup by Friday", friday);
    expect(parsed.date).toBe("2026-10-16");
    expect(parsed.text).toBe("finish CN lab writeup");
    expect(parsed.label).toBe("friday");
  });

  it("schedules tomorrow", () => {
    const parsed = parseTaskWhen("revise OS on tomorrow", friday);
    expect(parsed.date).toBe("2026-10-17");
    expect(parsed.text).toBe("revise OS");
  });
});
