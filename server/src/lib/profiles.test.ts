import { describe, expect, it } from "vitest";
import { sanitizeProfilePatch } from "./profiles.js";

describe("sanitizeProfilePatch", () => {
  it("keeps valid fields and normalizes email and branch", () => {
    const patch = sanitizeProfilePatch({
      displayName: "  Aryan  ",
      email: "Aryan@Example.COM",
      photoURL: "https://example.com/p.png",
      provider: "Google Account",
      branch: "aids",
      semester: "5",
      lastActive: "2026-11-24T10:00:00.000Z",
    });
    expect(patch.displayName).toBe("Aryan");
    expect(patch.email).toBe("aryan@example.com");
    expect(patch.photoUrl).toBe("https://example.com/p.png");
    expect(patch.provider).toBe("Google Account");
    expect(patch.branch).toBe("AIDS");
    expect(patch.semester).toBe(5);
    expect(patch.lastActiveAt?.toISOString()).toBe("2026-11-24T10:00:00.000Z");
  });

  it("omits fields that were not sent so a partial update does not clear them", () => {
    const patch = sanitizeProfilePatch({ displayName: "Only name" });
    expect(Object.keys(patch)).toEqual(["displayName"]);
  });

  it("drops malformed values instead of failing the whole profile", () => {
    const patch = sanitizeProfilePatch({
      branch: "BAD BRANCH!",
      semester: 99,
      lastActive: "not a date",
      displayName: 42,
    });
    expect(patch.branch).toBeUndefined();
    expect(patch.semester).toBeUndefined();
    expect(patch.lastActiveAt).toBeUndefined();
    expect(patch.displayName).toBeUndefined();
  });

  it("clears branch, semester, and lastActive when explicitly null", () => {
    const patch = sanitizeProfilePatch({ branch: null, semester: null, lastActive: null });
    expect(patch.branch).toBeNull();
    expect(patch.semester).toBeNull();
    expect(patch.lastActiveAt).toBeNull();
  });

  it("caps long text fields", () => {
    const patch = sanitizeProfilePatch({ displayName: "x".repeat(500) });
    expect(patch.displayName?.length).toBe(120);
  });

  it("accepts non-object input and returns an empty patch", () => {
    expect(sanitizeProfilePatch(null)).toEqual({});
    expect(sanitizeProfilePatch("nope")).toEqual({});
  });
});
