/**
 * Store small source / notebook / CSV text in Firestore so the site can
 * render it in-app. Bytes come from the Drive CLI (or a local put), never
 * from a Vercel Function.
 */
import { db } from "./firebase.mjs";
import { getDrive } from "./drive.mjs";

export const PREVIEW_COLLECTION = "resource_previews";
/** Small enough for Spark. Bigger notebooks/CSVs stay on the Drive iframe. */
export const PREVIEW_MAX_BYTES = 64 * 1024;

export const PREVIEW_EXTS = new Set([
  "c",
  "h",
  "cpp",
  "hpp",
  "cc",
  "sh",
  "bash",
  "py",
  "js",
  "ts",
  "tsx",
  "jsx",
  "java",
  "txt",
  "md",
  "json",
  "css",
  "html",
  "sql",
  "ipynb",
  "csv",
]);

export function isPreviewableName(name) {
  const base = String(name || "")
    .split(/[\\/]/)
    .pop();
  if (!base || !base.includes(".")) return false;
  const ext = base.split(".").pop().toLowerCase();
  return PREVIEW_EXTS.has(ext);
}

export async function writeResourcePreview(resourceId, buffer, title = "") {
  if (!resourceId) throw new Error("missing resource id");
  const bytes = Buffer.isBuffer(buffer)
    ? buffer
    : Buffer.from(buffer ?? []);

  if (bytes.length === 0) {
    return { skipped: "empty" };
  }
  if (bytes.length > PREVIEW_MAX_BYTES) {
    await db.collection(PREVIEW_COLLECTION).doc(resourceId).delete();
    return { skipped: "too_large", bytes: bytes.length };
  }
  if (bytes.includes(0)) {
    return { skipped: "binary" };
  }

  const text = bytes.toString("utf8");
  await db.collection(PREVIEW_COLLECTION).doc(resourceId).set({
    text,
    title,
    updated_at: new Date().toISOString(),
    bytes: bytes.length,
  });
  return { ok: true, bytes: bytes.length };
}

export async function storePreviewFromDrive(resourceId, driveFileId, title = "") {
  if (!driveFileId) return { skipped: "no_drive_id" };

  const drive = getDrive();
  const meta = await drive.files.get({
    fileId: driveFileId,
    fields: "size, name",
    supportsAllDrives: true,
  });
  const size = Number(meta.data.size || 0);
  if (size > PREVIEW_MAX_BYTES) {
    await db.collection(PREVIEW_COLLECTION).doc(resourceId).delete();
    return { skipped: "too_large", bytes: size };
  }

  const driveRes = await drive.files.get(
    { fileId: driveFileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  return writeResourcePreview(
    resourceId,
    Buffer.from(driveRes.data),
    title || meta.data.name || "",
  );
}

export async function deleteResourcePreview(resourceId) {
  if (!resourceId) return;
  await db.collection(PREVIEW_COLLECTION).doc(resourceId).delete();
}

/** Drop preview docs that exceed PREVIEW_MAX_BYTES so Spark storage stays small. */
export async function pruneOversizedPreviews() {
  let deleted = 0;
  let last = null;

  while (true) {
    let q = db.collection(PREVIEW_COLLECTION).orderBy("__name__").limit(100);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      const data = doc.data() || {};
      const stored = Number(data.bytes || 0);
      const textBytes =
        typeof data.text === "string" ? Buffer.byteLength(data.text) : 0;
      if (stored > PREVIEW_MAX_BYTES || textBytes > PREVIEW_MAX_BYTES) {
        await doc.ref.delete();
        deleted++;
      }
    }

    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 100) break;
  }

  return deleted;
}
