/**
 * scripts/sync-supabase-to-drive.mjs
 * 
 * Fetches all files from the Supabase Storage bucket and uploads them to Google Drive.
 * Preserves the folder structure, avoids duplicates, and handles pagination.
 * 
 * Usage:
 *   node scripts/sync-supabase-to-drive.mjs
 */

import { google } from "googleapis";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Env loading ────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = join(__dirname, "..", ".env.local");
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

// Google Drive Config (Service Account)
const clientEmail = env["FIREBASE_CLIENT_EMAIL"];
const privateKey = env["FIREBASE_PRIVATE_KEY"]
  ? env["FIREBASE_PRIVATE_KEY"].replace(/\\n/g, "\n")
  : undefined;
const driveFolderId = env["GOOGLE_DRIVE_FOLDER_ID"];

// Google Drive Config (OAuth2 User)
const oAuthClientId = env["GOOGLE_CLIENT_ID"];
const oAuthClientSecret = env["GOOGLE_CLIENT_SECRET"];
const oAuthRefreshToken = env["GOOGLE_REFRESH_TOKEN"];

// Supabase Config (Fallbacks to hardcoded values from scripts/download-supabase.js)
const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"] || env["SUPABASE_URL"] || "https://ojdoyjerfdbdhqueachg.supabase.co";
const SERVICE_ROLE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"] || env["SERVICE_ROLE_KEY"] || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qZG95amVyZmRiZGhxdWVhY2hnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODU5OTc1NCwiZXhwIjoyMDk0MTc1NzU0fQ.fDbfQWenEcMSmAe-biOD-_CJN9GPSAygooW_eKJmq6w";
const BUCKET = env["SUPABASE_BUCKET"] || "course-content";

if (!driveFolderId) {
  throw new Error("❌ Missing GOOGLE_DRIVE_FOLDER_ID in .env.local");
}

let auth;
if (oAuthClientId && oAuthClientSecret && oAuthRefreshToken) {
  console.log("🔑 Using User OAuth2 Client Authentication (bypassing service account quota)...");
  auth = new google.auth.OAuth2(
    oAuthClientId,
    oAuthClientSecret,
    "http://localhost:3000/oauth2callback"
  );
  auth.setCredentials({ refresh_token: oAuthRefreshToken });
} else {
  console.log("🤖 Using Service Account Authentication...");
  if (!clientEmail || !privateKey) {
    throw new Error("❌ Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY (Service Account), or GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN (OAuth2) in .env.local");
  }
  auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"]
  });
}

const drive = google.drive({ version: "v3", auth });

// Headers for Supabase REST API
const headers = {
  "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
  "apikey": SERVICE_ROLE_KEY,
  "Content-Type": "application/json"
};

const folderCache = new Map();

// ── Google Drive Helpers ───────────────────────────────────────────────────────

/** Get or create a folder in Google Drive */
async function getOrCreateFolder(name, parentId) {
  const cacheKey = `${parentId}:${name}`;
  if (folderCache.has(cacheKey)) {
    return folderCache.get(cacheKey);
  }

  const cleanName = name.replace(/'/g, "\\'");
  const q = `name = '${cleanName}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  
  const res = await drive.files.list({
    q,
    fields: "files(id, name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });

  const files = res.data.files || [];
  if (files.length > 0) {
    const folderId = files[0].id;
    folderCache.set(cacheKey, folderId);
    return folderId;
  }

  // Create folder
  const folderMetadata = {
    name,
    mimeType: "application/vnd.google-apps.folder",
    parents: [parentId]
  };

  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: "id",
    supportsAllDrives: true
  });

  const folderId = folder.data.id;
  console.log(`  📁 Created remote folder: ${name}`);
  folderCache.set(cacheKey, folderId);
  return folderId;
}

/** Check if a file exists inside a folder in Google Drive */
async function fileExistsInFolder(name, parentId) {
  const cleanName = name.replace(/'/g, "\\'");
  const q = `name = '${cleanName}' and '${parentId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;
  
  const res = await drive.files.list({
    q,
    fields: "files(id, name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });

  const files = res.data.files || [];
  return files.length > 0 ? files[0].id : null;
}

// ── Supabase Helpers ───────────────────────────────────────────────────────────

/** Recursively retrieve all files from the Supabase bucket with pagination support */
async function listAllSupabaseFiles(prefix = "") {
  console.log(`🔍 Listing Supabase files in folder: "${prefix || 'root'}"...`);
  const files = [];
  let offset = 0;
  const limit = 100;
  
  while (true) {
    const url = `${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`;
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prefix,
        limit,
        offset,
        sortBy: { column: "name", order: "asc" }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to list bucket objects: ${response.statusText} (${response.status})`);
    }
    
    const items = await response.json();
    if (!items || items.length === 0) {
      break;
    }
    
    for (const item of items) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      
      // In Supabase storage, directories usually do not have metadata/id or metadata is null
      if (!item.id || item.metadata === null) {
        // Recurse into folder
        const subFiles = await listAllSupabaseFiles(fullPath);
        files.push(...subFiles);
      } else {
        files.push({
          path: fullPath,
          name: item.name
        });
      }
    }
    
    if (items.length < limit) {
      break;
    }
    offset += limit;
  }
  
  return files;
}

/** Download a single file from Supabase as a Buffer */
async function downloadSupabaseFile(filePath) {
  const url = `${SUPABASE_URL}/storage/v1/object/authenticated/${BUCKET}/${encodeURIComponent(filePath)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download ${filePath}: Status ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ── Main Sync Process ──────────────────────────────────────────────────────────

async function syncSupabaseToDrive() {
  console.log(`\n🚀 Starting Supabase to Google Drive Sync...`);
  console.log(`   - Supabase URL: ${SUPABASE_URL}`);
  console.log(`   - Supabase Bucket: ${BUCKET}`);
  console.log(`   - Google Drive Folder ID: ${driveFolderId}\n`);

  try {
    const files = await listAllSupabaseFiles("");
    console.log(`\n📦 Found ${files.length} total files in Supabase bucket.\n`);

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const percent = (((i + 1) / files.length) * 100).toFixed(0);
      console.log(`[${i + 1}/${files.length}] (${percent}%) Processing: ${file.path}`);

      try {
        const folderParts = file.path.split("/");
        const filename = folderParts.pop();

        // 1. Resolve folder path on Google Drive
        let targetFolderId = driveFolderId;
        if (folderParts.length > 0) {
          for (const part of folderParts) {
            targetFolderId = await getOrCreateFolder(part, targetFolderId);
          }
        }

        // 2. Check if file already exists in target folder
        const existingId = await fileExistsInFolder(filename, targetFolderId);
        if (existingId) {
          console.log(`  ⏭️  Skipping (already exists on Google Drive)`);
          skipCount++;
          continue;
        }

        // 3. Download from Supabase and upload to Google Drive
        console.log(`  ⬇️  Downloading from Supabase...`);
        const buffer = await downloadSupabaseFile(file.path);
        
        console.log(`  ⬆️  Uploading to Google Drive...`);
        const readableStream = Readable.from(buffer);
        await drive.files.create({
          requestBody: {
            name: filename,
            parents: [targetFolderId]
          },
          media: {
            body: readableStream
          },
          fields: "id",
          supportsAllDrives: true
        });

        console.log(`  ✅ Synced successfully (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
        successCount++;

      } catch (err) {
        console.error(`  ❌ Failed to sync:`, err.message);
        failCount++;
      }
    }

    console.log(`\n🎉 Sync Process Finished!`);
    console.log(`   - Successfully Synced: ${successCount}`);
    console.log(`   - Already Existed (Skipped): ${skipCount}`);
    console.log(`   - Failed: ${failCount}`);

  } catch (error) {
    console.error(`\n❌ Sync process crashed:`, error.message);
  }
}

syncSupabaseToDrive();
