import { localDateKey } from "@/lib/dateLocal";
import { utilityFetch } from "@/lib/utilityServer";

export type ProfileSyncFields = {
  displayName?: string;
  email?: string;
  photoURL?: string;
  provider?: string;
  branch?: string | null;
  semester?: number | null;
  lastActive?: string;
};

/**
 * Mirrors profile fields to the home server so admin stats and the users tab can be
 * computed there. Best effort: sign-in and the profile page retry it.
 */
export async function syncProfileToHome(fields: ProfileSyncFields): Promise<void> {
  try {
    await utilityFetch("/v1/profile", {
      method: "POST",
      body: fields,
      timeoutMs: 4000,
    });
  } catch {
    /* admin mirror only; a later sign-in or save sends it again */
  }
}

/** Sign-in path: at most one mirror write per user per browser per day. */
export function syncProfileOncePerDay(uid: string, fields: ProfileSyncFields): void {
  if (typeof window === "undefined") return;
  const key = `utility_profile_synced:${uid}`;
  const today = localDateKey();
  if (window.localStorage.getItem(key) === today) return;
  window.localStorage.setItem(key, today);
  void syncProfileToHome(fields);
}
