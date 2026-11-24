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
import { syncCatalogs } from "../../lib/catalogSync.js";
import { chunkText } from "../../lib/textChunks.js";
import { indexPdfBuffer } from "../../lib/pdfIndex.js";

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

/** Must match runtime/lib/driveCatalog.mjs generateId (existing Firestore IDs). */
function generateId(input: string): string {
  const hash = createHash("sha256").update(input).digest("hex");
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(12, 15)}-a${hash.substring(15, 18)}-${hash.substring(18, 30)}`;
}

export function resourceIdFromPath(path: string): string {
  return generateId(path);
}

export function subjectIdFromParts(
  academicYear: string,
  branch: string,
  semester: number,
  subjectName: string,
): string {
  return generateId(
    `subject-${academicYear}-${branch}-${semester}-${String(subjectName).toLowerCase()}`,
  );
}

function titleCaseSubject(name: string): string {
  return String(name)
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function categoryFromSegment(catSegment: string, fileName = ""): string {
  const cat = String(catSegment || "").toLowerCase();
  if (cat.includes("notes")) return "notes";
  if (cat.includes("ppt") || cat.includes("presentation")) return "ppt";
  if (cat.includes("pyq")) return "pyq";
  if (cat.includes("qb") || cat.includes("question_bank")) {
    return String(fileName).toLowerCase().includes("solved")
      ? "solved-question-bank"
      : "question-bank";
  }
  if (cat.includes("writeup")) return "writeup";
  if (cat.includes("code")) return "codes";
  return "other";
}

/**
 * Real Drive layout (same as runtime parseDrivePath):
 *   [YYYY-YYYY/]<BRANCH>/Sem_<N>_<BRANCH>/Sem_<N>_{Notes|PPT|…}/<Subject>/<File>
 */
export function parseAcademicPath(path: string): {
  academicYear: string;
  branch: string;
  semester: number;
  subject: string;
  title: string;
  category: string;
} | null {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length < 1) return null;

  const academicYear =
    parts[0] && /^\d{4}-\d{4}$/.test(parts[0]) ? parts[0] : "2025-2026";

  const semIndex = parts.findIndex((p) => /Sem_(\d+)_(\w+)/i.test(p));
  if (semIndex === -1) return null;

  const semMatch = parts[semIndex].match(/Sem_(\d+)_(\w+)/i);
  if (!semMatch) return null;
  const semester = parseInt(semMatch[1], 10);
  const branch = semMatch[2].toUpperCase();
  const fileName = parts[parts.length - 1] || "";

  let subject = "General";
  if (fileName.toLowerCase().includes("syllabus")) {
    subject = "Syllabus";
  } else if (parts.length >= semIndex + 4) {
    subject = parts[semIndex + 2];
  }

  const category =
    parts.length >= semIndex + 2
      ? categoryFromSegment(parts[semIndex + 1], fileName)
      : "other";

  return {
    academicYear,
    branch,
    semester,
    subject: titleCaseSubject(subject),
    title: fileName,
    category,
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

/**
 * Rebuilds the vault catalog in Postgres (served by the home server) and writes the
 * Firestore stats doc only when something changed. Vercel is revalidated only then,
 * so an idle sync costs no Firestore writes and no Vercel cache churn.
 */
async function publishCatalogSnapshot(): Promise<void> {
  const db = getDb();
  const result = await syncCatalogs(db);
  if (result.changed === 0) return;

  await adminDb()
    .collection("stats")
    .doc("global")
    .set(
      {
        resources: result.resourceCount,
        updated_at: new Date().toISOString(),
      },
      { merge: true },
    );
  await revalidateVercel();
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

type ExistingResource = {
  driveFileId: string | null;
  driveModifiedAt: Date | null;
  native: { hash?: string; ext?: string } | null;
};

async function loadExistingResources(
  db: ReturnType<typeof getDb>,
): Promise<Map<string, ExistingResource>> {
  const rows = await db
    .select({
      id: resources.id,
      driveFileId: resources.driveFileId,
      driveModifiedAt: resources.driveModifiedAt,
      native: resources.native,
    })
    .from(resources);
  return new Map(rows.map((r) => [r.id, r]));
}

/** True when the stored row matches the Drive version and the mirrored file is on disk. */
async function isUnchanged(
  prev: ExistingResource | undefined,
  file: { id: string; modifiedTime?: string | null },
  rid: string,
  filesRoot: string,
): Promise<boolean> {
  if (!prev || prev.driveFileId !== file.id) return false;
  if (!prev.native?.hash || !prev.native?.ext) return false;
  if (!file.modifiedTime) return false;
  const storedMs = prev.driveModifiedAt ? prev.driveModifiedAt.getTime() : null;
  if (storedMs === null || storedMs !== new Date(file.modifiedTime).getTime()) {
    return false;
  }
  try {
    await access(
      join(filesRoot, "r", rid, `${prev.native.hash}.${prev.native.ext}`),
    );
    return true;
  } catch {
    return false;
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
  // Incremental runs skip files whose Drive version and mirrored copy are unchanged.
  // Full runs reprocess everything (repair mode).
  const existing =
    payload.mode === "incremental"
      ? await loadExistingResources(db)
      : new Map<string, ExistingResource>();

  let mirrored = 0;
  let unchanged = 0;
  let pathSkipped = 0;
  let downloadFailed = 0;
  for (const file of files) {
    const parsed = parseAcademicPath(file.path);
    if (!parsed) {
      pathSkipped += 1;
      continue;
    }
    const rid = resourceIdFromPath(file.path);
    if (
      payload.mode === "incremental" &&
      (await isUnchanged(existing.get(rid), file, rid, filesRoot))
    ) {
      unchanged += 1;
      continue;
    }
    const subjectId = subjectIdFromParts(
      parsed.academicYear,
      parsed.branch,
      parsed.semester,
      parsed.subject,
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
      downloadFailed += 1;
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

    const native: {
      kind: typeof kind;
      hash: string;
      bytes: number;
      ext: string;
      convertedFrom?: string;
    } = {
      kind,
      hash,
      bytes: buf.length,
      ext: ext.replace(/^\./, ""),
    };
    // Firestore rejects explicit `undefined` fields — only set when converted.
    if (convertedFrom) {
      native.convertedFrom = convertedFrom.replace(/^\./, "");
    }

    const previewUrl = `https://drive.google.com/file/d/${file.id}/preview`;
    await db
      .insert(resources)
      .values({
        id: rid,
        subjectId,
        title: parsed.title,
        category: parsed.category,
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
          category: parsed.category,
          subjectId,
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

    // Attach native meta on the live Firestore resource doc (viewer cold path).
    try {
      await adminDb()
        .collection("resources")
        .doc(rid)
        .set(
          {
            native,
            drive_file_id: file.id,
            drive_path: file.path,
            file_url: previewUrl,
            category: parsed.category,
            subject_id: subjectId,
            title: parsed.title,
            academic_year: parsed.academicYear,
            branch: parsed.branch,
            semester: parsed.semester,
          },
          { merge: true },
        );
    } catch (err) {
      console.warn("firestore resource native update failed", rid, err);
    }

    // PDFs: extract text from the bytes already in memory so search and summaries work on home.
    if (kind === "pdf") {
      try {
        await indexPdfBuffer(
          db,
          {
            id: rid,
            academicYear: parsed.academicYear,
            branch: parsed.branch,
            semester: parsed.semester,
          },
          buf,
        );
      } catch (err) {
        console.warn("pdf index failed", rid, err);
      }
    }

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

  console.log(
    `drive.sync ${payload.mode}: listed=${files.length} mirrored=${mirrored} unchanged=${unchanged} pathSkipped=${pathSkipped} downloadFailed=${downloadFailed}`,
  );
}
