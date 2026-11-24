import { localDateKey } from "@/lib/dateLocal";
import { utilityFetch } from "@/lib/utilityServer";

export type ProfileSyncFields = {
  displayName?: string;
  email?: string;
  photoURL?: string;
  provider?: string;
  branch?: string | null;
  semester?: number | null;
  academic_year?: string | null;
  workspace_scope_version?: number;
  onboarding_completed_at?: string | null;
  lastActive?: string;
};

/** The caller's profile and academic preferences as the home server stores them. */
export type HomeProfile = {
  exists: boolean;
  displayName?: string;
  email?: string;
  photoURL?: string;
  provider?: string;
  branch?: string | null;
  semester?: number | null;
  academicYear?: string | null;
  workspaceScopeVersion?: number | null;
  onboardingCompletedAt?: string | null;
  lastActive?: string | null;
  updatedAt?: string | null;
};

/**
 * Writes profile fields to the home server. Returns false when home did not accept the
 * write, so callers that must not lose data (onboarding) can show an error.
 */
export async function syncProfileToHome(fields: ProfileSyncFields): Promise<boolean> {
  try {
    const res = await utilityFetch("/v1/profile", {
      method: "POST",
      body: fields,
      timeoutMs: 4000,
    });
    return !!res?.ok;
  } catch {
    return false;
  }
}

/** Reads the caller's profile from home. Null when home is unreachable. */
export async function fetchHomeProfile(): Promise<HomeProfile | null> {
  try {
    const res = await utilityFetch("/v1/profile", { timeoutMs: 6000 });
    if (!res?.ok) return null;
    return (await res.json()) as HomeProfile;
  } catch {
    return null;
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
