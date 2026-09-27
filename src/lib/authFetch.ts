"use client";

import { auth } from "@/lib/firebase/auth";

/** Attach a fresh Bearer token when a user is signed in. */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};
  try {
    const idToken = await user.getIdToken();
    return { Authorization: `Bearer ${idToken}` };
  } catch {
    return {};
  }
}

/**
 * fetch() with Firebase ID token attached when signed in.
 * On 401, refreshes the token once and retries.
 * If no user, fetches without an Authorization header.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const user = auth.currentUser;
  const headers = new Headers(init?.headers);

  if (user) {
    try {
      const idToken = await user.getIdToken();
      headers.set("Authorization", `Bearer ${idToken}`);
    } catch {
      // proceed without auth header
    }
  }

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401 && user) {
    try {
      const fresh = await user.getIdToken(true);
      headers.set("Authorization", `Bearer ${fresh}`);
      return fetch(input, { ...init, headers });
    } catch {
      return res;
    }
  }

  return res;
}
