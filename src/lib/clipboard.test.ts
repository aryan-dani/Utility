import { describe, expect, it } from "vitest";
import {
  CLIPBOARD_MAX_CHARS,
  clipTextLengthOk,
  generateShareId,
  isShareExpired,
  shareExpiresAt,
} from "./clipboard";

describe("clipboard helpers", () => {
  it("generates distinct share ids of the requested length", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const id = generateShareId(10);
      expect(id).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{10}$/);
      ids.add(id);
    }
    expect(ids.size).toBe(200);
  });

  it("treats missing or past expiry as expired", () => {
    expect(isShareExpired(null)).toBe(true);
    expect(isShareExpired("not-a-date")).toBe(true);
    expect(isShareExpired(new Date(Date.now() - 1000).toISOString())).toBe(true);
    expect(isShareExpired(new Date(Date.now() + 60_000).toISOString())).toBe(false);
  });

  it("caps clipboard text and sets a 24h expiry", () => {
    expect(clipTextLengthOk("ok")).toBe(true);
    expect(clipTextLengthOk("x".repeat(CLIPBOARD_MAX_CHARS))).toBe(true);
    expect(clipTextLengthOk("x".repeat(CLIPBOARD_MAX_CHARS + 1))).toBe(false);
    const from = Date.parse("2026-09-26T00:00:00.000Z");
    expect(shareExpiresAt(from)).toBe("2026-09-27T00:00:00.000Z");
  });
});
