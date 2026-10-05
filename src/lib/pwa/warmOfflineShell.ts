import {
  OFFLINE_WARM_PATHS,
  offlineWarmStorageKey,
  shouldWarmOfflineShell,
} from "@/lib/pwa/offlineNavigation";

const PAGES_CACHE = "pages";

/**
 * Fetch local-tool HTML once per controlling service worker and store it in
 * the Workbox pages cache so those routes open with no network.
 * HTML only — no Drive files, no /api.
 */
export async function warmOfflineLocalToolPages(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("caches" in window)) return;
  if (!navigator.onLine) return;

  const controller = navigator.serviceWorker.controller;
  const scriptUrl = controller?.scriptURL;
  if (!scriptUrl) return;

  const key = offlineWarmStorageKey(scriptUrl);
  let alreadyWarmed = false;
  try {
    alreadyWarmed = localStorage.getItem(key) === "1";
  } catch {
    /* private mode — still warm this session */
  }
  if (!shouldWarmOfflineShell(scriptUrl, alreadyWarmed)) return;

  try {
    const cache = await caches.open(PAGES_CACHE);
    await Promise.allSettled(
      OFFLINE_WARM_PATHS.map(async (path) => {
        const url = new URL(path, window.location.origin).href;
        // Default HTTP cache — ISR HTML can be a CDN hit. Do not cache: "reload"
        // (that forces Cache-Control: no-cache and burns Fast Origin Transfer).
        const res = await fetch(url, {
          credentials: "same-origin",
        });
        if (!res.ok) return;
        await cache.put(url, res.clone());
        await cache.put(path, res.clone());
      }),
    );
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }
  } catch (err) {
    console.warn("[utility] offline shell warm failed", err);
  }
}
