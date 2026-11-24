import { sql } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { resources } from "../../db/schema.js";
import { env } from "../../lib/env.js";
import { indexMirroredPdf, writePdfIndex } from "../../lib/pdfIndex.js";

export type PdfBackfillPayload = { limit?: number };

/**
 * One-time (and safe to re-run): indexes mirrored PDFs that have no summary row yet.
 * Resources already indexed are skipped, so a re-run only touches what is missing.
 */
export async function runPdfBackfill(payload: PdfBackfillPayload = {}) {
  const db = getDb();
  const filesRoot = env().FILES_ROOT;
  const limit = Math.min(Math.max(payload.limit ?? 5000, 1), 20000);

  const rows = await db
    .select({
      id: resources.id,
      academicYear: resources.academicYear,
      branch: resources.branch,
      semester: resources.semester,
      native: resources.native,
    })
    .from(resources)
    .where(
      sql`${resources.native}->>'kind' = 'pdf' and not exists (select 1 from resource_content rc where rc.resource_id = ${resources.id})`,
    )
    .limit(limit);

  const counts = { scanned: rows.length, indexed: 0, noText: 0, missingFile: 0, failed: 0 };
  for (const row of rows) {
    const ref = {
      id: row.id,
      academicYear: row.academicYear,
      branch: row.branch,
      semester: row.semester,
    };
    if (!row.native?.hash || !row.native.ext) {
      counts.missingFile += 1;
      await writePdfIndex(db, ref, "");
      continue;
    }
    try {
      const chunks = await indexMirroredPdf(db, ref, row.native, filesRoot);
      if (chunks > 0) counts.indexed += 1;
      else counts.noText += 1;
    } catch (err) {
      if (err instanceof Error && "code" in err && err.code === "ENOENT") {
        counts.missingFile += 1;
        await writePdfIndex(db, ref, "");
      } else {
        counts.failed += 1;
        console.warn("pdf backfill failed", row.id, err);
      }
    }
  }
  console.log("pdf.backfill", JSON.stringify(counts));
  return counts;
}
