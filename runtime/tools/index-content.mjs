/**
 * runtime/tools/index-content.mjs
 * Indexes the full-text content of resources (from Google Drive or Firebase Storage) into the database.
 * Enables AI summarization, denormalized metadata, and tokenized keyword search.
 */

import { select, upsert } from "../lib/db.mjs";
import { downloadFile } from "../lib/storage.mjs";
import { extractText } from "../lib/extractor.mjs";
import { getDrive } from "../lib/drive.mjs";

function extractSearchTokens(text, title, subjectName) {
  const combined = `${title} ${subjectName} ${text}`;
  const clean = combined.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const words = clean.split(/\s+/);
  const stopWords = new Set([
    "the", "is", "a", "and", "or", "in", "of", "to", "for", "with", "on", 
    "at", "by", "an", "this", "that", "it", "from", "as", "are", "be", "was",
    "were", "but", "not", "he", "she", "they", "them", "his", "her", "their"
  ]);
  const tokens = new Set();
  for (const word of words) {
    if (word.length >= 3 && word.length <= 25 && !stopWords.has(word)) {
      tokens.add(word);
    }
  }
  return Array.from(tokens).slice(0, 5000); // safety cap
}

export default async function indexContent() {
  console.log(`\n🔍 Starting Content Indexing…\n`);

  try {
    // 1. Fetch all resources
    const { data: resources } = await select("resources", { limit: 5000 });
    const supportedExts = [".pdf", ".docx", ".pptx", ".doc", ".ppt"];
    const indexable = resources.filter((r) => {
      const url = r.file_url.toLowerCase().split("?")[0];
      return supportedExts.some((ext) => url.endsWith(ext) || r.title.toLowerCase().endsWith(ext));
    });

    console.log(`📦 Found ${indexable.length} indexable resources to check.\n`);

    // 2. Fetch all subjects for mapping metadata
    let subjectsMap = new Map();
    try {
      const { data: subjects } = await select("subjects", { limit: 5000 });
      subjectsMap = new Map(subjects.map((s) => [s.id, s]));
      console.log(`✅ Loaded ${subjectsMap.size} subjects for metadata mapping.`);
    } catch (e) {
      console.warn(`⚠️  Could not fetch subjects. Metadata mapping will be limited.`);
    }

    // 3. Fetch already indexed IDs and timestamps
    let indexedMap = new Map();
    try {
      const { data: indexed } = await select("resource_content", {
        columns: "resource_id, last_indexed, search_tokens",
        limit: 5000,
      });
      indexedMap = new Map(indexed.map((i) => [i.resource_id, i]));
      console.log(`✅ ${indexedMap.size} resources already indexed.`);
    } catch (e) {
      console.warn(`⚠️  Could not fetch indexed IDs from Firebase.`);
      console.log(
        `👉 Please ensure your Firebase Firestore settings allow access to the 'resource_content' collection.\n`,
      );
      return;
    }

    const toIndex = indexable.filter((p) => {
      const doc = indexedMap.get(p.id);
      if (!doc) return true;
      // Re-index if search_tokens is missing or empty (to migrate old indexes)
      if (!doc.search_tokens || doc.search_tokens.length === 0) {
        console.log(`🔄 Resource missing search_tokens: ${p.title}. Re-indexing...`);
        return true;
      }
      if (
        p.created_at &&
        new Date(p.created_at).getTime() > new Date(doc.last_indexed).getTime()
      ) {
        console.log(`🔄 File updated in storage: ${p.title}. Re-indexing...`);
        return true;
      }
      return false;
    });
    console.log(`🚀 ${toIndex.length} resources to index (new, updated, or migrating).\n`);

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

        let buffer;
        const ext = (res.title.split(".").pop() || "").toLowerCase();

        if (res.file_url.includes("drive.google.com")) {
          // Google Drive download
          const fileIdMatch = res.file_url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
          if (!fileIdMatch) {
            console.warn(`   ⚠️  Could not extract Google Drive file ID for ${res.title}, skipping.`);
            return;
          }
          const fileId = fileIdMatch[1];
          const drive = getDrive();
          const driveRes = await drive.files.get(
            { fileId: fileId, alt: "media" },
            { responseType: "arraybuffer" }
          );
          buffer = Buffer.from(driveRes.data);
        } else {
          // Firebase Storage download fallback
          const url = new URL(res.file_url);
          const pathParts = decodeURIComponent(url.pathname).split(
            "/course-content/",
          );
          if (pathParts.length < 2) {
            console.warn(`   ⚠️  Invalid URL format for ${res.title}, skipping.`);
            return;
          }
          const path = pathParts[1];
          buffer = await downloadFile("course-content", path);
        }

        const { text, pages } = await extractText(buffer, ext);

        if (!text || text.trim().length === 0) {
          console.warn(`   ⚠️  No text extracted for ${res.title}, skipping.`);
          return;
        }

        const cleanText = text
          .replace(/\u0000/g, "")
          .replace(/\\u0000/g, "")
          .replace(/\x00/g, "");

        const subject = subjectsMap.get(res.subject_id);
        const subjectName = subject ? subject.name : "";
        const branch = subject ? subject.branch : "";
        const semester = subject ? subject.semester : null;

        const searchTokens = extractSearchTokens(cleanText, res.title, subjectName);

        await upsert(
          "resource_content",
          {
            id: res.id,
            resource_id: res.id,
            content: cleanText,
            pages: pages,
            last_indexed: new Date().toISOString(),
            title: res.title || "",
            subject_name: subjectName,
            file_url: res.file_url || "",
            snippet: cleanText.substring(0, 500),
            branch: branch || "",
            semester: semester,
            search_tokens: searchTokens,
          },
          "resource_id",
        );

        console.log(`   ✅ Success (${pages} pages, ${text.length} chars, ${searchTokens.length} search tokens)`);
      } catch (err) {
        console.error(`   ❌ Failed (${res.title}): ${err.message}`);
      }
    });

    console.log(
      `\n✨ Indexing complete! Processed ${toIndex.length} resources.`,
    );
  } catch (error) {
    console.error(`\n❌ Error during indexing: ${error.message}`);
  }
}
