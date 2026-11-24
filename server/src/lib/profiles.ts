import { eq } from "drizzle-orm";
import type { getDb } from "../db/client.js";
import { resourceUsage, userProfiles } from "../db/schema.js";
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
  lastActiveAt?: Date | null;
};

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
    });
    await upsertProfile(db, uid, patch);
    written += 1;
  }
  return { scanned: snapshot.size, written };
}
