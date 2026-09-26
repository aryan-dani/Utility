/** One Firestore doc per user (`clipboards/{uid}`). Spark-friendly. */
import { CAMPUS_ORIGIN, CANONICAL_WWW_ORIGIN } from "@/lib/siteOrigins";

export const CLIPBOARD_MAX_CHARS = 32_000;
export const CLIPBOARD_SHARE_TTL_MS = 24 * 60 * 60 * 1000;
export const CLIPBOARD_COLLECTION = "clipboards";
export const CLIPBOARD_SHARES_COLLECTION = "clipboard_shares";

const SHARE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const SHARE_ID_RE = /^[abcdefghjkmnpqrstuvwxyz23456789]{6,16}$/;

export function generateShareId(length = 6): string {
  const buf = new Uint8Array(length);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < length; i += 1) {
      buf[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(buf, (b) => SHARE_ALPHABET[b % SHARE_ALPHABET.length]).join(
    "",
  );
}

export function normalizeShareCode(raw: string): string {
  return raw.toLowerCase().replace(/[^abcdefghjkmnpqrstuvwxyz23456789]/g, "");
}

export function isValidShareCode(raw: string): boolean {
  return SHARE_ID_RE.test(normalizeShareCode(raw));
}

/** Group a 6-char id as `ab3k-m2` so it is easier to read aloud. */
export function formatShareCode(raw: string): string {
  const id = normalizeShareCode(raw);
  if (id.length === 6) return `${id.slice(0, 4)}-${id.slice(4)}`;
  if (id.length === 10) return `${id.slice(0, 5)}-${id.slice(5)}`;
  if (id.length > 4) return `${id.slice(0, 4)}-${id.slice(4)}`;
  return id;
}

export function sharePath(raw: string): string {
  return `/clipboard/s/${normalizeShareCode(raw)}`;
}

export function shareUrls(raw: string): { canonical: string; campus: string } {
  const path = sharePath(raw);
  return {
    canonical: `${CANONICAL_WWW_ORIGIN}${path}`,
    campus: `${CAMPUS_ORIGIN}${path}`,
  };
}

export function isShareExpired(expiresAt: string | null | undefined, now = Date.now()): boolean {
  if (!expiresAt) return true;
  const ms = Date.parse(expiresAt);
  if (Number.isNaN(ms)) return true;
  return ms <= now;
}

export function shareExpiresAt(from = Date.now()): string {
  return new Date(from + CLIPBOARD_SHARE_TTL_MS).toISOString();
}

export function clipTextLengthOk(text: string): boolean {
  return text.length <= CLIPBOARD_MAX_CHARS;
}

const DRIVE_FILE_ID_RE = /^[a-zA-Z0-9_-]{10,128}$/;

export function isDriveFileId(id: string | null | undefined): id is string {
  return typeof id === "string" && DRIVE_FILE_ID_RE.test(id);
}
