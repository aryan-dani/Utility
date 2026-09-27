"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/auth";
import { isAuthPage, isPublicPath } from "@/lib/authRoutes";

const OnboardingStory = dynamic(
  () =>
    import("@/components/onboarding/OnboardingStory").then((m) => ({
      default: m.OnboardingStory,
    })),
  { ssr: false },
);

function AuthBusy() {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-3 min-h-[60vh]"
      role="status"
      aria-busy="true"
      aria-live="polite"
      aria-label="Sign in required"
    >
      <span className="loading-orb" aria-hidden />
      <p className="text-xs font-medium text-muted tracking-wide">Loading…</p>
    </div>
  );
}

/** Vault, Ask, Planner, Doubt Board, and the other tools need a signed-in user. */
export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setReady(true);
    });
  }, []);

  const publicPage = isPublicPath(pathname) || isAuthPage(pathname);
  const locked = ready && !uid && !publicPage;
  const waiting = !ready && !publicPage;

  useEffect(() => {
    if (!locked) return;
    const next = `${pathname}${window.location.search}`;
    router.replace(`/login?redirectTo=${encodeURIComponent(next)}`);
  }, [locked, pathname, router]);

  const onboarding = uid ? <OnboardingStory /> : null;

  if (publicPage) {
    return (
      <>
        {onboarding}
        {children}
      </>
    );
  }
  if (waiting || locked) {
    return <AuthBusy />;
  }

  return (
    <>
      {onboarding}
      {children}
    </>
  );
}
