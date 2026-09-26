import { describe, expect, it } from "vitest";
import {
  routeQuery,
  modelForIntent,
  stripInvalidCitations,
  compactHistory,
} from "@/lib/agent/router";

describe("routeQuery", () => {
  it("detects definition intent", () => {
    expect(routeQuery("What is a B+ tree?").intent).toBe("definition");
  });

  it("detects compare intent", () => {
    expect(routeQuery("Compare TCP vs UDP").intent).toBe("compare");
  });

  it("detects pyq intent", () => {
    expect(routeQuery("Show previous year question paper").intent).toBe("pyq");
  });

  it("detects syllabus intent", () => {
    expect(routeQuery("Show the syllabus for unit 3").intent).toBe("syllabus");
  });

  it("detects locate intent", () => {
    expect(routeQuery("Where can I find the OS notes?").intent).toBe("locate");
  });

  it("detects out_of_scope intent", () => {
    expect(routeQuery("Please write my assignment").intent).toBe(
      "out_of_scope",
    );
  });

  it("detects capability intent without stealing definitions", () => {
    expect(routeQuery("what access do you have in rag").intent).toBe(
      "capability",
    );
    expect(routeQuery("What is a B+ tree?").intent).toBe("definition");
  });
});

describe("modelForIntent", () => {
  it("uses fast for definition/syllabus/locate and chat otherwise", () => {
    expect(modelForIntent("definition")).toBe("fast");
    expect(modelForIntent("syllabus")).toBe("fast");
    expect(modelForIntent("locate")).toBe("fast");
    expect(modelForIntent("capability")).toBe("fast");
    expect(modelForIntent("compare")).toBe("chat");
    expect(modelForIntent("explain")).toBe("chat");
  });
});

describe("stripInvalidCitations", () => {
  it("keeps valid markers and removes invalid ones", () => {
    const valid = new Set(["S1", "S3"]);
    expect(stripInvalidCitations("See [S1] and [S2] then [S3].", valid)).toBe(
      "See [S1] and  then [S3].",
    );
  });
});

describe("compactHistory", () => {
  it("keeps recent turns and truncates content", () => {
    const messages = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: "x".repeat(2500),
    }));
    const compacted = compactHistory(messages, 2);
    expect(compacted).toHaveLength(4);
    expect(compacted.every((m) => m.content.length === 2000)).toBe(true);
    expect(compacted[0].role).toBe("user");
    expect(compacted[1].role).toBe("assistant");
  });
});
