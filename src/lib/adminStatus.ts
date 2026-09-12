"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_PREFIX = "utility-admin-status:";

type AdminStatus = { isAdmin: boolean; email: string | null };

type CachedAdminStatus = AdminStatus & { fetchedAt: number };

function cacheKey(uid: string): string {
  return `${CACHE_PREFIX}${uid}`;
}

function readCache(uid: string): AdminStatus | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedAdminStatus;
    if (
      typeof parsed?.fetchedAt !== "number" ||
      Date.now() - parsed.fetchedAt > CACHE_TTL_MS
    ) {
      sessionStorage.removeItem(cacheKey(uid));
      return null;
    }
    return { isAdmin: !!parsed.isAdmin, email: parsed.email ?? null };
  } catch {
    return null;
  }
}

function writeCache(uid: string, status: AdminStatus): void {
  try {
    const payload: CachedAdminStatus = { ...status, fetchedAt: Date.now() };
    sessionStorage.setItem(cacheKey(uid), JSON.stringify(payload));
  } catch {
    // sessionStorage may be unavailable; ignore
  }
}

/**
 * Calls /api/admin/me once per session (1h TTL), keyed by uid.
 */
export async function fetchAdminStatus(
  getIdToken: () => Promise<string>,
  uid: string,
): Promise<AdminStatus> {
  const cached = readCache(uid);
  if (cached) return cached;

  const token = await getIdToken();
  const res = await fetch("/api/admin/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const status: AdminStatus = { isAdmin: false, email: null };
    writeCache(uid, status);
    return status;
  }
  const data = (await res.json()) as { isAdmin?: boolean; email?: string | null };
  const status: AdminStatus = {
    isAdmin: !!data.isAdmin,
    email: data.email ?? null,
  };
  writeCache(uid, status);
  return status;
}

/**
 * React hook to observe and query the current user's admin status.
 */
export function useAdminStatus(): { isAdmin: boolean; loading: boolean; email: string | null } {
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (!cancelled) {
          setIsAdmin(false);
          setEmail(null);
          setLoading(false);
        }
        return;
      }
      try {
        const status = await fetchAdminStatus(
          () => user.getIdToken(),
          user.uid,
        );
        if (!cancelled) {
          setIsAdmin(status.isAdmin);
          setEmail(status.email);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setIsAdmin(false);
          setEmail(null);
          setLoading(false);
        }
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return { isAdmin, loading, email };
}
