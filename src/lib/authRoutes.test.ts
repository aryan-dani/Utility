import { describe, expect, it } from "vitest";
import { isAuthPage, isPublicPath } from "./authRoutes";

describe("authRoutes", () => {
  it("keeps marketing, legal, campus, and share links public", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath("/campus")).toBe(true);
    expect(isPublicPath("/campus/seating")).toBe(true);
    expect(isPublicPath("/clipboard/s/ab3km2")).toBe(true);
    expect(isPublicPath("/resources")).toBe(false);
    expect(isPublicPath("/qa")).toBe(false);
    expect(isPublicPath("/community")).toBe(false);
    expect(isPublicPath("/ask")).toBe(false);
    expect(isPublicPath("/clipboard")).toBe(false);
  });

  it("recognizes auth pages", () => {
    expect(isAuthPage("/login")).toBe(true);
    expect(isAuthPage("/signup")).toBe(true);
    expect(isAuthPage("/planner")).toBe(false);
  });
});
