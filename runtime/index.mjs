/**
 * runtime/index.mjs
 * Unified entry point for the Supabase Autonomous Runtime Layer.
 * Routes commands to appropriate libraries and tools.
 */

import { exploreProject } from "./tools/explore.mjs";
import { executeSQL, formatTable } from "./lib/sql.mjs";
import { getTableSchema } from "./lib/introspection.mjs";
import { listBuckets, listAllFiles, buildFileTree } from "./lib/storage.mjs";
import { extractFromStorage, summarize } from "./lib/pdf.mjs";
import syncProject from "./tools/sync.mjs";

const helpText = `
Supabase Autonomous Runtime Layer CLI

Usage:
  node runtime/index.mjs [command] [args]

Commands:
  (none)            Run full project exploration (dashboard)
  tables            List all tables and row counts
  schema <table>    Show column definitions for a table
  sql "<query>"     Execute raw SQL and print results
  buckets           List all storage buckets
  files <bucket>    List all files in a bucket (recursive tree)
  pdf <bucket> <path> Extract text and metadata from a PDF
  search <term>     Search all PDFs in 'course-content' for a term
  sync              Synchronize storage buckets with database
  
Examples:
  node runtime/index.mjs sql "SELECT COUNT(*) FROM subjects"
  node runtime/index.mjs schema resources
  node runtime/index.mjs files course-content
`;

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (!cmd) {
    await exploreProject();
    return;
  }

  try {
    switch (cmd) {
      case "help":
      case "--help":
      case "-h":
        console.log(helpText);
        break;

      case "tables": {
        const { getFullTopology } = await import("./lib/introspection.mjs");
        const top = await getFullTopology();
        const data = top.tables.map(t => ({ Table: t.name, Rows: t.rowCount, Columns: t.columns.length }));
        console.log(formatTable(data, "PROJECT TABLES"));
        break;
      }

      case "schema": {
        if (!args[0]) throw new Error("Table name required.");
        const schema = await getTableSchema(args[0]);
        console.log(formatTable(schema, `SCHEMA: ${args[0]}`));
        break;
      }

      case "sql": {
        if (!args[0]) throw new Error("SQL query required.");
        const rows = await executeSQL(args[0]);
        console.log(formatTable(rows, "QUERY RESULT"));
        break;
      }

      case "buckets": {
        const b = await listBuckets();
        console.log(formatTable(b, "STORAGE BUCKETS"));
        break;
      }

      case "files": {
        const bucket = args[0] || "course-content";
        const files = await listAllFiles(bucket);
        console.log(`\n  📂 FILE TREE: ${bucket}\n`);
        console.log(JSON.stringify(buildFileTree(files), null, 2));
        console.log(`\n  Total files: ${files.length}\n`);
        break;
      }

      case "pdf": {
        if (args.length < 2) throw new Error("Bucket and path required.");
        console.log(`\n  📄 Extracting PDF: ${args[1]}...`);
        const result = await summarize(await (await import("./lib/storage.mjs")).downloadFile(args[0], args[1]));
        console.log(`\n  Pages: ${result.pages}`);
        console.log(`  Metadata:`, result.metadata);
        console.log(`\n  Text Preview:\n  ${"-".repeat(20)}\n  ${result.summary}\n`);
        break;
      }

      case "search": {
        if (!args[0]) throw new Error("Search term required.");
        const { default: searchPdfs } = await import("./tools/search-pdfs.mjs");
        // Handled by the tool's own logic
        break;
      }

      case "sync": {
        await syncProject();
        break;
      }

      default:
        console.error(`Unknown command: ${cmd}`);
        console.log(helpText);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
  }
}

main();
