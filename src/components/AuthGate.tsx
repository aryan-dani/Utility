"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { isAuthPage, isPublicPath, normalizePathname } from "@/lib/authRoutes";

const OnboardingStory = dynamic(
  () =>
    import("@/components/onboarding/OnboardingStory").then((m) => ({
      default: m.OnboardingStory,
    })),
  { ssr: false },
);

/** Offline auth resolve — long enough for IndexedDB, short enough to feel usable. */
const AUTH_OFFLINE_TIMEOUT_MS = 2500;

/**
 * Gate write / accountability surfaces (QA, Ask, planner, notes, clipboard,
 * SRS, community, profile, admin). Read-only vault tools stay public and never
 * block paint on a Firebase Auth round-trip.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = normalizePathname(usePathname());
  const router = useRouter();
  const publicPage = isPublicPath(pathname) || isAuthPage(pathname);
  /** `undefined` = still resolving; only used on private routes. */
  const [uid, setUid] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (publicPage) return;

    let cancelled = false;
    let finished = false;
    let unsub = () => {};
    let timer = 0;

    const finish = (nextUid: string | null) => {
      if (cancelled || finished) return;
      finished = true;
      setUid(nextUid);
    };

    void (async () => {
      const [{ auth }, { onAuthStateChanged }] = await Promise.all([
        import("@/lib/firebase/auth"),
        import("firebase/auth"),
      ]);
      if (cancelled) return;

      unsub = onAuthStateChanged(auth, (user) => {
        finish(user?.uid ?? null);
      });

      void auth.authStateReady().then(() => {
        if (cancelled || finished) return;
        finish(auth.currentUser?.uid ?? null);
      });

      timer = window.setTimeout(() => {
        if (cancelled || finished) return;
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          finish(auth.currentUser?.uid ?? null);
        }
      }, AUTH_OFFLINE_TIMEOUT_MS);
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unsub();
    };
  }, [publicPage]);

  const ready = publicPage || uid !== undefined;
  const locked = ready && !publicPage && !uid;

  useEffect(() => {
    if (!locked) return;
    const next = `${pathname}${window.location.search}`;
    router.replace(`/login?redirectTo=${encodeURIComponent(next)}`);
  }, [locked, pathname, router]);

  const onboarding =
    !publicPage && typeof uid === "string" ? <OnboardingStory /> : null;

  return (
    <>
      {onboarding}
      {children}
    </>
  );
}
