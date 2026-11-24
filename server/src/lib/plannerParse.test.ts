import { describe, expect, it } from "vitest";
import { buildPlannerSystemPrompt, parsePlannerJson } from "./plannerParse.js";

describe("parsePlannerJson", () => {
  it("parses plain JSON", () => {
    expect(parsePlannerJson('[{"date":"2026-05-01","tasks":[]}]')).toEqual([
      { date: "2026-05-01", tasks: [] },
    ]);
  });

  it("strips markdown fences before parsing", () => {
    expect(parsePlannerJson("```json\n[]\n```")).toEqual([]);
  });

  it("returns undefined for output that is not JSON", () => {
    expect(parsePlannerJson("Sorry, I cannot help with that.")).toBeUndefined();
  });
});

describe("buildPlannerSystemPrompt", () => {
  it("names the context month and year", () => {
    const prompt = buildPlannerSystemPrompt(5, 2026);
    expect(prompt).toContain("Current Month: May (Month number: 5)");
    expect(prompt).toContain("Current Year: 2026");
    expect(prompt).toContain('"2026-05-27"');
  });
});
