"use client";

import { useIsClient, useMediaQuery } from "@/lib/clientHooks";

/**
 * True in an installed PWA, TWA (Play), or iOS home-screen web app.
 * SSR and the first client paint are false to avoid hydration mismatch.
 */
export function useIsStandalone(): boolean {
  const ready = useIsClient();
  const standalone = useMediaQuery("(display-mode: standalone)");
  const fullscreen = useMediaQuery("(display-mode: fullscreen)");
  const overlay = useMediaQuery("(display-mode: window-controls-overlay)");

  if (!ready) return false;

  const iosStandalone = Boolean(
    (navigator as Navigator & { standalone?: boolean }).standalone,
  );
  const twa = document.referrer.startsWith("android-app://");

  return standalone || fullscreen || overlay || iosStandalone || twa;
}
