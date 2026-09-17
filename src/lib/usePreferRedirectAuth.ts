"use client";

import { useSyncExternalStore } from "react";
import { preferRedirectAuth } from "@/lib/firebaseAuth";

function subscribe() {
  return () => {};
}

/**
 * Client-only: hide OAuth in Store/PWA shells where Google/GitHub often fail.
 * SSR and first paint stay false to avoid hydration mismatch.
 */
export function usePreferRedirectAuth(): boolean {
  return useSyncExternalStore(subscribe, preferRedirectAuth, () => false);
}
