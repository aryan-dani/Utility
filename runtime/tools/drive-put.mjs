/**
 * Targeted Drive put: upload a file or directory and upsert only touched resources.
 *
 * Usage:
 *   node runtime/tools/drive-put.mjs <local> --to=2026-2027/AIDS/Sem_5_AIDS/Sem_5_Notes/GML
 *   node runtime/tools/drive-put.mjs ./file.pdf --year=2026-2027 --branch=AIDS --semester=5 --subject=GML --category=notes
 *   node runtime/tools/drive-put.mjs ./file.pdf --to=... --as=GML_Unit_1_Notes.pdf --index
 *   (revalidates production by default; pass --no-revalidate to skip)
 */
import { existsSync, readdirSync, statSync, createReadStream } from "fs";
import { basename, join, resolve as pathResolve } from "path";
import { pathToFileURL } from "url";
import { getWritableDrive } from "../lib/drive.mjs";
import {
  resolveFolderPath,
  findChildFile,
  getOrCreateFolder,
  getRootFolderId,
} from "../lib/driveTree.mjs";
import { buildDestSegments, upsertResources } from "../lib/driveCatalog.mjs";
import {
  ACADEMIC_YEAR_PATH_RE,
  DEFAULT_ACADEMIC_YEAR,
} from "../lib/academicYear.mjs";
import { getEnv } from "../lib/env.mjs";

function parseArgs(argv) {
  const flags = {
    to: null,
    year: null,
    branch: null,
    semester: null,
    subject: null,
    category: "notes",
    as: null,
    overwrite: null,
    dryRun: false,
    noSync: false,
    index: false,
    // Default on: uploads must bust Next/CDN catalog caches or the vault
    // keeps serving a pre-sync empty list until someone hits revalidate by hand.
    revalidate: true,
    verbose: false,
    localTarget: null,
  };

  for (const arg of argv) {
    if (arg === "--overwrite" || arg === "--force") flags.overwrite = true;
    else if (arg === "--no-overwrite") flags.overwrite = false;
    else if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--no-sync") flags.noSync = true;
    else if (arg === "--index") flags.index = true;
    else if (arg === "--revalidate") flags.revalidate = true;
    else if (arg === "--no-revalidate") flags.revalidate = false;
    else if (arg === "--verbose") flags.verbose = true;
    else if (arg.startsWith("--to=")) flags.to = arg.slice(5).trim();
    else if (arg.startsWith("--year=")) flags.year = arg.slice(7).trim();
    else if (arg.startsWith("--branch=")) flags.branch = arg.slice(9).trim();
    else if (arg.startsWith("--semester="))
      flags.semester = arg.slice(11).trim();
    else if (arg.startsWith("--subject=")) flags.subject = arg.slice(10).trim();
    else if (arg.startsWith("--category="))
      flags.category = arg.slice(11).trim();
    else if (arg.startsWith("--as=")) flags.as = arg.slice(5).trim();
    else if (!arg.startsWith("-") && !flags.localTarget) flags.localTarget = arg;
    else if (arg.startsWith("-")) {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return flags;
}

async function uploadOneFile(drive, localPath, remoteName, parentId, opts) {
  const existing = await findChildFile(remoteName, parentId, { drive });
  const existingId = existing?.id ?? null;

  if (existingId && opts.overwrite === false) {
    console.log(`  Skip existing: ${remoteName}`);
    return { action: "skipped", id: existingId, name: remoteName };
  }

  if (opts.dryRun) {
    console.log(
      `  [dry-run] would ${existingId ? "update" : "upload"}: ${remoteName}`,
    );
    return {
      action: existingId ? "updated" : "created",
      id: existingId || "dry-run",
      name: remoteName,
    };
  }

  if (existingId) {
    console.log(`  Updating: ${remoteName}`);
    const res = await drive.files.update({
      fileId: existingId,
      media: { body: createReadStream(localPath) },
      supportsAllDrives: true,
      fields: "id, name, modifiedTime",
    });
    console.log(`  Updated: ${remoteName}`);
    return {
      action: "updated",
      id: res.data.id,
      name: remoteName,
      updatedAt: res.data.modifiedTime,
    };
  }

  console.log(`  Uploading: ${remoteName}`);
  const res = await drive.files.create({
    requestBody: { name: remoteName, parents: [parentId] },
    media: { body: createReadStream(localPath) },
    fields: "id, name, modifiedTime",
    supportsAllDrives: true,
  });
  console.log(`  Uploaded: ${remoteName}`);
  return {
    action: "created",
    id: res.data.id,
    name: remoteName,
    updatedAt: res.data.modifiedTime,
  };
}

async function uploadDirectory(drive, localPath, parentId, opts, relative = "") {
  const results = [];
  for (const item of readdirSync(localPath)) {
    if (item.startsWith(".") || item === "node_modules") continue;
    const itemPath = join(localPath, item);
    const st = statSync(itemPath);
    const rel = relative ? `${relative}/${item}` : item;
    if (st.isDirectory()) {
      const folder = await getOrCreateFolder(item, parentId, {
        drive,
        dryRun: opts.dryRun,
      });
      results.push(
        ...(await uploadDirectory(drive, itemPath, folder.id, opts, rel)),
      );
    } else {
      const uploaded = await uploadOneFile(drive, itemPath, item, parentId, opts);
      results.push({ ...uploaded, relativePath: rel });
    }
  }
  return results;
}

async function revalidateProduction() {
  const url = getEnv("VERCEL_REVALIDATE_URL");
  const secret = getEnv("CRON_SECRET");
  if (!url) {
    console.warn("  ⚠️  VERCEL_REVALIDATE_URL not set — skip revalidate");
    return;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: secret ? `Bearer ${secret}` : "",
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    console.warn(`  ⚠️  Revalidate failed (${res.status}): ${await res.text()}`);
  } else {
    console.log("  ✅ Production cache revalidated");
  }
}

export async function drivePut(argv = process.argv.slice(2)) {
  const flags = parseArgs(argv);
  const { localTarget } = flags;

  if (!localTarget || !existsSync(localTarget)) {
    throw new Error(
      "Usage: drive put <file|dir> --to=YEAR/BRANCH/Sem_N_BRANCH/Sem_N_Notes/SUBJECT\n" +
        "   or: drive put <file> --year= --branch= --semester= --subject= [--category=notes] [--as=name.pdf]",
    );
  }

  const isDir = statSync(localTarget).isDirectory();
  if (flags.overwrite === null) flags.overwrite = !isDir;

  let destPath = flags.to;
  if (!destPath) {
    if (!flags.branch || !flags.semester || !flags.subject) {
      throw new Error(
        "Provide --to=... or --year --branch --semester --subject",
      );
    }
    const year = flags.year || DEFAULT_ACADEMIC_YEAR;
    if (!ACADEMIC_YEAR_PATH_RE.test(year)) {
      throw new Error(`Invalid --year=${year}. Expected YYYY-YYYY.`);
    }
    destPath = buildDestSegments({
      year,
      branch: flags.branch,
      semester: flags.semester,
      subject: flags.subject,
      category: flags.category,
    }).join("/");
  }

  getRootFolderId();
  const drive = getWritableDrive();
  console.log(`\n📤 Drive put: ${localTarget}`);
  console.log(
    `  dest=${destPath} overwrite=${flags.overwrite} dry-run=${flags.dryRun} sync=${!flags.noSync}\n`,
  );

  const { folderId, path: resolvedPath } = await resolveFolderPath(destPath, {
    create: true,
    dryRun: flags.dryRun,
    drive,
  });

  let uploads;
  if (isDir) {
    uploads = await uploadDirectory(drive, localTarget, folderId, flags);
  } else {
    const remoteName = flags.as || basename(localTarget);
    const uploaded = await uploadOneFile(
      drive,
      localTarget,
      remoteName,
      folderId,
      flags,
    );
    uploads = [{ ...uploaded, relativePath: remoteName }];
  }

  const created = uploads.filter((u) => u.action === "created").length;
  const updated = uploads.filter((u) => u.action === "updated").length;
  const skipped = uploads.filter((u) => u.action === "skipped").length;
  console.log(
    `\nDone upload. created=${created} updated=${updated} skipped=${skipped}`,
  );

  if (flags.dryRun || flags.noSync) {
    return { uploads, resourceIds: [] };
  }

  const touched = uploads.filter((u) => u.action !== "skipped");
  const catalogFiles = [];

  for (const u of touched) {
    let updatedAt = u.updatedAt;
    if (!updatedAt && u.id && u.id !== "dry-run") {
      try {
        const info = await drive.files.get({
          fileId: u.id,
          fields: "modifiedTime",
          supportsAllDrives: true,
        });
        updatedAt = info.data.modifiedTime;
      } catch {
        updatedAt = new Date().toISOString();
      }
    }
    catalogFiles.push({
      id: u.id,
      name: u.name,
      path: `${resolvedPath}/${u.relativePath || u.name}`.replace(/\\/g, "/"),
      updatedAt: updatedAt || new Date().toISOString(),
    });
  }

  if (catalogFiles.length === 0) {
    console.log("No files to catalog.");
    return { uploads, resourceIds: [] };
  }

  console.log(`\n📚 Catalog upsert (${catalogFiles.length} file(s))…`);
  const result = await upsertResources(catalogFiles, {
    dryRun: false,
    verbose: flags.verbose,
    prune: false,
    updateStats: "bump",
  });

  console.log(
    `   written=${result.stats.resourcesWritten} skipped=${result.stats.resourcesSkipped} reindex=${result.stats.reindexFlagged}`,
  );

  if (flags.index && result.resourceIds.length > 0) {
    console.log(`\n🔍 Indexing ${result.resourceIds.length} resource(s)…`);
    const indexContent = (await import("./index-content.mjs")).default;
    await indexContent({ ids: result.resourceIds });
  }

  if (flags.revalidate) {
    await revalidateProduction();
  }

  return { uploads, resourceIds: result.resourceIds, destPath: resolvedPath };
}

const isDirectRun =
  !!process.argv[1] &&
  import.meta.url === pathToFileURL(pathResolve(process.argv[1])).href;

if (isDirectRun) {
  drivePut(process.argv.slice(2))
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`\n❌ ${err.message}\n`);
      process.exit(1);
    });
}

export default drivePut;
