/**
 * Backfill in-app text previews for code / notebook / CSV files already
 * cataloged in Firestore.
 *
 *   node runtime/tools/store-text-previews.mjs [--dry-run]
 */
import { db } from "../lib/firebase.mjs";
import {
  PREVIEW_COLLECTION,
  PREVIEW_MAX_BYTES,
  isPreviewableName,
  pruneOversizedPreviews,
  storePreviewFromDrive,
} from "../lib/resourcePreview.mjs";

export default async function storeTextPreviews({ dryRun = false } = {}) {
  console.log("\n📝 Storing in-app text previews…\n");

  if (!dryRun) {
    const pruned = await pruneOversizedPreviews();
    if (pruned > 0) {
      console.log(`  🧹 Removed ${pruned} preview(s) over ${PREVIEW_MAX_BYTES} bytes\n`);
    }
  }

  let scanned = 0;
  let stored = 0;
  let skipped = 0;
  let failed = 0;
  let last = null;

  while (true) {
    let q = db.collection("resources").orderBy("__name__").limit(200);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      scanned++;
      const d = doc.data();
      const title = d.title || "";
      if (!isPreviewableName(title)) continue;
      const driveId = d.drive_file_id;
      if (!driveId) {
        skipped++;
        continue;
      }
      const existing = await db.collection(PREVIEW_COLLECTION).doc(doc.id).get();
      const existingBytes = Number(existing.data()?.bytes || 0);
      if (existing.exists && existingBytes > 0 && existingBytes <= PREVIEW_MAX_BYTES) {
        skipped++;
        continue;
      }
      if (dryRun) {
        console.log(`  [dry-run] ${title}`);
        stored++;
        continue;
      }
      try {
        const result = await storePreviewFromDrive(doc.id, driveId, title);
        if (result.ok) {
          stored++;
          console.log(`  ✅ ${title} (${result.bytes} bytes)`);
        } else {
          skipped++;
          console.log(`  ⏭️  ${title} (${result.skipped})`);
        }
      } catch (err) {
        failed++;
        console.warn(`  ⚠️  ${title}: ${err.message}`);
      }
    }

    last = snap.docs[snap.docs.length - 1];
    if (snap.size < 200) break;
  }

  console.log(
    `\nDone. scanned=${scanned} stored=${stored} skipped=${skipped} failed=${failed}\n`,
  );
  return { scanned, stored, skipped, failed };
}
