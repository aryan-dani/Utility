/**
 * Drive sync job: mirrors changed files, converts Office → PDF via Gotenberg,
 * extracts/chunks/embeds into Postgres, publishes catalog snapshot to Firestore.
 *
 * Reuses path parsing and Drive auth patterns from runtime/ (service account).
 */
import { createHash } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join, extname } from "node:path";
import { google } from "googleapis";
import { eq } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import {
  healthMeta,
  resources,
  resourceChunks,
  resourceContent,
  subjects,
  syncState,
} from "../../db/schema.js";
import { env } from "../../lib/env.js";
import { adminDb } from "../../lib/firebase.js";
import { embedBatch } from "../../lib/embed.js";
import { CHUNK_TARGET_CHARS, CHUNK_OVERLAP_CHARS } from "../../lib/ragConfig.js";

export type DriveSyncPayload = { mode: "incremental" | "full" };

function driveAuth() {
  const e = env();
  const key = e.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");
  const jwt = new google.auth.JWT({
    email: e.FIREBASE_CLIENT_EMAIL,
    key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  return google.drive({ version: "v3", auth: jwt });
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function chunkText(text: string): Array<{ text: string; tokens: string[] }> {
  const clean = text.replace(/\u0000/g, "").trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_TARGET_CHARS) {
    const tokens = tokenize(clean);
    return [{ text: clean, tokens }];
  }
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks: Array<{ text: string; tokens: string[] }> = [];
  let buffer = "";
  for (const sentence of sentences) {
    const candidate = buffer ? `${buffer} ${sentence}` : sentence;
    if (candidate.length > CHUNK_TARGET_CHARS && buffer) {
      chunks.push({ text: buffer.trim(), tokens: tokenize(buffer) });
      const overlap = buffer.slice(-CHUNK_OVERLAP_CHARS);
      buffer = overlap ? `${overlap} ${sentence}` : sentence;
    } else {
      buffer = candidate;
    }
  }
  if (buffer.trim()) {
    chunks.push({ text: buffer.trim(), tokens: tokenize(buffer) });
  }
  return chunks;
}

function resourceIdFromPath(path: string): string {
  const hash = createHash("sha256").update(path).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),
    ((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80)
      .toString(16)
      .padStart(2, "0") + hash.slice(18, 20),
    hash.slice(20, 32),
  ].join("-");
}

function parseAcademicPath(path: string): {
  academicYear: string;
  branch: string;
  semester: number;
  subject: string;
  title: string;
} | null {
  // Expect: Year/Branch/Sem_N/Subject/file.ext
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 5) return null;
  const [academicYear, branch, semFolder, subject, ...rest] = parts;
  const semMatch = /^Sem[_\s-]?(\d+)$/i.exec(semFolder || "");
  if (!semMatch) return null;
  const title = rest.join("/") || subject;
  return {
    academicYear,
    branch,
    semester: Number(semMatch[1]),
    subject,
    title,
  };
}

async function downloadFile(
  drive: ReturnType<typeof driveAuth>,
  fileId: string,
): Promise<Buffer> {
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(res.data as ArrayBuffer);
}

async function exportGoogleDoc(
  drive: ReturnType<typeof driveAuth>,
  fileId: string,
  mime: string,
): Promise<Buffer> {
  const exportMime =
    mime === "application/vnd.google-apps.presentation" ||
    mime === "application/vnd.google-apps.document"
      ? "application/pdf"
      : "text/plain";
  const res = await drive.files.export(
    { fileId, mimeType: exportMime },
    { responseType: "arraybuffer" },
  );
  return Buffer.from(res.data as ArrayBuffer);
}

async function convertWithGotenberg(
  buf: Buffer,
  filename: string,
): Promise<Buffer | null> {
  try {
    const form = new FormData();
    form.append("files", new Blob([new Uint8Array(buf)]), filename);
    const res = await fetch(
      `${env().GOTENBERG_URL}/forms/libreoffice/convert`,
      {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(120_000),
      },
    );
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function nativeKind(
  ext: string,
): "pdf" | "image" | "text" | "notebook" | "other" {
  const e = ext.toLowerCase();
  if (e === ".pdf") return "pdf";
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(e)) return "image";
  if (e === ".ipynb") return "notebook";
  if (
    [".txt", ".md", ".py", ".js", ".ts", ".java", ".c", ".cpp", ".csv", ".json"].includes(
      e,
    )
  ) {
    return "text";
  }
  return "other";
}

async function listAllFiles(
  drive: ReturnType<typeof driveAuth>,
  folderId: string,
): Promise<
  Array<{
    id: string;
    name: string;
    mimeType: string;
    modifiedTime?: string;
    path: string;
  }>
> {
  const out: Array<{
    id: string;
    name: string;
    mimeType: string;
    modifiedTime?: string;
    path: string;
  }> = [];

  async function walk(id: string, prefix: string) {
    let pageToken: string | undefined;
    do {
      const res = await drive.files.list({
        q: `'${id}' in parents and trashed = false`,
        fields:
          "nextPageToken, files(id, name, mimeType, modifiedTime, shortcutDetails)",
        pageSize: 200,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      for (const f of res.data.files || []) {
        if (!f.id || !f.name || !f.mimeType) continue;
        const path = prefix ? `${prefix}/${f.name}` : f.name;
        if (f.mimeType === "application/vnd.google-apps.folder") {
          await walk(f.id, path);
        } else {
          out.push({
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            modifiedTime: f.modifiedTime || undefined,
            path,
          });
        }
      }
      pageToken = res.data.nextPageToken || undefined;
    } while (pageToken);
  }

  await walk(folderId, "");
  return out;
}

async function publishCatalogSnapshot(): Promise<void> {
  const db = getDb();
  const all = await db.select().from(resources);
  const byScope = new Map<string, typeof all>();
  for (const r of all) {
    const key = `${r.academicYear}__${r.branch}__${r.semester}`;
    const list = byScope.get(key) || [];
    list.push(r);
    byScope.set(key, list);
  }
  const firestore = adminDb();
  const batchSize = 400;
  for (const [key, list] of byScope) {
    const [academicYear, branch, semester] = key.split("__");
    const payload = {
      academic_year: academicYear,
      branch,
      semester: Number(semester),
      updated_at: new Date().toISOString(),
      resources: list.map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        subject_id: r.subjectId,
        file_url: r.fileUrl,
        drive_file_id: r.driveFileId,
        native: r.native,
      })),
    };
    await firestore.collection("workspace_catalogs").doc(key).set(payload);
  }
  // Touch global stats
  await firestore.collection("stats").doc("global").set(
    {
      resources: all.length,
      updated_at: new Date().toISOString(),
    },
    { merge: true },
  );
  void batchSize;
}

async function revalidateVercel(): Promise<void> {
  const url = env().VERCEL_REVALIDATE_URL;
  const secret = env().CRON_SECRET;
  if (!url || !secret) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    console.warn("revalidate failed", err);
  }
}

export async function runDriveSync(payload: DriveSyncPayload): Promise<void> {
  const folderId = env().GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    console.warn("GOOGLE_DRIVE_FOLDER_ID missing; skip sync");
    return;
  }
  const drive = driveAuth();
  const files = await listAllFiles(drive, folderId);
  const filesRoot = env().FILES_ROOT;
  await mkdir(filesRoot, { recursive: true });
  const db = getDb();

  let mirrored = 0;
  for (const file of files) {
    const parsed = parseAcademicPath(file.path);
    if (!parsed) continue;
    const rid = resourceIdFromPath(file.path);
    const subjectId = resourceIdFromPath(
      `${parsed.academicYear}/${parsed.branch}/Sem_${parsed.semester}/${parsed.subject}`,
    );

    await db
      .insert(subjects)
      .values({
        id: subjectId,
        name: parsed.subject,
        academicYear: parsed.academicYear,
        branch: parsed.branch,
        semester: parsed.semester,
      })
      .onConflictDoUpdate({
        target: subjects.id,
        set: { name: parsed.subject, updatedAt: new Date() },
      });

    let buf: Buffer;
    try {
      if (file.mimeType.startsWith("application/vnd.google-apps.")) {
        buf = await exportGoogleDoc(drive, file.id, file.mimeType);
      } else {
        buf = await downloadFile(drive, file.id);
      }
    } catch (err) {
      console.warn("download failed", file.path, err);
      continue;
    }

    let ext = extname(file.name).toLowerCase() || ".bin";
    let convertedFrom: string | undefined;
    const office = [".ppt", ".pptx", ".doc", ".docx", ".xls", ".xlsx"];
    if (office.includes(ext) || file.mimeType.includes("presentation")) {
      const pdf = await convertWithGotenberg(buf, file.name);
      if (pdf) {
        convertedFrom = ext;
        buf = pdf;
        ext = ".pdf";
      }
    }
    if (file.mimeType.startsWith("application/vnd.google-apps.")) {
      ext = ".pdf";
    }

    const hash = createHash("sha256").update(buf).digest("hex").slice(0, 32);
    const rel = join("r", rid, `${hash}${ext}`);
    const abs = join(filesRoot, rel);
    await mkdir(dirname(abs), { recursive: true });
    try {
      await access(abs);
    } catch {
      await writeFile(abs, buf);
    }

    // Text preview for text-like files
    const kind = nativeKind(ext);
    if (kind === "text" || kind === "notebook") {
      const preview = buf.toString("utf8").slice(0, 900 * 1024);
      await writeFile(join(filesRoot, "r", rid, `${hash}.txt`), preview);
      await adminDb()
        .collection("resource_previews")
        .doc(rid)
        .set({ text: preview.slice(0, 900 * 1024), updated_at: new Date() });
    }

    const native = {
      kind,
      hash,
      bytes: buf.length,
      ext: ext.replace(/^\./, ""),
      convertedFrom: convertedFrom?.replace(/^\./, ""),
    };

    const previewUrl = `https://drive.google.com/file/d/${file.id}/preview`;
    await db
      .insert(resources)
      .values({
        id: rid,
        subjectId,
        title: parsed.title,
        academicYear: parsed.academicYear,
        branch: parsed.branch,
        semester: parsed.semester,
        driveFileId: file.id,
        drivePath: file.path,
        driveModifiedAt: file.modifiedTime
          ? new Date(file.modifiedTime)
          : null,
        mimeType: file.mimeType,
        fileUrl: previewUrl,
        native,
      })
      .onConflictDoUpdate({
        target: resources.id,
        set: {
          title: parsed.title,
          driveFileId: file.id,
          drivePath: file.path,
          driveModifiedAt: file.modifiedTime
            ? new Date(file.modifiedTime)
            : null,
          mimeType: file.mimeType,
          fileUrl: previewUrl,
          native,
          updatedAt: new Date(),
        },
      });

    // Index text for RAG when we can extract something cheap
    let text = "";
    if (kind === "text" || kind === "notebook") {
      text = buf.toString("utf8").slice(0, 200_000);
    }
    // PDF text extraction is left to a follow-up pass; store raw note for summarize when short
    if (text) {
      await db
        .insert(resourceContent)
        .values({ resourceId: rid, content: text.slice(0, 6000) })
        .onConflictDoUpdate({
          target: resourceContent.resourceId,
          set: { content: text.slice(0, 6000), updatedAt: new Date() },
        });

      const chunks = chunkText(text);
      await db.delete(resourceChunks).where(eq(resourceChunks.resourceId, rid));
      const embeddings = await embedBatch(chunks.map((c) => c.text.slice(0, 2000)));
      for (let idx = 0; idx < chunks.length; idx++) {
        const ch = chunks[idx];
        const emb = embeddings[idx];
        await db.insert(resourceChunks).values({
          id: `${rid}_${idx}`,
          resourceId: rid,
          chunkIndex: idx,
          text: ch.text,
          chunkTokens: ch.tokens.slice(0, 200),
          tokenCount: ch.tokens.length,
          academicYear: parsed.academicYear,
          branch: parsed.branch,
          semester: parsed.semester,
          embedding: emb,
        });
      }
    }

    mirrored += 1;
  }

  await db
    .insert(syncState)
    .values({
      key: "drive",
      value: {
        mode: payload.mode,
        mirrored,
        at: new Date().toISOString(),
      },
    })
    .onConflictDoUpdate({
      target: syncState.key,
      set: {
        value: {
          mode: payload.mode,
          mirrored,
          at: new Date().toISOString(),
        },
        updatedAt: new Date(),
      },
    });

  await db
    .insert(healthMeta)
    .values({ key: "last_sync_at", value: new Date().toISOString() })
    .onConflictDoUpdate({
      target: healthMeta.key,
      set: { value: new Date().toISOString(), updatedAt: new Date() },
    });

  await publishCatalogSnapshot();
  await revalidateVercel();

  const ping = env().HEALTHCHECKS_SYNC_URL;
  if (ping) {
    try {
      await fetch(ping, { signal: AbortSignal.timeout(5000) });
    } catch {
      /* ignore */
    }
  }

  console.log(`drive.sync ${payload.mode}: mirrored=${mirrored}`);
}
