/**
 * What to do when a document navigation fails on the custom domain.
 * While online, prefer the campus host — a cached shell of utilityos.tech is
 * useless when Sophos TLS inspection blocks the origin. Cache only when offline.
 */
export type OfflineNavigationAction = "use-cache" | "campus-hop" | "offline-page";

export function decideOfflineNavigation(input: {
  hasCachedDocument: boolean;
  online: boolean;
}): OfflineNavigationAction {
  if (input.online) return "campus-hop";
  if (input.hasCachedDocument) return "use-cache";
  return "offline-page";
}

/**
 * Paths the campus companion SW must not `respondWith`.
 * Mirrored in `public/campus-nav-sw.js` — keep in sync.
 * Firebase popup/redirect handlers need Workbox NetworkOnly (or the browser)
 * so the opener can finish the handshake and close the window promptly.
 */
export function shouldBypassCampusNavigation(pathname: string): boolean {
  if (pathname.startsWith("/__/auth")) return true;
  if (pathname === "/login" || pathname === "/signup") return true;
  return false;
}

/** HTML routes to warm once per service worker so they open offline. */
export const OFFLINE_WARM_PATHS = [
  "/planner",
  "/timer",
  "/gpa",
  "/srs",
  "/syllabus",
  "/visualize",
] as const;

export const OFFLINE_WARM_STORAGE_PREFIX = "utility-offline-warm:";

export function offlineWarmStorageKey(scriptUrl: string): string {
  return `${OFFLINE_WARM_STORAGE_PREFIX}${scriptUrl}`;
}

export function shouldWarmOfflineShell(
  scriptUrl: string | null | undefined,
  alreadyWarmed: boolean,
): boolean {
  return Boolean(scriptUrl) && !alreadyWarmed;
}
