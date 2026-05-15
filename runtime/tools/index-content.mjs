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
    const { data: resources } = await select("resources", { limit: 1000 });
    const supportedExts = ['.pdf', '.docx', '.pptx', '.doc', '.ppt'];
    const indexable = resources.filter(r => 
      supportedExts.some(ext => r.file_url.toLowerCase().endsWith(ext))
    );

    console.log(`📦 Found ${indexable.length} indexable resources to check.\n`);

    // 2. Fetch already indexed IDs
    let indexedIds = new Set();
    try {
      const { data: indexed } = await select("resource_content", { columns: "resource_id" });
      indexedIds = new Set(indexed.map(i => i.resource_id));
      console.log(`✅ ${indexedIds.size} resources already indexed.`);
    } catch (e) {
      console.warn(`⚠️  Could not fetch indexed IDs (resource_content table might not exist yet).`);
      console.log(`👉 Please run the following SQL in your Supabase dashboard first:\n`);
      console.log(`
CREATE TABLE IF NOT EXISTS resource_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE UNIQUE,
  content TEXT NOT NULL,
  pages INTEGER,
  last_indexed TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resource_content_fts ON resource_content USING GIN (to_tsvector('english', content));
      `);
      return;
    }

    const toIndex = indexable.filter(p => !indexedIds.has(p.id));
    console.log(`🚀 ${toIndex.length} new resources to index.\n`);

    // Helper for parallel processing with concurrency limit
    async function processInParallel(items, concurrency, processor) {
      const results = [];
      const executing = new Set();
      for (const item of items) {
        const p = Promise.resolve().then(() => processor(item, items.indexOf(item)));
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
        console.log(`📄 [${index + 1}/${toIndex.length}] Indexing: ${res.title}...`);
        
        const url = new URL(res.file_url);
        const pathParts = decodeURIComponent(url.pathname).split('/course-content/');
        if (pathParts.length < 2) {
          console.warn(`   ⚠️  Invalid URL format for ${res.title}, skipping.`);
          return;
        }
        const path = pathParts[1];
        const ext = path.split('.').pop() || '';

        const buffer = await downloadFile("course-content", path);
        const { text, pages } = await extractText(buffer, ext);

        if (!text || text.trim().length === 0) {
          console.warn(`   ⚠️  No text extracted for ${res.title}, skipping.`);
          return;
        }

        await upsert("resource_content", {
          resource_id: res.id,
          content: text,
          pages: pages,
          last_indexed: new Date().toISOString()
        }, "resource_id");

        console.log(`   ✅ Success (${pages} pages, ${text.length} chars)`);
      } catch (err) {
        console.error(`   ❌ Failed (${res.title}): ${err.message}`);
      }
    });

    console.log(`\n✨ Indexing complete! Processed ${toIndex.length} new resources.`);
  } catch (error) {
    console.error(`\n❌ Error during indexing: ${error.message}`);
  }
}
