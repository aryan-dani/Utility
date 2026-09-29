"use client";

import { useLayoutEffect, useState } from "react";
import { auth } from "@/lib/firebase/auth";
import {
  clearPendingSignInProvider,
  consumeRedirectResult,
  peekPendingSignInProvider,
} from "@/lib/firebaseAuth";

type Provider = "google" | "github";

/**
 * True when OAuth redirect just returned and Firebase is still finishing.
 * Only mounts the finishing screen while getRedirectResult is outstanding so a
 * stale intent does not flash the spinner before the form.
 */
export function usePendingOAuthReturn(): Provider | null {
  const [provider, setProvider] = useState<Provider | null>(null);

  useLayoutEffect(() => {
    const pending = peekPendingSignInProvider();
    if (!pending) return;

    let cancelled = false;
    // Show after a macrotask so an already-resolved redirect does not paint.
    const showTimer = window.setTimeout(() => {
      if (!cancelled) setProvider(pending);
    }, 0);

    void consumeRedirectResult(auth).then((outcome) => {
      window.clearTimeout(showTimer);
      if (cancelled) return;
      if (
        outcome.status === "none" ||
        outcome.status === "error" ||
        outcome.status === "needs-github-confirm" ||
        outcome.status === "needs-google-confirm"
      ) {
        clearPendingSignInProvider();
        setProvider(null);
      }
      // linked / reauthed: keep finishing until useLeaveAuthPage navigates.
    });

    return () => {
      cancelled = true;
      window.clearTimeout(showTimer);
    };
  }, []);

  return provider;
}

export function OAuthFinishingScreen({
  provider,
}: {
  provider: Provider;
}) {
  const label = provider === "google" ? "Google" : "GitHub";
  return (
    <div
      className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
      aria-label={`Finishing ${label} sign-in`}
    >
      <span className="loading-orb" aria-hidden />
      <p className="text-xs font-medium text-muted tracking-wide">
        Finishing {label} sign-in…
      </p>
    </div>
  );
}
