import type { getDb } from "../db/client.js";
import { resources, subjects } from "../db/schema.js";
import {
  parseAcademicPath,
  resourceIdFromPath,
  subjectIdFromParts,
} from "../worker/jobs/driveSync.js";
import { syncCatalogs, type CatalogSyncResult } from "./catalogSync.js";

type Db = ReturnType<typeof getDb>;

export type IngestResult =
  | { ok: true; resourceId: string; catalog: CatalogSyncResult }
  | { ok: false; reason: string };

/**
 * Publishes one admin upload into the vault without waiting for the Drive sync.
 * It writes the same subject and resource rows the sync would, leaves any existing
 * native mirror in place, and clears driveModifiedAt so the next sync re-mirrors
 * the file and fills in its native copy.
 */
export async function ingestDriveFile(
  db: Db,
  input: { driveFileId: string; path: string },
): Promise<IngestResult> {
  const parsed = parseAcademicPath(input.path);
  if (!parsed) return { ok: false, reason: "path_not_recognized" };

  const resourceId = resourceIdFromPath(input.path);
  const subjectId = subjectIdFromParts(
    parsed.academicYear,
    parsed.branch,
    parsed.semester,
    parsed.subject,
  );
  const previewUrl = `https://drive.google.com/file/d/${input.driveFileId}/preview`;

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

  await db
    .insert(resources)
    .values({
      id: resourceId,
      subjectId,
      title: parsed.title,
      category: parsed.category,
      academicYear: parsed.academicYear,
      branch: parsed.branch,
      semester: parsed.semester,
      driveFileId: input.driveFileId,
      drivePath: input.path,
      driveModifiedAt: null,
      fileUrl: previewUrl,
      native: null,
    })
    .onConflictDoUpdate({
      target: resources.id,
      set: {
        subjectId,
        title: parsed.title,
        category: parsed.category,
        academicYear: parsed.academicYear,
        branch: parsed.branch,
        semester: parsed.semester,
        driveFileId: input.driveFileId,
        drivePath: input.path,
        driveModifiedAt: null,
        fileUrl: previewUrl,
        updatedAt: new Date(),
      },
    });

  const catalog = await syncCatalogs(db);
  return { ok: true, resourceId, catalog };
}
