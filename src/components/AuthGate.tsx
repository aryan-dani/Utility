"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { isAuthPage, isPublicPath } from "@/lib/authRoutes";

/** Vault, Ask, Planner, Doubt Board, and the other tools need a signed-in user. */
export function AuthGate() {
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

  const locked = ready && !uid && !isPublicPath(pathname) && !isAuthPage(pathname);

  useEffect(() => {
    if (!locked) return;
    const next = `${pathname}${window.location.search}`;
    router.replace(`/login?redirectTo=${encodeURIComponent(next)}`);
  }, [locked, pathname, router]);

  if (!locked) return null;

  return (
    <div
      className="fixed inset-0 z-modal bg-background"
      aria-busy="true"
      aria-label="Sign in required"
    />
  );
}
