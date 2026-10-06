import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const braces = require("braces") as (
  input: string,
  options?: { expand?: boolean },
) => string[];

describe("braces depth guard", () => {
  it("expands ordinary glob patterns", () => {
    expect(braces("a/{b,c}/d")).toEqual(["a/(b|c)/d"]);
    expect(braces("{a,b}{1..2}", { expand: true })).toEqual([
      "a1",
      "a2",
      "b1",
      "b2",
    ]);
  });

  it("rejects nesting that would overflow the call stack", () => {
    const pattern = `${"{".repeat(120)}a${"}".repeat(120)}`;
    expect(() => braces(pattern)).toThrow(/max depth/);
  });
});
