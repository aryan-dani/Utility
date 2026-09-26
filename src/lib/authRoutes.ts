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

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (pathname.startsWith("/account/delete")) return true;
  if (pathname.startsWith("/clipboard/s/")) return true;
  if (pathname.startsWith("/campus/")) return true;
  return false;
}

export function isAuthPage(pathname: string): boolean {
  return pathname === "/login" || pathname === "/signup";
}
