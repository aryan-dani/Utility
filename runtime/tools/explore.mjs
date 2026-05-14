/**
 * runtime/tools/explore.mjs
 * Autonomous project explorer. Scans all tables and buckets to build a metadata cache
 * and print a comprehensive project overview.
 */

import { getFullTopology } from "../lib/introspection.mjs";
import { listBuckets, listAllFiles } from "../lib/storage.mjs";
import { printTable } from "../lib/sql.mjs";
import { getProjectRef } from "../lib/supabase.mjs";

/**
 * Runs the exploration and prints the dashboard.
 */
export async function exploreProject() {
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║          SUPABASE PROJECT EXPLORER: ${getProjectRef().toUpperCase().padEnd(21)} ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  try {
    // 1. Database Introspection
    const topology = await getFullTopology(true); // force refresh
    
    const tableSummaries = topology.tables.map(t => ({
      Table: t.name,
      Rows: t.rowCount,
      Columns: t.columns.length,
      PKs: t.primaryKeys.join(", ") || "(none)"
    }));

    printTable(tableSummaries, "📊 DATABASE TABLES");

    // 2. Storage Introspection
    const buckets = await listBuckets();
    const bucketSummaries = [];

    for (const bucket of buckets) {
      const files = await listAllFiles(bucket.name);
      bucketSummaries.push({
        Bucket: bucket.name,
        Public: bucket.public ? "✅" : "❌",
        Files: files.length,
        Size: `${(files.reduce((acc, f) => acc + (f.size || 0), 0) / 1024 / 1024).toFixed(2)} MB`
      });
    }

    printTable(bucketSummaries, "📦 STORAGE BUCKETS");

    // 3. Relationships
    if (topology.relationships && topology.relationships.length > 0) {
      console.log(`  🔗 RELATIONSHIPS`);
      topology.relationships.forEach(rel => {
        console.log(`     ${rel.from_table}.${rel.from_column} ───< ${rel.to_table}.${rel.to_column}`);
      });
      console.log("");
    }

    console.log(`  ✨ Exploration complete. Topology cached in runtime/.cache/topology.json\n`);

  } catch (error) {
    console.error(`❌ Exploration failed: ${error.message}`);
  }
}

// Allow running directly
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  exploreProject();
}
