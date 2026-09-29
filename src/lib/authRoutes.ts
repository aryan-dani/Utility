/** Unsigned visitors may only see legal, install, campus hop, and inbound shares. */
const PUBLIC_EXACT = new Set([
  "/",
  "/login",
  "/signup",
  "/privacy",
  "/install",
  "/campus",
  "/~offline",
]);

/**
 * Production prerender encodes app/page.tsx as the segment "index", so the
 * server-side PathnameContext is "/index" while the browser uses "/".
 * Normalize before any public/active-route check so SSR and hydration match.
 */
export function normalizePathname(
  pathname: string | null | undefined,
): string {
  if (!pathname || pathname === "/index") return "/";
  return pathname;
}

export function isPublicPath(pathname: string): boolean {
  const path = normalizePathname(pathname);
  if (PUBLIC_EXACT.has(path)) return true;
  if (path.startsWith("/account/delete")) return true;
  if (path.startsWith("/clipboard/s/")) return true;
  if (path.startsWith("/campus/")) return true;
  return false;
}

export function isAuthPage(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return path === "/login" || path === "/signup";
}
