/**
 * Collision-free ID generation for client-side entities (decks, cards, tasks, sessions).
 *
 * Uses `crypto.randomUUID()` which is available in all modern browsers and Node ≥ 19.
 * Falls back to `crypto.getRandomValues()` for environments that support the Web Crypto
 * API but not `randomUUID()` (e.g. non-secure contexts in older browsers).
 *
 * Unlike `Math.random().toString(36)` this produces cryptographically random output
 * with zero practical collision risk.
 */

export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Fallback: 9 random hex chars from getRandomValues (matches old ID length)
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buf = new Uint8Array(5);
    crypto.getRandomValues(buf);
    return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, 9);
  }

  // Last resort (should never hit in practice - keep for SSR edge cases)
  return Math.random().toString(36).slice(2, 11);
}
