type Bucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, Bucket>();

function memoryLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

/**
 * Upstash Redis REST sliding window when UPSTASH_REDIS_REST_URL + TOKEN are set.
 * Falls back to in-memory (per-instance) otherwise - fine for local/dev.
 */
async function upstashLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterSec: number } | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;

  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const redisKey = `rl:${key}`;

  try {
    // INCR + EXPIRE via pipeline
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["EXPIRE", redisKey, String(windowSec), "NX"],
        ["TTL", redisKey],
      ]),
      cache: "no-store",
    });

    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ result: number }>;
    const count = Number(data?.[0]?.result ?? 0);
    const ttl = Number(data?.[2]?.result ?? windowSec);
    if (count > limit) {
      return {
        allowed: false,
        retryAfterSec: Math.max(1, ttl > 0 ? ttl : windowSec),
      };
    }
    return { allowed: true, retryAfterSec: 0 };
  } catch {
    return null;
  }
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const remote = await upstashLimit(key, limit, windowMs);
  if (remote) return remote;
  return memoryLimit(key, limit, windowMs);
}

export async function enforceUserRateLimit(
  uid: string,
  route: string,
  limit = 30,
  windowMs = 60_000,
) {
  return checkRateLimit(`${route}:${uid}`, limit, windowMs);
}

/**
 * AI routes: in Vercel production, require Upstash (no silent in-memory fallback).
 * Local/preview may fall back to checkRateLimit (memory or Upstash if configured).
 */
export async function enforceAiRateLimit(
  uid: string,
  route: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterSec: number; unavailable?: boolean }> {
  if (process.env.VERCEL_ENV === "production") {
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
    if (!url || !token) {
      return { allowed: false, retryAfterSec: 60, unavailable: true };
    }
  }
  return checkRateLimit(`${route}:${uid}`, limit, windowMs);
}
