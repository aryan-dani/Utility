/**
 * runtime/tools/search-pdfs.mjs
 * PDF content search tool. Searches for a term across all PDF files in a bucket.
 */

import { listAllFiles, downloadFile } from "../lib/storage.mjs";
import { searchInPdf } from "../lib/pdf.mjs";

async function searchAll(bucket, term) {
  console.log(`\n🔍 Searching for "${term}" in bucket "${bucket}"...\n`);
  
  const files = await listAllFiles(bucket);
  const pdfs = files.filter(f => f.path.toLowerCase().endsWith(".pdf"));
  
  console.log(`   Found ${pdfs.length} PDF files. Scanning contents...\n`);

  let totalMatches = 0;
  for (const file of pdfs) {
    try {
      const buffer = await downloadFile(bucket, file.path);
      const matches = await searchInPdf(buffer, term);
      
      if (matches.length > 0) {
        console.log(`  📄 ${file.path} (${matches.length} match${matches.length !== 1 ? 'es' : ''})`);
        matches.slice(0, 3).forEach(m => {
          console.log(`     ...${m.context}...`);
        });
        if (matches.length > 3) console.log(`     (and ${matches.length - 3} more...)`);
        console.log("");
        totalMatches += matches.length;
      }
    } catch (err) {
      console.warn(`  ⚠️  Failed to scan ${file.path}: ${err.message}`);
    }
  }

  if (totalMatches === 0) {
    console.log(`   No matches found for "${term}".\n`);
  } else {
    console.log(`   ✨ Search complete. Total matches: ${totalMatches}\n`);
  }
}

const args = process.argv.slice(2);
if (args.length < 1) {
  console.log("Usage: node runtime/tools/search-pdfs.mjs <term> [bucket_name]");
} else {
  searchAll(args[1] || "course-content", args[0]);
}
