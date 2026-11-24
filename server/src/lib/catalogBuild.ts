import { createHash } from "node:crypto";
import type {
  CatalogPayloadJson,
  CatalogResourceJson,
  CatalogSubjectJson,
} from "../db/schema.js";

/** Pure: turns resource and subject rows into one catalog payload per academic scope. */

export type ResourceRow = {
  id: string;
  title: string;
  category: string | null;
  subjectId: string | null;
  academicYear: string;
  branch: string;
  semester: number;
  driveFileId: string | null;
  drivePath: string | null;
  fileUrl: string | null;
  native: CatalogResourceJson["native"];
  updatedAt: Date;
};

export type SubjectRow = {
  id: string;
  name: string;
  academicYear: string;
  branch: string;
  semester: number;
};

export type CatalogScope = {
  id: string;
  academicYear: string;
  branch: string;
  semester: number;
  payload: CatalogPayloadJson;
  contentHash: string;
  resourceCount: number;
};

export function catalogScopeId(academicYear: string, branch: string, semester: number): string {
  return `${academicYear}__${branch}__${semester}`;
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function buildCatalogScopes(
  resourceRows: ResourceRow[],
  subjectRows: SubjectRow[],
): CatalogScope[] {
  const subjectNames = new Map(subjectRows.map((s) => [s.id, s.name]));

  const resourcesByScope = new Map<string, ResourceRow[]>();
  for (const row of resourceRows) {
    const key = catalogScopeId(row.academicYear, row.branch, row.semester);
    const list = resourcesByScope.get(key) ?? [];
    list.push(row);
    resourcesByScope.set(key, list);
  }

  const subjectsByScope = new Map<string, SubjectRow[]>();
  for (const row of subjectRows) {
    const key = catalogScopeId(row.academicYear, row.branch, row.semester);
    const list = subjectsByScope.get(key) ?? [];
    list.push(row);
    subjectsByScope.set(key, list);
  }

  const scopeKeys = [...new Set([...resourcesByScope.keys(), ...subjectsByScope.keys()])].sort();

  return scopeKeys.map((key) => {
    const [academicYear, branch, semesterText] = key.split("__");
    const semester = Number(semesterText);
    const rows = resourcesByScope.get(key) ?? [];

    const resources: CatalogResourceJson[] = [...rows]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((row) => ({
        id: row.id,
        title: row.title,
        file_url: row.fileUrl ?? "",
        created_at: row.updatedAt.toISOString(),
        subject_name: (row.subjectId && subjectNames.get(row.subjectId)) || "Unknown",
        category: row.category ?? null,
        native: row.native ?? null,
        drive_file_id: row.driveFileId ?? null,
      }));

    const subjects: CatalogSubjectJson[] = (subjectsByScope.get(key) ?? [])
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((s) => ({ id: s.id, name: s.name, branch: s.branch, semester: s.semester }));

    const syllabus = rows.find(
      (row) => /syllabus/i.test(row.title || "") || /syllabus/i.test(row.drivePath || ""),
    );

    const payload: CatalogPayloadJson = {
      resources,
      subjects,
      syllabusUrl: syllabus?.fileUrl || null,
    };

    return {
      id: key,
      academicYear,
      branch,
      semester,
      payload,
      contentHash: sha256(JSON.stringify(payload)),
      resourceCount: resources.length,
    };
  });
}
