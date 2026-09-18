/**
 * runtime/index.mjs
 * Unified entry point for the Academic OS Runtime CLI.
 */

import { listBuckets, listAllFiles, buildFileTree } from "./lib/storage.mjs";
import { summarize } from "./lib/pdf.mjs";
import syncProject from "./tools/sync-drive.mjs";
import indexContent from "./tools/index-content.mjs";
import purgeCache from "./tools/purge-cache.mjs";
import doctor from "./tools/doctor.mjs";
import drivePut from "./tools/drive-put.mjs";
import {
  driveLs,
  driveFind,
  driveRm,
  driveMv,
} from "./tools/drive-ops.mjs";

function parseFlag(args, name) {
  const eq = args.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(`--${name}=`.length);
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith("-")) {
    return args[idx + 1];
  }
  return null;
}

const helpText = `
Academic OS Runtime CLI (Firebase Backend)

Usage:
  node runtime/index.mjs [command] [args]
  npm run drive -- [command] [args]

Drive commands (preferred for notes uploads):
  put <file|dir> --to=YEAR/BRANCH/Sem_N_BRANCH/Sem_N_Notes/SUBJECT
  put <file> --year= --branch= --semester= --subject= [--category=notes|ppt|…]
                 [--as=Name.pdf] [--index] [--revalidate] [--no-sync] [--dry-run]
  ls [path] [--depth=4]
  find <name-fragment>
  rm <drive-path> --dry-run|--apply
  mv <from-path> <to-folder-or-path> --dry-run|--apply
  sync [--full] [--path=…] [--year=] [--branch=] [--semester=] [--subject=]
       [--incremental] [--dry-run] [--verbose]
       Default without flags: incremental (Drive Changes API). Use --full weekly.
  index [--id=] [--title=] [--subject=] [--path=] [--shrink-content]

Other commands:
  help              Show this help menu
  buckets           List all storage buckets
  files <bucket>    List all files in a bucket (recursive tree)
  pdf <bucket> <path> Extract text and metadata from a PDF
  search <term>     Search all PDFs locally in 'course-content' for a term
  purge-cache       Purge expired semantic cache entries
  doctor            Check env vars + Firestore collection health

Examples:
  npm run drive -- put ./GML_Unit_1_Notes.pdf --year=2026-2027 --branch=AIDS --semester=5 --subject=GML --category=notes --as=GML_Unit_1_Notes.pdf --revalidate
  npm run drive -- sync --path=2026-2027/AIDS/Sem_5_AIDS/Sem_5_Notes/GML
  npm run drive -- sync --full
  npm run drive -- index --subject=GML
  node runtime/index.mjs doctor
`;

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (!cmd) {
    console.log(helpText);
    return;
  }

  try {
    switch (cmd) {
      case "help":
      case "--help":
      case "-h":
        console.log(helpText);
        break;

      case "put":
        await drivePut(args);
        break;

      case "ls":
        await driveLs(args);
        break;

      case "find":
        await driveFind(args);
        break;

      case "rm":
        await driveRm(args);
        break;

      case "mv":
        await driveMv(args);
        break;

      case "buckets": {
        const b = await listBuckets();
        console.log(`\n📦 STORAGE BUCKETS:\n`);
        b.forEach((bucket) => console.log(` - ${bucket.name}`));
        console.log("");
        break;
      }

      case "files": {
        const bucket = args[0] || "course-content";
        const files = await listAllFiles(bucket);
        console.log(`\n📂 FILE TREE: ${bucket}\n`);
        console.log(JSON.stringify(buildFileTree(files), null, 2));
        console.log(`\nTotal files: ${files.length}\n`);
        break;
      }

      case "pdf": {
        if (args.length < 2) throw new Error("Bucket and path required.");
        console.log(`\n📄 Extracting PDF: ${args[1]}...`);
        const result = await summarize(
          await (await import("./lib/storage.mjs")).downloadFile(args[0], args[1]),
        );
        console.log(`\nPages: ${result.pages}`);
        console.log(`Metadata:`, result.metadata);
        console.log(`\nText Preview:\n${"-".repeat(20)}\n${result.summary}\n`);
        break;
      }

      case "search": {
        if (!args[0]) throw new Error("Search term required.");
        const { searchAll } = await import("./tools/search-pdfs.mjs");
        await searchAll(args[1] || "course-content", args[0]);
        break;
      }

      case "sync": {
        await syncProject({
          subject: parseFlag(args, "subject"),
          path: parseFlag(args, "path"),
          year: parseFlag(args, "year"),
          branch: parseFlag(args, "branch"),
          semester: parseFlag(args, "semester"),
          category: parseFlag(args, "category"),
          dryRun: args.includes("--dry-run"),
          verbose: args.includes("--verbose"),
          full: args.includes("--full"),
          incremental: args.includes("--incremental"),
          argv: args,
        });
        break;
      }

      case "index": {
        await indexContent({
          shrinkContent: args.includes("--shrink-content"),
          ids: args.filter((a) => a.startsWith("--id=")).map((a) => a.slice(5)),
          title: parseFlag(args, "title"),
          subject: parseFlag(args, "subject"),
          path: parseFlag(args, "path"),
        });
        break;
      }

      case "purge-cache": {
        await purgeCache();
        break;
      }

      case "doctor": {
        await doctor();
        break;
      }

      default:
        console.error(`Unknown command: ${cmd}`);
        console.log(helpText);
        process.exitCode = 1;
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    process.exitCode = 1;
  }
}

main();
