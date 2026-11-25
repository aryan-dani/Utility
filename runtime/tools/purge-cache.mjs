/**
 * runtime/tools/purge-cache.mjs
 * Deletes semantic_cache entries past expires_at, or created_at older than 14 days.
 */

import path from "path";
import { pathToFileURL } from "url";
import { db } from "../lib/firebase.mjs";

const BATCH_LIMIT = 500;
const FALLBACK_MAX_AGE_DAYS = 14;

async function deleteExpiredByQuery(queryBuilder) {
  let deleted = 0;
  while (true) {
    const snap = await queryBuilder().select().limit(BATCH_LIMIT).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
    console.log(`  ✅ Deleted ${deleted} entries so far...`);

    if (snap.size < BATCH_LIMIT) break;
  }
  return deleted;
}

export default async function purgeCache() {
  console.log(`\n🧹 Starting Semantic Cache Cleanup…\n`);

  const nowIso = new Date().toISOString();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - FALLBACK_MAX_AGE_DAYS);
  const cutoffStr = cutoff.toISOString();

  console.log(`🔍 Looking for cache entries with expires_at < ${nowIso}`);
  console.log(`   (fallback: created_at < ${cutoffStr})`);

  const col = db.collection("semantic_cache");
  const deletedByExpires = await deleteExpiredByQuery(() =>
    col.where("expires_at", "<", nowIso),
  );
  const deletedByCreated = await deleteExpiredByQuery(() =>
    col.where("created_at", "<", cutoffStr),
  );
  const totalDeleted = deletedByExpires + deletedByCreated;

  if (totalDeleted === 0) {
    console.log(`✅ No expired cache entries found.`);
    return 0;
  }

  console.log(`✅ Successfully deleted ${totalDeleted} expired cache entries.\n`);
  return totalDeleted;
}

// Allow running directly
const isDirectRun =
  !!process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  purgeCache()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(`❌ Cache cleanup failed: ${error?.message || error}`);
      process.exit(1);
    });
}
