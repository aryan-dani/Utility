/**
 * Normalizes Drive folder names to the project's convention:
 *   <BRANCH>/Sem_<N>_<BRANCH>/<Category>/<Subject>/file
 * Category folders: Sem_<N>_Notes | Sem_<N>_PPT | Sem_<N>_PYQ | Sem_<N>_QB | Sem_<N>_WriteUps | Sem_<N>_Codes
 *
 * Usage: node runtime/tools/normalize-drive.mjs [--apply]
 * Default is dry-run. Pass --apply to rename folders.
 */
import { env } from "../lib/env.mjs";
import { getDrive } from "../lib/drive.mjs";
import { listDriveScopes } from "../lib/academicYear.mjs";

const apply = process.argv.includes("--apply");
const dryRun = !apply;
const drive = getDrive(["https://www.googleapis.com/auth/drive"]);
const rootId = env["GOOGLE_DRIVE_FOLDER_ID"];

const CATEGORY_MAP = [
  { re: /notes/i, name: (n) => `Sem_${n}_Notes` },
  { re: /ppt|presentation/i, name: (n) => `Sem_${n}_PPT` },
  { re: /pyq|old.?paper/i, name: (n) => `Sem_${n}_PYQ` },
  { re: /question[_\s-]?bank|\bqb\b/i, name: (n) => `Sem_${n}_QB` },
  { re: /write.?ups?/i, name: (n) => `Sem_${n}_WriteUps` },
  { re: /\bcodes?\b/i, name: (n) => `Sem_${n}_Codes` },
];

async function listChildren(folderId) {
  const out = [];
  let pageToken = null;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    out.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return out;
}

async function rename(fileId, newName, label) {
  if (dryRun) {
    console.log(`  [dry-run] ${label} → ${newName}`);
    return;
  }
  await drive.files.update({
    fileId,
    requestBody: { name: newName },
    supportsAllDrives: true,
  });
  console.log(`  ✅ Renamed: ${label} → ${newName}`);
}

async function normalize() {
  if (!rootId) throw new Error("Missing GOOGLE_DRIVE_FOLDER_ID");
  console.log(`\n🔧 Normalizing Drive folder names${dryRun ? " (dry-run)" : ""}...\n`);

  const scopes = await listDriveScopes(listChildren, rootId);

  for (const scope of scopes) {
    const yearLabel = scope.academicYear ? `${scope.academicYear}/` : "";
    const branches = (await listChildren(scope.containerId)).filter(
      (f) => f.mimeType === "application/vnd.google-apps.folder",
    );

    for (const branch of branches) {
      const branchName = branch.name.toUpperCase();
      console.log(`📁 ${yearLabel}${branch.name}`);

    const semFolders = (await listChildren(branch.id)).filter(
      (f) => f.mimeType === "application/vnd.google-apps.folder",
    );

    for (const sem of semFolders) {
      let semName = sem.name;
      const loose = semName.match(/^sem[_\s-]?(\d+)$/i);
      const matched = semName.match(/Sem[_\s-]?(\d+)[_\s-]?(\w+)?/i);

      if (loose) {
        const n = loose[1];
        const target = `Sem_${n}_${branchName}`;
        if (semName !== target) {
          await rename(sem.id, target, semName);
          semName = target;
        }
      } else if (matched) {
        const n = matched[1];
        const target = `Sem_${n}_${branchName}`;
        if (semName !== target) {
          await rename(sem.id, target, semName);
          semName = target;
        }
      } else {
        console.log(`  ⚠️  Skipping non-semester folder: ${semName}`);
        continue;
      }

      const semNum = semName.match(/Sem_(\d+)_/i)?.[1];
      if (!semNum) continue;

      const cats = (await listChildren(sem.id)).filter(
        (f) => f.mimeType === "application/vnd.google-apps.folder",
      );

      for (const cat of cats) {
        for (const rule of CATEGORY_MAP) {
          if (rule.re.test(cat.name)) {
            const target = rule.name(semNum);
            if (cat.name !== target) {
              await rename(cat.id, target, `${semName}/${cat.name}`);
            }
            break;
          }
        }
      }
    }
    }
  }

  console.log(`\n✨ Normalize complete.\n`);
}

normalize().catch((err) => {
  console.error(err);
  process.exit(1);
});
