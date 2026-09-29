"use client";

import { useEffect, useRef } from "react";
import { auth } from "@/lib/firebase/auth";
import {
  consumeRedirectResult,
  getPendingMergeStep,
  takeRememberedRedirectTo,
} from "@/lib/firebaseAuth";
import { sanitizeRedirectTo } from "@/lib/workspace";

/**
 * Leave /login or /signup as soon as Firebase has a user.
 * Always hard-navigate after OAuth return — Next soft replace can stay on
 * /login in the Store WebView. Do not wait for getRedirectResult alone; it
 * can hang, but start it early (see firebase/auth.ts) and race auth state.
 */
export function useLeaveAuthPage(redirectTo: string) {
  const left = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const leave = (target: string) => {
      if (cancelled || left.current) return;
      if (getPendingMergeStep()) return;
      left.current = true;
      window.location.replace(sanitizeRedirectTo(target));
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
          window.location.replace("/profile");
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
  }, [redirectTo]);
}
