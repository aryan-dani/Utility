"use client";

import { useSyncExternalStore } from "react";
import { preferRedirectAuth } from "@/lib/firebaseAuth";

function subscribe() {
  return () => {};
}

/**
 * Client-only: true in Store / installed PWA / WebView shells where OAuth
 * must use full-page redirect instead of popups.
 * SSR and first paint stay false to avoid hydration mismatch.
 */
export function usePreferRedirectAuth(): boolean {
  return useSyncExternalStore(subscribe, preferRedirectAuth, () => false);
}
