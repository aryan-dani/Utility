/**
 * Server-only client for Vercel → home-server /internal/* calls.
 * Sends X-Utility-Key. Never import this into client components.
 */

const TIMEOUT_MS = 4000;

function apiUrl(): string {
  return (
    process.env.UTILITY_API_URL ||
    "https://api.utilityos.tech"
  ).replace(/\/$/, "");
}

export async function utilityInternalFetch(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<Response | null> {
  const secret = process.env.UTILITY_API_SECRET;
  if (!secret) return null;
  try {
    return await fetch(`${apiUrl()}${path}`, {
      method: init.method || (init.body !== undefined ? "POST" : "GET"),
      headers: {
        "X-Utility-Key": secret,
        ...(init.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return null;
  }
}

export async function triggerServerSync(
  mode: "incremental" | "full" = "incremental",
): Promise<boolean> {
  const res = await utilityInternalFetch("/internal/sync", {
    method: "POST",
    body: { mode },
  });
  return Boolean(res?.ok);
}

export async function purgeServerUser(uid: string): Promise<boolean> {
  const res = await utilityInternalFetch("/internal/purge-user", {
    method: "POST",
    body: { uid },
  });
  return Boolean(res?.ok);
}
