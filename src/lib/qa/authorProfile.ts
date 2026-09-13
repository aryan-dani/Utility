import { adminAuth, adminDb } from "@/lib/firebaseAdmin";

export type QaAuthorProfile = {
  author_name: string;
  author_photo_url: string | null;
};

const FALLBACK_NAME = "Student";

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 80) : null;
}

function cleanPhoto(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("data:image/")
  ) {
    return trimmed.slice(0, 2000);
  }
  return null;
}

/** Resolve display name + photo for a signed-in user (Firestore prefs, then Auth). */
export async function resolveAuthorProfile(
  uid: string,
  email?: string | null,
): Promise<QaAuthorProfile> {
  let author_name: string | null = null;
  let author_photo_url: string | null = null;

  try {
    const snap = await adminDb().collection("users").doc(uid).get();
    if (snap.exists) {
      const data = snap.data() || {};
      author_name = cleanName(data.displayName);
      author_photo_url = cleanPhoto(data.photoURL);
    }
  } catch {
    // Fall through to Auth
  }

  if (!author_name || !author_photo_url) {
    try {
      const user = await adminAuth().getUser(uid);
      author_name = author_name || cleanName(user.displayName);
      author_photo_url = author_photo_url || cleanPhoto(user.photoURL);
      if (!author_name) {
        author_name = cleanName(user.email?.split("@")[0]);
      }
    } catch {
      // ignore
    }
  }

  if (!author_name) {
    author_name = cleanName(email?.split("@")[0]) || FALLBACK_NAME;
  }

  return { author_name, author_photo_url };
}

type AuthorFields = {
  author_uid: string;
  author_name: string;
  author_photo_url?: string | null;
};

/** Overlay live profile name/photo onto denormalized QA author fields. */
export async function enrichAuthorsWithProfiles<T extends AuthorFields>(
  items: T[],
): Promise<T[]> {
  const uids = [
    ...new Set(
      items
        .map((item) => item.author_uid)
        .filter((uid): uid is string => Boolean(uid)),
    ),
  ];
  if (uids.length === 0) return items;

  const profiles = new Map<string, QaAuthorProfile>();
  const db = adminDb();

  for (let i = 0; i < uids.length; i += 100) {
    const chunk = uids.slice(i, i + 100);
    const refs = chunk.map((uid) => db.collection("users").doc(uid));
    try {
      const snaps = await db.getAll(...refs);
      for (const snap of snaps) {
        if (!snap.exists) continue;
        const data = snap.data() || {};
        const name = cleanName(data.displayName);
        const photo = cleanPhoto(data.photoURL);
        if (name || photo) {
          profiles.set(snap.id, {
            author_name: name || FALLBACK_NAME,
            author_photo_url: photo,
          });
        }
      }
    } catch {
      // continue with Auth fallback
    }
  }

  const missing = uids.filter((uid) => !profiles.has(uid));
  if (missing.length > 0) {
    try {
      const result = await adminAuth().getUsers(
        missing.map((uid) => ({ uid })),
      );
      for (const user of result.users) {
        profiles.set(user.uid, {
          author_name:
            cleanName(user.displayName) ||
            cleanName(user.email?.split("@")[0]) ||
            FALLBACK_NAME,
          author_photo_url: cleanPhoto(user.photoURL),
        });
      }
    } catch {
      // leave denormalized fields as-is
    }
  }

  return items.map((item) => {
    const profile = profiles.get(item.author_uid);
    if (!profile) return item;
    return {
      ...item,
      author_name: profile.author_name || item.author_name,
      author_photo_url:
        profile.author_photo_url || item.author_photo_url || null,
    };
  });
}
