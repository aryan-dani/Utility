'use client';

import { useEffect } from 'react';

const BUST_KEY = "utility-sw-bust";
const BUST_VER = "2026-09-08-hydration-safari";

async function clearNonPdfCaches() {
  if (!("caches" in window)) return;
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key !== "utility-pdf-v2" && !key.startsWith("utility-pdf"))
      .map((key) => caches.delete(key)),
  );
}

/** If the offline route is shown while the browser is online, the SW App Shell is stale. */
export default function OfflineRecovery() {
  useEffect(() => {
    if (!navigator.onLine) return;

    let cancelled = false;

    (async () => {
      try {
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        await clearNonPdfCaches();
        try {
          localStorage.setItem(BUST_KEY, BUST_VER);
        } catch {
          /* ignore */
        }
        if (!cancelled) {
          window.location.replace("/");
        }
      } catch (err) {
        console.error("Offline recovery failed:", err);
        if (!cancelled) window.location.reload();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <p className="text-xs text-muted mt-4">
      You appear to be online. Recovering a fresh copy of the app…
    </p>
  );
}
