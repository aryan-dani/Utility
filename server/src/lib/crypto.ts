import { timingSafeEqual } from "node:crypto";

/** Constant-time string compare for secrets. */
export function secretsEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    // Still compare to keep timing roughly constant.
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}
