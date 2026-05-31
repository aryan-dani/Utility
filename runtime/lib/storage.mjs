/**
 * runtime/lib/storage.mjs
 * Bucket and file operations using Firebase Storage.
 */

import { bucket } from "./firebase.mjs";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";

// ── Buckets ────────────────────────────────────────────────────────────────────

/** List all storage buckets. */
export async function listBuckets() {
  return [{ name: bucket.name }];
}

// ── Files ──────────────────────────────────────────────────────────────────────

/**
 * List immediate children of a path in a bucket.
 */
export async function listFiles(bucketName, path = "", options = {}) {
  const prefix = path ? (path.endsWith('/') ? path : path + '/') : '';
  const [files, nextQuery] = await bucket.getFiles({
    prefix,
    delimiter: '/'
  });

  const results = [];
  
  // Folders are in nextQuery.prefixes
  if (nextQuery && nextQuery.prefixes) {
    for (const folder of nextQuery.prefixes) {
      const folderName = folder.replace(prefix, '').replace('/', '');
      if (folderName) {
        results.push({
          name: folderName,
          id: null,
          metadata: {}
        });
      }
    }
  }

  // Files
  for (const file of files) {
    // getFiles prefix includes the directory itself, skip it if it is the prefix folder itself
    if (file.name === prefix) continue;
    const name = file.name.replace(prefix, '');
    const [metadata] = await file.getMetadata().catch(() => [{}]);
    results.push({
      name,
      id: file.name,
      metadata: {
        size: parseInt(metadata.size || 0),
        mimetype: metadata.contentType
      },
      updated_at: metadata.updated
    });
  }

  return results;
}

/**
 * Recursively list ALL files in a bucket (or a sub-path).
 * Returns full relative paths as strings.
 */
export async function listAllFiles(bucketName, prefix = "") {
  const queryPrefix = prefix ? (prefix.endsWith('/') ? prefix : prefix + '/') : '';
  const [files] = await bucket.getFiles({ prefix: queryPrefix });
  
  const results = [];
  for (const file of files) {
    if (file.name === queryPrefix || file.name.endsWith('/')) continue;
    const [metadata] = await file.getMetadata().catch(() => [{}]);
    results.push({
      path: file.name,
      name: file.name.split("/").pop(),
      size: parseInt(metadata.size || 0),
      contentType: metadata.contentType || "application/octet-stream",
      updatedAt: metadata.updated || new Date().toISOString()
    });
  }
  return results;
}

/**
 * Build a directory tree structure from a flat list of file paths.
 */
export function buildFileTree(files) {
  const tree = {};
  for (const file of files) {
    const parts = (typeof file === "string" ? file : file.path).split("/");
    let node = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] = node[parts[i]] || {};
      node = node[parts[i]];
    }
    const name = parts[parts.length - 1];
    node[name] = typeof file === "object" ? file : { path: file };
  }
  return tree;
}

// ── Download ───────────────────────────────────────────────────────────────────

/**
 * Download a file from storage and return its Buffer.
 */
export async function downloadFile(bucketName, path) {
  const file = bucket.file(path);
  const [content] = await file.download();
  return content;
}

/**
 * Download a file and save it to a local path.
 */
export async function downloadToLocal(bucketName, path, localPath) {
  const buffer = await downloadFile(bucketName, path);
  const dir = dirname(localPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(localPath, buffer);
  console.log(`  ✅ Downloaded → ${localPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
  return buffer;
}

// ── Upload ─────────────────────────────────────────────────────────────────────

/**
 * Upload a buffer to storage.
 */
export async function uploadFile(bucketName, path, buffer, contentType = "application/octet-stream") {
  const file = bucket.file(path);
  await file.save(buffer, {
    metadata: { contentType },
    resumable: false
  });
  return { path };
}

// ── Delete ─────────────────────────────────────────────────────────────────────

/**
 * Delete one or more files from storage.
 */
export async function deleteFile(bucketName, paths) {
  const pathArr = Array.isArray(paths) ? paths : [paths];
  for (const p of pathArr) {
    await bucket.file(p).delete().catch(err => {
      console.warn(`Warning deleting ${p}: ${err.message}`);
    });
  }
  return { success: true };
}

// ── URLs ───────────────────────────────────────────────────────────────────────

/**
 * Get the public URL for a file.
 */
export function getPublicUrl(bucketName, path) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media`;
}

/**
 * Get a signed (temporary) URL for a private file.
 */
export async function getSignedUrl(bucketName, path, expiresInSeconds = 3600) {
  const [url] = await bucket.file(path).getSignedUrl({
    action: 'read',
    expires: Date.now() + expiresInSeconds * 1000
  });
  return url;
}

// ── Metadata ───────────────────────────────────────────────────────────────────

/**
 * Get metadata for a specific file (size, mime type, etc).
 */
export async function getFileMetadata(bucketName, path) {
  const file = bucket.file(path);
  const [metadata] = await file.getMetadata();
  return {
    name: path.split("/").pop(),
    id: file.name,
    metadata: {
      size: parseInt(metadata.size || 0),
      mimetype: metadata.contentType
    },
    updated_at: metadata.updated
  };
}
