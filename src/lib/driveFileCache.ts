/**
 * Browser-side Cache API for Drive files fetched directly from Google.
 * Bytes never touch a Vercel Function - keeps Fast Origin Transfer near zero.
 */

const CACHE_NAME = "utility-pdf-v2";
const MAX_ENTRIES = 12;
const MAX_TOTAL_BYTES = 300 * 1024 * 1024; // 300 MB
const CLIENT_SOFT_CAP_BYTES = 120 * 1024 * 1024; // 120 MB

const CACHED_AT_HEADER = "x-cached-at";

export type DriveFetchProgress = {
  loaded: number;
  total: number | null;
};

export type FetchCachedDriveFileOptions = {
  onProgress?: (progress: DriveFetchProgress) => void;
  signal?: AbortSignal;
  /** Soft size cap; default 120 MB. */
  maxBytes?: number;
};

export function getDirectDownloadUrl(driveId: string): string {
  return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(driveId)}&export=download&confirm=t`;
}

function cacheKey(driveId: string): string {
  return getDirectDownloadUrl(driveId);
}

async function openCache(): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;
  return caches.open(CACHE_NAME);
}

async function evictIfNeeded(cache: Cache): Promise<void> {
  const keys = await cache.keys();
  if (keys.length === 0) return;

  type Entry = { request: Request; cachedAt: number; size: number };
  const entries: Entry[] = [];
  let totalBytes = 0;

  for (const request of keys) {
    const res = await cache.match(request);
    if (!res) continue;
    const cachedAt = Number(res.headers.get(CACHED_AT_HEADER) || "0");
    const buf = await res.clone().arrayBuffer();
    const size = buf.byteLength;
    totalBytes += size;
    entries.push({ request, cachedAt, size });
  }

  entries.sort((a, b) => a.cachedAt - b.cachedAt);

  while (
    entries.length > MAX_ENTRIES ||
    totalBytes > MAX_TOTAL_BYTES
  ) {
    const oldest = entries.shift();
    if (!oldest) break;
    await cache.delete(oldest.request);
    totalBytes -= oldest.size;
  }
}

export async function clearDriveFileCache(): Promise<void> {
  if (typeof caches === "undefined") return;
  await caches.delete(CACHE_NAME);
}

/** Read a previously cached Drive file. Never hits the network (avoids CORS 403). */
export async function matchCachedDriveFile(
  driveId: string,
): Promise<Blob | null> {
  if (!driveId) return null;
  const cache = await openCache();
  if (!cache) return null;
  const hit = await cache.match(cacheKey(driveId));
  if (!hit) return null;
  return hit.blob();
}

/**
 * Cache-first Drive download.
 *
 * Google's `drive.usercontent.google.com/download` often returns 403 and no
 * `Access-Control-Allow-Origin` for cross-origin fetch(). Callers that preview
 * files should use `matchCachedDriveFile` + Drive iframe instead of this.
 * This network path is only for an explicit user "save offline" action.
 */
export async function fetchCachedDriveFile(
  driveId: string,
  opts: FetchCachedDriveFileOptions = {},
): Promise<Blob> {
  if (!driveId) throw new Error("missing drive id");

  const url = cacheKey(driveId);
  const maxBytes = opts.maxBytes ?? CLIENT_SOFT_CAP_BYTES;
  const cache = await openCache();

  const cached = await matchCachedDriveFile(driveId);
  if (cached) {
    opts.onProgress?.({ loaded: cached.size, total: cached.size });
    return cached;
  }

  const res = await fetch(url, {
    signal: opts.signal,
    method: "GET",
    mode: "cors",
    credentials: "omit",
    redirect: "follow",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`drive download failed (${res.status})`);
  }

  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("text/html")) {
    throw new Error("drive interstitial or quota page");
  }

  const totalHeader = res.headers.get("content-length");
  const total = totalHeader ? Number(totalHeader) : null;
  if (total !== null && Number.isFinite(total) && total > maxBytes) {
    throw new Error("too large");
  }

  if (!res.body) {
    const blob = await res.blob();
    if (blob.size > maxBytes) throw new Error("too large");
    if (cache) {
      await cache.put(
        url,
        new Response(blob, {
          status: 200,
          headers: {
            "Content-Type": contentType || "application/octet-stream",
            [CACHED_AT_HEADER]: String(Date.now()),
          },
        }),
      );
      await evictIfNeeded(cache);
    }
    opts.onProgress?.({ loaded: blob.size, total: blob.size });
    return blob;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      if (loaded > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          /* ignore */
        }
        throw new Error("too large");
      }
      opts.onProgress?.({ loaded, total });
    }
  }

  const blob = new Blob(chunks as BlobPart[], {
    type: contentType || "application/octet-stream",
  });

  if (cache) {
    await cache.put(
      url,
      new Response(blob, {
        status: 200,
        headers: {
          "Content-Type": contentType || "application/octet-stream",
          [CACHED_AT_HEADER]: String(Date.now()),
        },
      }),
    );
    await evictIfNeeded(cache);
  }

  opts.onProgress?.({ loaded: blob.size, total: blob.size });
  return blob;
}
