import { describe, expect, it } from "vitest";
import { CAMPUS_ORIGIN, CANONICAL_WWW_ORIGIN } from "./siteOrigins";
import {
  CLIPBOARD_MAX_CHARS,
  clipTextLengthOk,
  formatShareCode,
  generateShareId,
  isDriveFileId,
  isShareExpired,
  isValidShareCode,
  normalizeShareCode,
  shareExpiresAt,
  sharePath,
  shareUrls,
} from "./clipboard";

describe("clipboard helpers", () => {
  it("generates distinct 10-char share ids by default", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const id = generateShareId();
      expect(id).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{10}$/);
      ids.add(id);
    }
    expect(ids.size).toBe(200);
  });

  it("still accepts longer legacy share ids", () => {
    const id = generateShareId(10);
    expect(id).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{10}$/);
    expect(isValidShareCode(id)).toBe(true);
    expect(isValidShareCode("ab3km2")).toBe(true);
    expect(isValidShareCode("short")).toBe(false);
  });

  it("normalizes typed codes and builds dual-host URLs", () => {
    expect(normalizeShareCode(" AB3K-M2 ")).toBe("ab3km2");
    expect(formatShareCode("ab3km2")).toBe("ab3k-m2");
    expect(formatShareCode("abcdefghjk")).toBe("abcde-fghjk");
    expect(sharePath("AB3K-M2")).toBe("/clipboard/s/ab3km2");
    expect(shareUrls("ab3km2")).toEqual({
      canonical: `${CANONICAL_WWW_ORIGIN}/clipboard/s/ab3km2`,
      campus: `${CAMPUS_ORIGIN}/clipboard/s/ab3km2`,
    });
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
    expect(isDriveFileId("abc123XYZ0")).toBe(true);
    expect(isDriveFileId("short")).toBe(false);
    const from = Date.parse("2026-09-26T00:00:00.000Z");
    expect(shareExpiresAt(from)).toBe("2026-09-27T00:00:00.000Z");
  });
});
