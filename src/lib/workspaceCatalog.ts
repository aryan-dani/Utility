import type { AcademicYear } from "@/lib/academic/scope";
import type { ResourceItem } from "@/lib/dataFetcher";

export const WORKSPACE_CATALOG_COLLECTION = "workspace_catalogs";

export type WorkspaceCatalogDoc = {
  academic_year: string;
  branch: string;
  semester: number;
  resources: ResourceItem[];
  syllabusUrl: string | null;
  resource_count: number;
  updated_at: string;
};

/** Stable Firestore doc id for a workspace vault list. */
export function workspaceCatalogId(
  academicYear: string,
  branch: string,
  semester: number,
): string {
  return `${academicYear}__${branch}__${semester}`;
}

export function catalogKeyParts(
  academicYear: AcademicYear | string,
  branch: string,
  semester: number,
): { academicYear: string; branch: string; semester: number; id: string } {
  return {
    academicYear,
    branch,
    semester,
    id: workspaceCatalogId(academicYear, branch, semester),
  };
}
