/**
 * runtime/tools/index-content.mjs
 * Indexes the full-text content of PDF resources into the database.
 * Enables AI summarization and deep search.
 */

import { select, upsert } from "../lib/db.mjs";
import { downloadFile } from "../lib/storage.mjs";
import { extractText } from "../lib/extractor.mjs";

export default async function indexContent() {
  console.log(`\n🔍 Starting Content Indexing…\n`);

  try {
    // 1. Fetch all resources
    const { data: resources } = await select("resources", { limit: 5000 });
    const supportedExts = [".pdf", ".docx", ".pptx", ".doc", ".ppt"];
    const indexable = resources.filter((r) =>
      supportedExts.some((ext) => r.file_url.toLowerCase().endsWith(ext)),
    );

    console.log(`📦 Found ${indexable.length} indexable resources to check.\n`);

    // 2. Fetch already indexed IDs and timestamps
    let indexedMap = new Map();
    try {
      const { data: indexed } = await select("resource_content", {
        columns: "resource_id, last_indexed",
        limit: 5000,
      });
      indexedMap = new Map(indexed.map((i) => [i.resource_id, i.last_indexed]));
      console.log(`✅ ${indexedMap.size} resources already indexed.`);
    } catch (e) {
      console.warn(`⚠️  Could not fetch indexed IDs from Firebase.`);
      console.log(
        `👉 Please ensure your Firebase Firestore settings allow access to the 'resource_content' collection.\n`,
      );
      return;
    }

    const toIndex = indexable.filter((p) => {
      const lastIndexed = indexedMap.get(p.id);
      if (!lastIndexed) return true;
      if (
        p.created_at &&
        new Date(p.created_at).getTime() > new Date(lastIndexed).getTime()
      ) {
        console.log(`🔄 File updated in storage: ${p.title}. Re-indexing...`);
        return true;
      }
      return false;
    });
    console.log(`🚀 ${toIndex.length} resources to index (new or updated).\n`);

    // Helper for parallel processing with concurrency limit
    async function processInParallel(items, concurrency, processor) {
      const results = [];
      const executing = new Set();
      for (const item of items) {
        const p = Promise.resolve().then(() =>
          processor(item, items.indexOf(item)),
        );
        results.push(p);
        executing.add(p);
        const clean = () => executing.delete(p);
        p.then(clean).catch(clean);
        if (executing.size >= concurrency) {
          await Promise.race(executing);
        }
      }
      return Promise.all(results);
    }

    await processInParallel(toIndex, 5, async (res, index) => {
      try {
        console.log(
          `📄 [${index + 1}/${toIndex.length}] Indexing: ${res.title}...`,
        );

        const url = new URL(res.file_url);
        const pathParts = decodeURIComponent(url.pathname).split(
          "/course-content/",
        );
        if (pathParts.length < 2) {
          console.warn(`   ⚠️  Invalid URL format for ${res.title}, skipping.`);
          return;
        }
        const path = pathParts[1];
        const ext = path.split(".").pop() || "";

        const buffer = await downloadFile("course-content", path);
        const { text, pages } = await extractText(buffer, ext);

        if (!text || text.trim().length === 0) {
          console.warn(`   ⚠️  No text extracted for ${res.title}, skipping.`);
          return;
        }

        const cleanText = text
          .replace(/\u0000/g, "")
          .replace(/\\u0000/g, "")
          .replace(/\x00/g, "");

        await upsert(
          "resource_content",
          {
            id: res.id,
            resource_id: res.id,
            content: cleanText,
            pages: pages,
            last_indexed: new Date().toISOString(),
          },
          "resource_id",
        );

        console.log(`   ✅ Success (${pages} pages, ${text.length} chars)`);
      } catch (err) {
        console.error(`   ❌ Failed (${res.title}): ${err.message}`);
      }
    });

    console.log(
      `\n✨ Indexing complete! Processed ${toIndex.length} new resources.`,
    );
  } catch (error) {
    console.error(`\n❌ Error during indexing: ${error.message}`);
  }
}
