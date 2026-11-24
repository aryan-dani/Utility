import { adminAuth } from "@/lib/firebaseAdmin";

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

/**
 * Resolve display name + photo for a signed-in user. Firebase Auth is the source: profile
 * edits update it, and the legacy Firestore users doc is no longer written.
 */
export async function resolveAuthorProfile(
  uid: string,
  email?: string | null,
): Promise<QaAuthorProfile> {
  let author_name: string | null = null;
  let author_photo_url: string | null = null;

  try {
    const user = await adminAuth().getUser(uid);
    author_name = cleanName(user.displayName);
    author_photo_url = cleanPhoto(user.photoURL);
    if (!author_name) {
      author_name = cleanName(user.email?.split("@")[0]);
    }
  } catch {
    // ignore: fall back to the email prefix below
  }

  if (!author_name) {
    author_name = cleanName(email?.split("@")[0]) || FALLBACK_NAME;
  }

  return { author_name, author_photo_url };
}
