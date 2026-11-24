import { eq, sql } from "drizzle-orm";
import type { getDb } from "../db/client.js";
import { migrateCheckpoint, resourceUsage, userProfiles } from "../db/schema.js";
import { adminFirestore } from "./firebase.js";

type Db = ReturnType<typeof getDb>;

/** Columns the admin views read. Every field is optional so a patch only touches what it sends. */
export type ProfilePatch = {
  displayName?: string;
  email?: string;
  photoUrl?: string;
  provider?: string;
  branch?: string | null;
  semester?: number | null;
  academicYear?: string | null;
  workspaceScopeVersion?: number | null;
  onboardingCompletedAt?: Date | null;
  lastActiveAt?: Date | null;
};

const ACADEMIC_YEAR = /^\d{4}-\d{4}$/;

/** Reads a Firestore-style or client-style timestamp into a Date, or null when empty. */
function parseWhen(value: unknown): Date | null {
  if (value === null || value === "" || value === undefined) return null;
  const when = new Date(value as string);
  return Number.isNaN(when.getTime()) ? null : when;
}

function clipText(value: unknown, max: number): string | undefined {
  return typeof value === "string" ? value.trim().slice(0, max) : undefined;
}

/**
 * Accepts the client/Firestore shape and keeps only sane values. Anything malformed is
 * dropped rather than rejected, so a bad field never blocks the rest of the profile.
 */
export function sanitizeProfilePatch(input: unknown): ProfilePatch {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const patch: ProfilePatch = {};

  const displayName = clipText(src.displayName, 120);
  if (displayName !== undefined) patch.displayName = displayName;

  const email = clipText(src.email, 254);
  if (email !== undefined) patch.email = email.toLowerCase();

  const photoUrl = clipText(src.photoURL, 2048);
  if (photoUrl !== undefined) patch.photoUrl = photoUrl;

  const provider = clipText(src.provider, 40);
  if (provider !== undefined) patch.provider = provider;

  if (src.branch === null || src.branch === "") {
    patch.branch = null;
  } else {
    const branch = clipText(src.branch, 32)?.toUpperCase();
    if (branch && /^[A-Z0-9]{2,16}$/.test(branch)) patch.branch = branch;
  }

  if (src.semester === null) {
    patch.semester = null;
  } else if (src.semester !== undefined) {
    const semester = Number(src.semester);
    if (Number.isInteger(semester) && semester >= 1 && semester <= 12) {
      patch.semester = semester;
    }
  }

  if (src.lastActive === null) {
    patch.lastActiveAt = null;
  } else {
    const raw = clipText(src.lastActive, 40);
    if (raw) {
      const when = new Date(raw);
      if (!Number.isNaN(when.getTime())) patch.lastActiveAt = when;
    }
  }

  const academicYear = src.academic_year ?? src.academicYear;
  if (academicYear === null || academicYear === "") {
    patch.academicYear = null;
  } else {
    const year = clipText(academicYear, 16);
    if (year && ACADEMIC_YEAR.test(year)) patch.academicYear = year;
  }

  if (src.workspace_scope_version === null) {
    patch.workspaceScopeVersion = null;
  } else if (src.workspace_scope_version !== undefined) {
    const version = Number(src.workspace_scope_version);
    if (Number.isInteger(version) && version >= 0 && version <= 1000) {
      patch.workspaceScopeVersion = version;
    }
  }

  if (src.onboarding_completed_at !== undefined) {
    patch.onboardingCompletedAt = parseWhen(src.onboarding_completed_at);
  }

  return patch;
}

function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

export async function upsertProfile(db: Db, uid: string, patch: ProfilePatch): Promise<void> {
  const fields = { ...withoutUndefined(patch), updatedAt: new Date() };
  await db
    .insert(userProfiles)
    .values({ uid, ...fields })
    .onConflictDoUpdate({ target: userProfiles.uid, set: fields });
}

/** Deletes the profile and the usage rows the admin page derives from it (not the Auth account). */
export async function removeProfileAndUsage(db: Db, uid: string): Promise<void> {
  await db.delete(resourceUsage).where(eq(resourceUsage.userId, uid));
  await db.delete(userProfiles).where(eq(userProfiles.uid, uid));
}

const USAGE_HISTORY_KEY = "resource_usage_history_v1";

/**
 * One-time: adds the all-time per-user open counts from Firestore `resource_usage`
 * onto the Postgres usage rows, so the admin numbers keep their history. Adding (not
 * replacing) is correct because Firestore only held opens recorded before the home
 * server took over, plus any Vercel fallback writes while it was down. Guarded by a
 * checkpoint row and one transaction, so it can't double count.
 */
export async function importFirestoreUsageHistory(
  db: Db,
): Promise<{ alreadyRun: boolean; scanned: number; rowsAdded: number }> {
  const [done] = await db
    .select({ done: migrateCheckpoint.done })
    .from(migrateCheckpoint)
    .where(eq(migrateCheckpoint.collection, USAGE_HISTORY_KEY))
    .limit(1);
  if (done?.done) return { alreadyRun: true, scanned: 0, rowsAdded: 0 };

  const snapshot = await adminFirestore().collection("resource_usage").get();
  const rows = snapshot.docs.flatMap((doc) => {
    const d = doc.data();
    const userId = String(d.user_id || "").trim();
    const resourceId = String(d.resource_id || "").trim();
    const count = Math.floor(Number(d.count) || 0);
    if (!userId || !resourceId || count <= 0) return [];
    const when = typeof d.lastOpenedAt === "string" ? new Date(d.lastOpenedAt) : null;
    return [
      {
        userId,
        resourceId,
        count,
        lastOpenedAt: when && !Number.isNaN(when.getTime()) ? when : null,
      },
    ];
  });

  await db.transaction(async (tx) => {
    for (const row of rows) {
      await tx
        .insert(resourceUsage)
        .values(row)
        .onConflictDoUpdate({
          target: [resourceUsage.userId, resourceUsage.resourceId],
          set: {
            count: sql`${resourceUsage.count} + ${row.count}`,
            lastOpenedAt: sql`greatest(coalesce(${resourceUsage.lastOpenedAt}, 'epoch'::timestamptz), coalesce(${row.lastOpenedAt}, 'epoch'::timestamptz))`,
          },
        });
    }
    await tx
      .insert(migrateCheckpoint)
      .values({ collection: USAGE_HISTORY_KEY, done: true, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: migrateCheckpoint.collection,
        set: { done: true, updatedAt: new Date() },
      });
  });

  return { alreadyRun: false, scanned: snapshot.size, rowsAdded: rows.length };
}

/**
 * Copies Firestore `users` docs into Postgres. Upserts only, so it can be re-run.
 * Firestore is the source for this copy, so run it before relying on the mirror.
 */
export async function backfillProfilesFromFirestore(
  db: Db,
): Promise<{ scanned: number; written: number }> {
  const snapshot = await adminFirestore().collection("users").get();
  let written = 0;
  for (const doc of snapshot.docs) {
    const d = doc.data();
    const uid = String(d.uid || doc.id).trim();
    if (!uid || uid.length > 128) continue;
    const patch = sanitizeProfilePatch({
      displayName: d.displayName,
      email: d.email,
      photoURL: d.photoURL,
      provider: d.provider,
      branch: d.branch || null,
      semester: d.semester ?? null,
      lastActive: d.lastActive || null,
      academic_year: typeof d.academic_year === "string" ? d.academic_year : null,
      workspace_scope_version:
        typeof d.workspace_scope_version === "number" ? d.workspace_scope_version : undefined,
      onboarding_completed_at:
        typeof d.onboarding_completed_at === "string" ? d.onboarding_completed_at : undefined,
    });
    await upsertProfile(db, uid, patch);
    written += 1;
  }
  return { scanned: snapshot.size, written };
}
