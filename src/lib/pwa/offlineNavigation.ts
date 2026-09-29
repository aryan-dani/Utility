/**
 * What to do when a document navigation fails on the custom domain.
 * Cache always wins so visited Planner/Timer/etc. keep working offline.
 */
export type OfflineNavigationAction = "use-cache" | "campus-hop" | "offline-page";

export function decideOfflineNavigation(input: {
  hasCachedDocument: boolean;
  online: boolean;
}): OfflineNavigationAction {
  if (input.hasCachedDocument) return "use-cache";
  if (input.online) return "campus-hop";
  return "offline-page";
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
