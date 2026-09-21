/**
 * runtime/tools/sync-drive.mjs
 * Synchronize Google Drive → Firestore.
 *
 * Usage:
 *   node runtime/tools/sync-drive.mjs --full
 *   node runtime/tools/sync-drive.mjs --path=2026-2027/AIDS/Sem_5_AIDS/Sem_5_Notes/GML
 *   node runtime/tools/sync-drive.mjs --year=2026-2027 --branch=AIDS --semester=5 --subject=GML
 *   node runtime/tools/sync-drive.mjs --incremental
 *   node runtime/tools/sync-drive.mjs --dry-run --verbose
 */
import path from "path";
import { pathToFileURL } from "url";
import { getEnv } from "../lib/env.mjs";
import { getDrive } from "../lib/drive.mjs";
import {
  getRootFolderId,
  walkFiles,
  resolveFolderPath,
} from "../lib/driveTree.mjs";
import {
  upsertResources,
  buildDestSegments,
  parseDrivePath,
  getDriveSyncState,
  setDriveSyncState,
} from "../lib/driveCatalog.mjs";
import { DEFAULT_ACADEMIC_YEAR } from "../lib/academicYear.mjs";

function parseFlag(argv, name) {
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(`--${name}=`.length);
  const idx = argv.indexOf(`--${name}`);
  if (idx >= 0 && argv[idx + 1] && !argv[idx + 1].startsWith("-")) {
    return argv[idx + 1];
  }
  return null;
}

function parseSyncOptions(options = {}, argv = process.argv.slice(2)) {
  const dryRun = options.dryRun === true || argv.includes("--dry-run");
  const verbose = options.verbose === true || argv.includes("--verbose");
  // Default: incremental (changed files only). Pass --full for a full walk+prune.
  const fullFlag = options.full === true || argv.includes("--full");
  const incrementalFlag =
    options.incremental === true || argv.includes("--incremental");
  const incremental = incrementalFlag || !fullFlag;

  const pathArg = options.path || parseFlag(argv, "path");
  const year = options.year || parseFlag(argv, "year");
  const branch = options.branch || parseFlag(argv, "branch");
  const semester = options.semester || parseFlag(argv, "semester");
  const subject = options.subject || parseFlag(argv, "subject");
  const category = options.category || parseFlag(argv, "category");

  let scopePath = pathArg || null;
  const hasFolderHints = Boolean(branch && semester);

  if (!scopePath && hasFolderHints) {
    scopePath = buildDestSegments({
      year: year || DEFAULT_ACADEMIC_YEAR,
      branch,
      semester,
      subject: subject || "",
      category: category || "notes",
    })
      .filter(Boolean)
      .join("/");
  }

  // Legacy: --subject=ML alone still walks full tree but filters + no stats clobber
  const subjectFilterOnly =
    !pathArg && !hasFolderHints && subject ? subject : null;

  const isScoped = Boolean(scopePath);
  // Explicit --full wins; otherwise scoped path is a walk, incremental is changes API.
  const isFull = fullFlag && !isScoped && !subjectFilterOnly;

  return {
    dryRun,
    verbose,
    incremental: incremental && !isFull && !isScoped && !subjectFilterOnly,
    full: isFull,
    scopePath,
    subjectFilter: subjectFilterOnly,
    year,
    branch,
    semester,
    subject,
    category,
  };
}

async function resolveWalkRoot(opts) {
  const rootId = getRootFolderId();
  if (!opts.scopePath) {
    return { folderId: rootId, pathPrefix: "", prunePrefix: null };
  }

  // If subject folder may not exist yet when using year/branch/sem only, try progressively.
  const segments = opts.scopePath.replace(/\\/g, "/").split("/").filter(Boolean);
  try {
    const { folderId, path: resolved } = await resolveFolderPath(segments, {
      create: false,
      drive: getDrive(),
    });
    return { folderId, pathPrefix: resolved, prunePrefix: resolved };
  } catch (err) {
    // Fall back one level at a time
    for (let len = segments.length - 1; len >= 1; len--) {
      try {
        const partial = segments.slice(0, len);
        const { folderId, path: resolved } = await resolveFolderPath(partial, {
          create: false,
          drive: getDrive(),
        });
        console.warn(
          `  ⚠️  ${err.message}; walking ${resolved} instead`,
        );
        return { folderId, pathPrefix: resolved, prunePrefix: resolved };
      } catch {
        /* continue */
      }
    }
    throw err;
  }
}

async function syncIncremental(opts) {
  try {
    console.log(
      `\n🔄 Incremental Drive sync…${opts.dryRun ? " (dry-run)" : ""}\n`,
    );
    getEnv("GOOGLE_DRIVE_FOLDER_ID");
    const drive = getDrive(["https://www.googleapis.com/auth/drive.readonly"]);
    const rootId = getRootFolderId();
    let state = await getDriveSyncState();
    let pageToken = state?.page_token;

    if (!pageToken) {
      const start = await drive.changes.getStartPageToken({
        supportsAllDrives: true,
      });
      pageToken = start.data.startPageToken;
      if (!opts.dryRun) {
        await setDriveSyncState({ page_token: pageToken, mode: "incremental" });
      }
      console.log(
        "  No saved page token — saved start token.",
      );
      console.log(
        "  Next incremental run will pick up new changes. Run `npm run sync-drive:full` once if the catalog is empty/stale.\n",
      );
      printSummary({
        resourcesWritten: 0,
        resourcesSkipped: 0,
        reindexFlagged: 0,
        pathSkipped: 0,
        filterSkipped: 0,
        deletedResources: 0,
        deletedSubjects: 0,
        subjects: 0,
      }, { incremental: true });
      return { stats: { resourcesWritten: 0 } };
    }

    console.log(`  Using saved page token.\n`);
    const changedFiles = [];
    let newToken = pageToken;

    try {
      do {
        const res = await drive.changes.list({
          pageToken: newToken,
          fields:
            "nextPageToken, newStartPageToken, changes(fileId, removed, file(id, name, mimeType, modifiedTime, parents, trashed))",
          pageSize: 100,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          spaces: "drive",
        });

        for (const change of res.data.changes || []) {
          if (change.removed || change.file?.trashed) {
            continue;
          }
          const file = change.file;
          if (!file || file.mimeType === "application/vnd.google-apps.folder") {
            continue;
          }
          try {
            const pathParts = [file.name];
            let parentId = file.parents?.[0];
            let guard = 0;
            while (parentId && parentId !== rootId && guard++ < 20) {
              const parent = await drive.files.get({
                fileId: parentId,
                fields: "id, name, parents",
                supportsAllDrives: true,
              });
              pathParts.unshift(parent.data.name);
              parentId = parent.data.parents?.[0];
              if (parentId === rootId) break;
            }
            if (parentId !== rootId && guard >= 20) continue;
            const relativePath = pathParts.join("/");
            const parsed = parseDrivePath(relativePath);
            if (!parsed?.ok) continue;
            changedFiles.push({
              id: file.id,
              name: file.name,
              path: relativePath,
              updatedAt: file.modifiedTime,
            });
          } catch {
            /* skip unresolvable */
          }
        }

        if (res.data.nextPageToken) {
          newToken = res.data.nextPageToken;
        } else {
          newToken = res.data.newStartPageToken || newToken;
          break;
        }
      } while (true);
    } catch (err) {
      const msg = err?.message || String(err);
      const invalidToken =
        /pageToken|invalid|expired|Invalid Value/i.test(msg) ||
        err?.code === 400 ||
        err?.response?.status === 400;
      if (invalidToken) {
        console.warn(`  ⚠️  Drive page token invalid (${msg}). Resetting…`);
        const start = await drive.changes.getStartPageToken({
          supportsAllDrives: true,
        });
        if (!opts.dryRun) {
          await setDriveSyncState({
            page_token: start.data.startPageToken,
            mode: "incremental-reset",
            reset_reason: msg.slice(0, 200),
          });
        }
        console.log(
          "  Token reset. Run `npm run sync-drive:full` once to reconcile, then incremental will work.\n",
        );
        return { stats: { resourcesWritten: 0 }, resetToken: true };
      }
      throw err;
    }

    if (changedFiles.length === 0) {
      console.log(`📦 No Drive changes since last sync.\n`);
    } else {
      console.log(
        `📦 ${changedFiles.length} changed file(s) under catalog paths.\n`,
      );
    }

    const result = await upsertResources(changedFiles, {
      dryRun: opts.dryRun,
      verbose: opts.verbose,
      prune: false,
      updateStats: changedFiles.length ? "bump" : "none",
    });

    if (!opts.dryRun) {
      await setDriveSyncState({
        page_token: newToken,
        mode: "incremental",
        last_change_count: changedFiles.length,
      });
    }

    printSummary(result.stats, { incremental: true });
    return result;
  } catch (error) {
    const msg = error?.message || String(error);
    console.error(`\n❌ Incremental sync failed: ${msg}`);
    if (error?.stack) console.error(error.stack);
    // Spark daily quota: don't fail the scheduled job red overnight — next run retries.
    if (/RESOURCE_EXHAUSTED|Quota exceeded/i.test(msg)) {
      console.error(
        "  Firestore Spark quota exhausted. Soft-exiting so CI can continue; retry after reset.\n",
      );
      return { stats: { resourcesWritten: 0 }, quotaExhausted: true };
    }
    throw error;
  }
}

function printSummary(stats = {}, extra = {}) {
  console.log(`\n✨ Sync Complete${extra.incremental ? " (incremental)" : ""}!`);
  console.log(`   - Resources written: ${stats.resourcesWritten ?? 0}`);
  console.log(`   - Resources unchanged (skipped): ${stats.resourcesSkipped ?? 0}`);
  console.log(`   - Reindex flagged: ${stats.reindexFlagged ?? 0}`);
  console.log(`   - Path skipped: ${stats.pathSkipped ?? 0}`);
  console.log(`   - Filter skipped: ${stats.filterSkipped ?? 0}`);
  console.log(`   - Resources deleted: ${stats.deletedResources ?? 0}`);
  console.log(`   - Subjects deleted: ${stats.deletedSubjects ?? 0}`);
  console.log(`   - Subjects touched: ${stats.subjects ?? 0}\n`);
}

async function syncDrive(options = {}) {
  const argv = options.argv || process.argv.slice(2);
  const opts = parseSyncOptions(options, argv);

  if (opts.incremental && !opts.full) {
    return syncIncremental(opts);
  }

  const scopeLabel = opts.scopePath
    ? ` [path=${opts.scopePath}]`
    : opts.subjectFilter
      ? ` [subject≈${opts.subjectFilter}]`
      : " [full]";

  console.log(
    `\n🚀 Starting Google Drive Sync...${opts.dryRun ? " (dry-run)" : ""}${scopeLabel}\n`,
  );

  try {
    getEnv("GOOGLE_DRIVE_FOLDER_ID");
    const { folderId, pathPrefix, prunePrefix } = await resolveWalkRoot(opts);
    const files = await walkFiles(folderId, pathPrefix);
    console.log(`📦 Found ${files.length} files to consider.\n`);

    const isFull = opts.full && !opts.scopePath && !opts.subjectFilter;

    const result = await upsertResources(files, {
      dryRun: opts.dryRun,
      verbose: opts.verbose,
      prune: true,
      prunePrefix: isFull ? null : prunePrefix,
      updateStats: isFull ? "full" : "none",
      subjectFilter: opts.subjectFilter,
    });

    // Save start page token after full sync so incremental can follow
    if (!opts.dryRun && isFull) {
      try {
        const drive = getDrive();
        const start = await drive.changes.getStartPageToken({
          supportsAllDrives: true,
        });
        await setDriveSyncState({
          page_token: start.data.startPageToken,
          mode: "full",
          last_full_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn(`  ⚠️  Could not save changes page token: ${err.message}`);
      }
    }

    printSummary(result.stats);
    return result;
  } catch (error) {
    console.error(`\n❌ Sync failed: ${error.message}`);
    if (error.stack) console.error(error.stack);
    throw error;
  }
}

const isDirectRun =
  !!process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  syncDrive()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`\n❌ sync-drive exited with error: ${err?.message || err}`);
      if (err?.stack) console.error(err.stack);
      process.exit(1);
    });
}

export default syncDrive;
