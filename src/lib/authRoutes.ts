/**
 * Unsigned visitors may browse the vault and other read-only tools.
 * Keep AuthGate on accountability surfaces: doubt board, Ask AI chat, planner,
 * notes, clipboard (non-share), SRS, community, profile, admin.
 */
const PUBLIC_EXACT = new Set([
  "/",
  "/login",
  "/signup",
  "/privacy",
  "/install",
  "/support",
  "/campus",
  "/~offline",
  "/resources",
  "/syllabus",
  "/timer",
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
  if (path === "/resources" || path.startsWith("/resources/")) return true;
  if (path === "/syllabus" || path.startsWith("/syllabus/")) return true;
  if (path === "/timer" || path.startsWith("/timer/")) return true;
  if (path === "/gpa" || path.startsWith("/gpa/")) return true;
  if (path === "/visualize" || path.startsWith("/visualize/")) return true;
  if (path === "/mit-wpu" || path.startsWith("/mit-wpu/")) return true;
  if (path.startsWith("/account/delete")) return true;
  if (path.startsWith("/clipboard/s/")) return true;
  if (path.startsWith("/c/")) return true;
  if (path.startsWith("/campus/")) return true;
  return false;
}

export function isAuthPage(pathname: string): boolean {
  const path = normalizePathname(pathname);
  return path === "/login" || path === "/signup";
}
