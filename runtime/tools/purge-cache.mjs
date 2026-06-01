/**
 * runtime/tools/purge-cache.mjs
 * Deletes semantic_cache entries older than 30 days.
 */

import { db } from "../lib/firebase.mjs";

export default async function purgeCache() {
  console.log(`\n🧹 Starting Semantic Cache Cleanup…\n`);

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString();

    console.log(`🔍 Looking for cache entries older than: ${cutoffStr}`);

    const snapshot = await db.collection("semantic_cache")
      .where("created_at", "<", cutoffStr)
      .get();

    if (snapshot.empty) {
      console.log(`✅ No expired cache entries found.`);
      return;
    }

    console.log(`🗑️ Found ${snapshot.size} expired cache entries. Deleting...`);

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`✅ Successfully deleted ${snapshot.size} expired cache entries.\n`);
  } catch (error) {
    console.error(`❌ Cache cleanup failed: ${error.message}`);
  }
}

// Allow running directly
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  purgeCache();
}
