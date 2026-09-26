"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import {
  consumeRedirectResult,
  getPendingMergeStep,
  preferRedirectAuth,
  takeRememberedRedirectTo,
} from "@/lib/firebaseAuth";
import { sanitizeRedirectTo } from "@/lib/workspace";

function go(path: string, replace: (url: string) => void) {
  const next = sanitizeRedirectTo(path);
  if (preferRedirectAuth()) {
    window.location.replace(next);
    return;
  }
  replace(next);
}

/**
 * Leave /login or /signup as soon as Firebase has a user.
 * Do not wait for getRedirectResult — it can hang in the Store WebView.
 */
export function useLeaveAuthPage(redirectTo: string) {
  const router = useRouter();
  const left = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const leave = (target: string) => {
      if (cancelled || left.current) return;
      if (getPendingMergeStep()) return;
      left.current = true;
      go(target, (url) => router.replace(url));
    };

    const unsub = auth.onAuthStateChanged((user) => {
      if (!user || getPendingMergeStep()) return;
      leave(takeRememberedRedirectTo() || redirectTo);
    });

    (async () => {
      try {
        const outcome = await consumeRedirectResult(auth);
        if (cancelled) return;
        if (
          outcome.status === "needs-github-confirm" ||
          outcome.status === "needs-google-confirm"
        ) {
          left.current = true;
          go("/profile", (url) => router.replace(url));
          return;
        }
        if (
          outcome.status === "linked" ||
          outcome.status === "reauthed" ||
          auth.currentUser
        ) {
          leave(takeRememberedRedirectTo() || redirectTo);
        }
      } catch {
        if (auth.currentUser) leave(redirectTo);
      }
    })();

    return () => {
      cancelled = true;
      unsub();
    };
  }, [redirectTo, router]);
}
