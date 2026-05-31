/**
 * runtime/tools/upload-drive.mjs
 * Recursively uploads a local folder to the configured Google Drive shared folder.
 * Preserves folder structures and triggers Google Drive to Firestore Sync upon completion.
 */

import { google } from "googleapis";
import { readFileSync, existsSync, readdirSync, statSync, createReadStream } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import syncDrive from "./sync-drive.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Env loading ────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = join(__dirname, "..", "..", ".env.local");
  if (!existsSync(envPath)) {
    return process.env;
  }

  const content = readFileSync(envPath, "utf-8");
  const parsed = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return { ...process.env, ...parsed };
}

const env = loadEnv();

const clientEmail = env["FIREBASE_CLIENT_EMAIL"];
const privateKey = env["FIREBASE_PRIVATE_KEY"]
  ? env["FIREBASE_PRIVATE_KEY"].replace(/\\n/g, "\n")
  : undefined;
const driveFolderId = env["GOOGLE_DRIVE_FOLDER_ID"];

if (!clientEmail || !privateKey) {
  throw new Error("❌ Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY in .env.local");
}
if (!driveFolderId) {
  throw new Error("❌ Missing GOOGLE_DRIVE_FOLDER_ID in .env.local");
}

// Authenticate Google Drive API
const auth = new google.auth.JWT({
  email: clientEmail,
  key: privateKey,
  scopes: ["https://www.googleapis.com/auth/drive"]
});
const drive = google.drive({ version: "v3", auth });

// ── Helper functions for Drive traversal ───────────────────────────────────────

/** Get or create a folder in Google Drive */
async function getOrCreateFolder(name, parentId) {
  const cleanName = name.replace(/'/g, "\\'");
  const q = `name = '${cleanName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  
  const res = await drive.files.list({
    q,
    fields: "files(id, name)",
    pageSize: 1
  });

  const files = res.data.files || [];
  if (files.length > 0) {
    return files[0].id;
  }

  // Create folder
  const folderMetadata = {
    name,
    mimeType: "application/vnd.google-apps.folder",
    parents: [parentId]
  };

  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: "id"
  });

  console.log(`  📁 Created remote folder: ${name}`);
  return folder.data.id;
}

/** Check if a file exists inside a folder in Google Drive */
async function fileExistsInFolder(name, parentId) {
  const cleanName = name.replace(/'/g, "\\'");
  const q = `name = '${cleanName}' and '${parentId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
  
  const res = await drive.files.list({
    q,
    fields: "files(id, name)",
    pageSize: 1
  });

  const files = res.data.files || [];
  return files.length > 0 ? files[0].id : null;
}

/** Recursively upload a local directory to Google Drive */
async function uploadDirectory(localPath, driveParentId) {
  const items = readdirSync(localPath);

  for (const item of items) {
    const itemPath = join(localPath, item);
    const stat = statSync(itemPath);

    if (stat.isDirectory()) {
      // 1. Get or create matching directory in Drive
      const subFolderId = await getOrCreateFolder(item, driveParentId);
      // 2. Recurse into directory
      await uploadDirectory(itemPath, subFolderId);
    } else {
      // 3. Upload file if it doesn't already exist on Drive
      const existingId = await fileExistsInFolder(item, driveParentId);
      if (existingId) {
        console.log(`  ⏭️  Skipping existing file: ${item}`);
        continue;
      }

      console.log(`  ⬆️  Uploading: ${item}...`);
      await drive.files.create({
        requestBody: {
          name: item,
          parents: [driveParentId]
        },
        media: {
          body: createReadStream(itemPath)
        },
        fields: "id"
      });
      console.log(`  ✅ Uploaded: ${item}`);
    }
  }
}

// ── Main Upload Process ────────────────────────────────────────────────────────

async function startUpload() {
  const args = process.argv.slice(2);
  const localTarget = args[0];

  if (!localTarget || !existsSync(localTarget)) {
    console.error("❌ Error: Please specify a valid local directory path to upload.");
    console.log("Usage: node runtime/tools/upload-drive.mjs <local_directory_path>");
    process.exit(1);
  }

  const stat = statSync(localTarget);
  if (!stat.isDirectory()) {
    console.error("❌ Error: Target path is a file, must be a directory.");
    process.exit(1);
  }

  console.log(`\n📤 Starting Google Drive Upload from: ${localTarget}\n`);
  
  try {
    // Determine target parent folder on Drive (either root folder or subfolder match)
    const targetFolderBasename = basename(localTarget);
    let targetParentId = driveFolderId;

    // If uploading a standard Sem_X folder (like Sem_4_AIDS), create/use it on Drive root
    if (targetFolderBasename.toLowerCase().startsWith("sem_")) {
      targetParentId = await getOrCreateFolder(targetFolderBasename, driveFolderId);
      await uploadDirectory(localTarget, targetParentId);
    } else {
      await uploadDirectory(localTarget, driveFolderId);
    }

    console.log(`\n🎉 Upload completed successfully!`);

    // Trigger Drive sync to Firestore
    await syncDrive();

  } catch (error) {
    console.error(`\n❌ Upload failed: ${error.message}`);
    process.exit(1);
  }
}

startUpload();
