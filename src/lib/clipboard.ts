/** One Firestore doc per user (`clipboards/{uid}`). Spark-friendly. */
export const CLIPBOARD_MAX_CHARS = 32_000;
export const CLIPBOARD_SHARE_TTL_MS = 24 * 60 * 60 * 1000;
export const CLIPBOARD_COLLECTION = "clipboards";
export const CLIPBOARD_SHARES_COLLECTION = "clipboard_shares";

const SHARE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateShareId(length = 10): string {
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
