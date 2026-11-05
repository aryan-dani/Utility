/**
 * Browser client for the home-server API (api.utilityos.tech + campus fallback).
 * Attaches Firebase ID token. Uses a 5-minute circuit breaker in sessionStorage.
 */

const BREAKER_KEY = "utility_server_breaker";
const BREAKER_MS = 5 * 60 * 1000;
const HEALTH_TIMEOUT_MS = 2500;
const JSON_TIMEOUT_MS = 8000;

export function apiOrigins(): string[] {
  const raw =
    process.env.NEXT_PUBLIC_UTILITY_API_ORIGINS ||
    "https://api.utilityos.tech,https://utility-api.aryandani.com";
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function filesOrigins(): string[] {
  const raw =
    process.env.NEXT_PUBLIC_UTILITY_FILES_ORIGINS ||
    "https://files.utilityos.tech,https://utility-files.aryandani.com";
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function breakerOpen(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  const until = Number(sessionStorage.getItem(BREAKER_KEY) || "0");
  return Date.now() < until;
}

function tripBreaker(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(BREAKER_KEY, String(Date.now() + BREAKER_MS));
}

function clearBreaker(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(BREAKER_KEY);
}

export function isUtilityServerLikelyDown(): boolean {
  return breakerOpen();
}

export async function probeUtilityServer(): Promise<boolean> {
  if (breakerOpen()) return false;
  for (const origin of apiOrigins()) {
    try {
      const res = await fetch(`${origin}/health`, {
        signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
        cache: "no-store",
      });
      if (res.ok) {
        clearBreaker();
        return true;
      }
    } catch {
      /* try next */
    }
  }
  tripBreaker();
  return false;
}

async function getIdToken(): Promise<string | null> {
  try {
    const { auth } = await import("@/lib/firebase/auth");
    const user = auth.currentUser;
    if (!user) return null;
    return user.getIdToken();
  } catch {
    return null;
  }
}

export type UtilityFetchOptions = {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
  /** Skip auth header (unused for /v1; reserved). */
  public?: boolean;
};

export async function utilityFetch(
  path: string,
  opts: UtilityFetchOptions = {},
): Promise<Response | null> {
  if (breakerOpen()) return null;
  const token = opts.public ? null : await getIdToken();
  if (!opts.public && !token) return null;

  const timeoutMs = opts.timeoutMs ?? JSON_TIMEOUT_MS;
  let lastResponse: Response | null = null;
  for (const origin of apiOrigins()) {
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      if (opts.body !== undefined) headers["Content-Type"] = "application/json";
      const res = await fetch(`${origin}${path}`, {
        method: opts.method || (opts.body !== undefined ? "POST" : "GET"),
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      // Try the campus fallback when the primary host is sick.
      if (res.status >= 500) {
        lastResponse = res;
        continue;
      }
      clearBreaker();
      return res;
    } catch {
      /* try next origin */
    }
  }
  if (lastResponse) {
    clearBreaker();
    return lastResponse;
  }
  tripBreaker();
  return null;
}

/**
 * Ask stream: home /v1/chat when the index has sources, otherwise the same
 * request against Vercel /api/chat.
 */
export async function groundedChatFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = await getIdToken();
  const headers = new Headers(init?.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const body = init?.body;
  if (!breakerOpen() && token && typeof body === "string") {
    for (const origin of apiOrigins()) {
      try {
        const res = await fetch(`${origin}/v1/chat`, {
          ...init,
          headers,
          body,
          signal: init?.signal ?? AbortSignal.timeout(60_000),
        });
        if (res.headers.get("X-Utility-Source-Count") === "0") break;
        if (res.ok || res.status === 401 || res.status === 429) {
          clearBreaker();
          return res;
        }
      } catch {
        /* try next origin, then Vercel */
      }
    }
  }
  return fetch(input, init);
}

export async function fetchPublicClipboard(id: string): Promise<Response> {
  if (!breakerOpen()) {
    for (const origin of apiOrigins()) {
      try {
        const res = await fetch(`${origin}/public/clipboard/${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        if (res.ok || res.status === 410 || res.status === 404) {
          if (res.ok || res.status === 410) return res;
        }
      } catch {
        /* try vercel */
      }
    }
  }
  return fetch(`/api/clipboard/share/${encodeURIComponent(id)}`, { cache: "no-store" });
}

/** Build a native file URL for a mirrored resource. */
export function nativeFileUrl(
  resourceId: string,
  hash: string,
  ext: string,
): string | null {
  const origins = filesOrigins();
  if (!origins[0]) return null;
  const cleanExt = ext.replace(/^\./, "");
  return `${origins[0]}/r/${encodeURIComponent(resourceId)}/${encodeURIComponent(hash)}.${cleanExt}`;
}

export function allNativeFileUrls(
  resourceId: string,
  hash: string,
  ext: string,
): string[] {
  const cleanExt = ext.replace(/^\./, "");
  return filesOrigins().map(
    (o) =>
      `${o}/r/${encodeURIComponent(resourceId)}/${encodeURIComponent(hash)}.${cleanExt}`,
  );
}
