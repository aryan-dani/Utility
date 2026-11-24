import { apiOrigins } from "@/lib/utilityServer";

const PROXY_TIMEOUT_MS = 8000;

/**
 * Server-side GET to the home server with the caller's bearer token. Used for admin
 * views that are computed from Postgres. Returns null when no origin answers.
 */
export async function proxyAdminGet(request: Request, path: string): Promise<Response | null> {
  const authorization = request.headers.get("authorization") ?? "";
  for (const origin of apiOrigins()) {
    try {
      const res = await fetch(`${origin}${path}`, {
        headers: { Authorization: authorization },
        cache: "no-store",
        signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      });
      if (res.status >= 500) continue;
      return res;
    } catch {
      /* try the next origin */
    }
  }
  return null;
}

/** Internal POST to the home server, authenticated with the shared secret. Best effort. */
export async function callHomeInternal(path: string, body: unknown): Promise<boolean> {
  const secret = process.env.UTILITY_API_SECRET;
  if (!secret) return false;
  for (const origin of apiOrigins()) {
    try {
      const res = await fetch(`${origin}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-utility-key": secret },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      });
      if (res.ok) return true;
    } catch {
      /* try the next origin */
    }
  }
  return false;
}
