import { describe, expect, it } from "vitest";
import { secretsEqual } from "../lib/crypto.js";

describe("secretsEqual", () => {
  it("matches equal secrets", () => {
    expect(secretsEqual("abc123secret!!", "abc123secret!!")).toBe(true);
  });
  it("rejects unequal secrets", () => {
    expect(secretsEqual("abc123secret!!", "abc123secret!?")).toBe(false);
  });
  it("rejects different lengths", () => {
    expect(secretsEqual("short", "muchlongersecret")).toBe(false);
  });
});
