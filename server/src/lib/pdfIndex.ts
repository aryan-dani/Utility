import { PDFParse } from "pdf-parse";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import type { getDb } from "../db/client.js";
import { resourceChunks, resourceContent } from "../db/schema.js";
import { chunkText } from "./textChunks.js";

type Db = ReturnType<typeof getDb>;

const SUMMARY_MAX_CHARS = 6000;
const INSERT_BATCH = 200;

export type PdfResourceRef = {
  id: string;
  academicYear: string;
  branch: string;
  semester: number;
};

/** Plain text for every page of a PDF. Scanned PDFs without a text layer return "". */
export async function extractPdfText(data: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(data) });
  try {
    const result = await parser.getText();
    return (result.text || "").replace(/\u0000/g, "").trim();
  } finally {
    await parser.destroy();
  }
}

/**
 * Replaces a resource's search chunks and summary text in one transaction.
 * PDF chunks are lexical only (no embedding), which matches what the Vercel index held.
 * An empty text still writes a summary row, so the resource is not retried forever.
 */
export async function writePdfIndex(db: Db, ref: PdfResourceRef, text: string): Promise<number> {
  const chunks = chunkText(text);
  await db.transaction(async (tx) => {
    await tx.delete(resourceChunks).where(eq(resourceChunks.resourceId, ref.id));
    for (let start = 0; start < chunks.length; start += INSERT_BATCH) {
      const rows = chunks.slice(start, start + INSERT_BATCH).map((ch, offset) => {
        const idx = start + offset;
        return {
          id: `${ref.id}_${idx}`,
          resourceId: ref.id,
          chunkIndex: idx,
          text: ch.text,
          chunkTokens: ch.tokens.slice(0, 200),
          tokenCount: ch.tokens.length,
          academicYear: ref.academicYear,
          branch: ref.branch,
          semester: ref.semester,
          embedding: null,
        };
      });
      await tx.insert(resourceChunks).values(rows);
    }
    const summary = text.slice(0, SUMMARY_MAX_CHARS);
    await tx
      .insert(resourceContent)
      .values({ resourceId: ref.id, content: summary })
      .onConflictDoUpdate({
        target: resourceContent.resourceId,
        set: { content: summary, updatedAt: new Date() },
      });
  });
  return chunks.length;
}

/** Extracts and indexes one PDF buffer. Returns the number of chunks written (0 = no text). */
export async function indexPdfBuffer(db: Db, ref: PdfResourceRef, data: Buffer): Promise<number> {
  let text = "";
  try {
    text = await extractPdfText(data);
  } catch (err) {
    console.warn("pdf text extraction failed", ref.id, err);
  }
  return writePdfIndex(db, ref, text);
}

/** Reads a mirrored PDF from the files volume and indexes it. */
export async function indexMirroredPdf(
  db: Db,
  ref: PdfResourceRef,
  native: { hash: string; ext: string },
  filesRoot: string,
): Promise<number> {
  const abs = join(filesRoot, "r", ref.id, `${native.hash}.${native.ext}`);
  const data = await readFile(abs);
  return indexPdfBuffer(db, ref, data);
}
