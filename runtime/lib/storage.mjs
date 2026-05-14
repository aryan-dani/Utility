/**
 * runtime/lib/storage.mjs
 * Bucket and file operations. All bucket/path names are dynamic — nothing hardcoded.
 */

import { getClient, getUrl, getServiceKey } from "./supabase.mjs";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";

const supabase = () => getClient();

// ── Buckets ────────────────────────────────────────────────────────────────────

/** List all storage buckets. */
export async function listBuckets() {
  const { data, error } = await supabase().storage.listBuckets();
  if (error) throw new Error(`listBuckets: ${error.message}`);
  return data ?? [];
}

// ── Files ──────────────────────────────────────────────────────────────────────

/**
 * List immediate children of a path in a bucket.
 * Returns items with { name, id, metadata } — folders have no id.
 */
export async function listFiles(bucket, path = "", options = {}) {
  const { limit = 1000, offset = 0, sortBy } = options;
  const opts = { limit, offset };
  if (sortBy) opts.sortBy = sortBy;
  const { data, error } = await supabase().storage.from(bucket).list(path || undefined, opts);
  if (error) throw new Error(`listFiles("${bucket}", "${path}"): ${error.message}`);
  return data ?? [];
}

/**
 * Recursively list ALL files in a bucket (or a sub-path).
 * Returns full relative paths as strings.
 */
export async function listAllFiles(bucket, prefix = "") {
  const items = await listFiles(bucket, prefix);
  const results = [];
  for (const item of items) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (!item.id) {
      // Folder — recurse
      const children = await listAllFiles(bucket, fullPath);
      results.push(...children);
    } else {
      results.push({ path: fullPath, name: item.name, size: item.metadata?.size, contentType: item.metadata?.mimetype, updatedAt: item.updated_at });
    }
  }
  return results;
}

/**
 * Build a directory tree structure from a flat list of file paths.
 * Returns a nested object for pretty printing.
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
export async function downloadFile(bucket, path) {
  const { data, error } = await supabase().storage.from(bucket).download(path);
  if (error) throw new Error(`downloadFile("${bucket}", "${path}"): ${error.message}`);
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Download a file and save it to a local path.
 */
export async function downloadToLocal(bucket, path, localPath) {
  const buffer = await downloadFile(bucket, path);
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
export async function uploadFile(bucket, path, buffer, contentType = "application/octet-stream") {
  const { data, error } = await supabase()
    .storage.from(bucket)
    .upload(path, buffer, { contentType, upsert: true });
  if (error) throw new Error(`uploadFile("${bucket}", "${path}"): ${error.message}`);
  return data;
}

// ── Delete ─────────────────────────────────────────────────────────────────────

/**
 * Delete one or more files from storage.
 * @param {string} bucket
 * @param {string|string[]} paths
 */
export async function deleteFile(bucket, paths) {
  const pathArr = Array.isArray(paths) ? paths : [paths];
  const { data, error } = await supabase().storage.from(bucket).remove(pathArr);
  if (error) throw new Error(`deleteFile("${bucket}"): ${error.message}`);
  return data;
}

// ── URLs ───────────────────────────────────────────────────────────────────────

/**
 * Get the public URL for a file.
 */
export function getPublicUrl(bucket, path) {
  const { data } = supabase().storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Get a signed (temporary) URL for a private file.
 */
export async function getSignedUrl(bucket, path, expiresInSeconds = 3600) {
  const { data, error } = await supabase()
    .storage.from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw new Error(`getSignedUrl: ${error.message}`);
  return data.signedUrl;
}

// ── Metadata ───────────────────────────────────────────────────────────────────

/**
 * Get metadata for a specific file (size, mime type, etc).
 */
export async function getFileMetadata(bucket, path) {
  const parts = path.split("/");
  const name = parts.pop();
  const folder = parts.join("/");
  const items = await listFiles(bucket, folder);
  const file = items.find((f) => f.name === name);
  if (!file) throw new Error(`File not found: ${path} in bucket "${bucket}"`);
  return file;
}
