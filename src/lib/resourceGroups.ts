import { ResourceItem } from "@/lib/dataFetcher";
import { subjectToSlug } from "@/lib/resourceUrl";
import {
  getFileExtension,
  isNotebookExtension,
} from "@/lib/fileUtils";
import {
  isDatasetResource,
  parseAssignmentKey,
  parseWriteUpKey,
} from "@/lib/resourceLinks";

export type ResourceFileRole =
  | "writeup"
  | "notebook"
  | "code"
  | "dataset"
  | "notes"
  | "ppt"
  | "pyq"
  | "qb"
  | "other";

export type FolderKind = "assignment" | "unit" | "year" | "other";

export interface ResourceFolderNode {
  id: string;
  kind: FolderKind;
  /** Display label, e.g. "Assignment 1" or "Unit 2" */
  label: string;
  /** Sort key: numeric for assignment/unit/year */
  sortKey: number;
  /** Full key for letter variants, e.g. "2A" */
  key?: string;
  files: ResourceItem[];
  children: ResourceFolderNode[];
}

const ROMAN_TO_INT: Record<string, number> = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
};

/** Parse Unit_N / Unit I / Unit-2 from a filename. Returns arabic number or null. */
export function parseUnitKey(title: string): { num: number; raw: string } | null {
  const clean = title.replace(/[_\-]+/g, " ");
  const arabic = clean.match(/\bUnit\s*(\d+)\b/i);
  if (arabic) {
    const num = parseInt(arabic[1], 10);
    if (Number.isFinite(num)) return { num, raw: String(num) };
  }
  const roman = clean.match(/\bUnit\s*([IVX]+)\b/i);
  if (roman) {
    const raw = roman[1].toUpperCase();
    const num = ROMAN_TO_INT[raw];
    if (num) return { num, raw };
  }
  return null;
}

/** Parse a 4-digit year (2000–2099) from PYQ-style titles. */
export function parseYearKey(title: string): number | null {
  const match = title.match(/\b(20\d{2})\b/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  return Number.isFinite(year) ? year : null;
}

export function getResourceFileRole(item: ResourceItem): ResourceFileRole {
  if (isDatasetResource(item)) return "dataset";
  if (item.category === "writeup") return "writeup";
  const ext = getFileExtension(item.title, item.file_url);
  if (isNotebookExtension(ext)) return "notebook";
  if (item.category === "codes") return "code";
  if (item.category === "notes") return "notes";
  if (item.category === "ppt") return "ppt";
  if (item.category === "pyq") return "pyq";
  if (
    item.category === "question-bank" ||
    item.category === "solved-question-bank"
  ) {
    return "qb";
  }
  return "other";
}

/** Role sort order inside an assignment folder. */
const ROLE_ORDER: Record<ResourceFileRole, number> = {
  writeup: 0,
  notebook: 1,
  code: 2,
  dataset: 3,
  notes: 4,
  ppt: 5,
  pyq: 6,
  qb: 7,
  other: 8,
};

function sortFilesByRole(files: ResourceItem[]): ResourceItem[] {
  return [...files].sort((a, b) => {
    const roleDiff =
      ROLE_ORDER[getResourceFileRole(a)] - ROLE_ORDER[getResourceFileRole(b)];
    if (roleDiff !== 0) return roleDiff;
    return a.title.localeCompare(b.title, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

function assignmentBaseNum(key: string): number {
  const match = key.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function isLetterVariant(key: string): boolean {
  return /^(\d+)[A-Z]+$/i.test(key);
}

function folderSlug(kind: FolderKind, key: string | number): string {
  if (kind === "assignment") return `assignment-${String(key).toLowerCase()}`;
  if (kind === "unit") return `unit-${key}`;
  if (kind === "year") return `year-${key}`;
  return `other`;
}

const FOLDER_SCOPE_SEP = "::";

/** URL-safe subject prefix so folder ids do not collide across subjects. */
export function subjectFolderScope(subjectName: string): string {
  return subjectToSlug(subjectName).toLowerCase();
}

export function scopedFolderId(subjectName: string, baseId: string): string {
  return `${subjectFolderScope(subjectName)}${FOLDER_SCOPE_SEP}${baseId}`;
}

export function unscopedFolderId(scopedId: string): string {
  const idx = scopedId.indexOf(FOLDER_SCOPE_SEP);
  if (idx === -1) return scopedId;
  return scopedId.slice(idx + FOLDER_SCOPE_SEP.length);
}

export function folderScopeSubject(scopedId: string): string | null {
  const idx = scopedId.indexOf(FOLDER_SCOPE_SEP);
  if (idx === -1) return null;
  try {
    return decodeURIComponent(scopedId.slice(0, idx));
  } catch {
    return scopedId.slice(0, idx);
  }
}

export function assignmentFolderId(key: string, subjectName?: string): string {
  const base = folderSlug("assignment", assignmentBaseNum(key) || key);
  return subjectName ? scopedFolderId(subjectName, base) : base;
}

export function unitFolderId(num: number, subjectName?: string): string {
  const base = folderSlug("unit", num);
  return subjectName ? scopedFolderId(subjectName, base) : base;
}

export function yearFolderId(year: number, subjectName?: string): string {
  const base = folderSlug("year", year);
  return subjectName ? scopedFolderId(subjectName, base) : base;
}

function otherFolderId(subjectName?: string): string {
  const base = "other";
  return subjectName ? scopedFolderId(subjectName, base) : base;
}

/**
 * Group writeups + codes (+ datasets) into Assignment folders.
 * Letter variants (2A, 2B) nest under Assignment 2.
 */
export function groupByAssignment(
  items: ResourceItem[],
  subjectName?: string,
): ResourceFolderNode[] {
  type Bucket = {
    key: string;
    files: ResourceItem[];
  };

  const buckets = new Map<string, Bucket>();
  const ungrouped: ResourceItem[] = [];

  for (const item of items) {
    const key =
      parseAssignmentKey(item.title) || parseWriteUpKey(item.title);
    if (!key) {
      ungrouped.push(item);
      continue;
    }
    const existing = buckets.get(key);
    if (existing) {
      existing.files.push(item);
    } else {
      buckets.set(key, { key, files: [item] });
    }
  }

  // Parent folders keyed by base number
  const parents = new Map<number, ResourceFolderNode>();

  const ensureParent = (num: number): ResourceFolderNode => {
    let parent = parents.get(num);
    if (!parent) {
      parent = {
        id: assignmentFolderId(String(num), subjectName),
        kind: "assignment",
        label: `Assignment ${num}`,
        sortKey: num,
        key: String(num),
        files: [],
        children: [],
      };
      parents.set(num, parent);
    }
    return parent;
  };

  for (const bucket of buckets.values()) {
    const num = assignmentBaseNum(bucket.key);
    const parent = ensureParent(num);
    const files = sortFilesByRole(bucket.files);

    if (isLetterVariant(bucket.key) && bucket.key.toUpperCase() !== String(num)) {
      const childBase = `assignment-${bucket.key.toLowerCase()}`;
      parent.children.push({
        id: subjectName ? scopedFolderId(subjectName, childBase) : childBase,
        kind: "assignment",
        label: `Assignment ${bucket.key.toUpperCase()}`,
        sortKey: num,
        key: bucket.key.toUpperCase(),
        files,
        children: [],
      });
    } else {
      parent.files.push(...files);
    }
  }

  // Sort children and files within each parent
  const result = Array.from(parents.values())
    .map((parent) => {
      parent.files = sortFilesByRole(parent.files);
      parent.children.sort((a, b) =>
        (a.key || "").localeCompare(b.key || "", undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      );
      return parent;
    })
    .sort((a, b) => a.sortKey - b.sortKey);

  if (ungrouped.length > 0) {
    result.push({
      id: otherFolderId(subjectName),
      kind: "other",
      label: "Other files",
      sortKey: 9999,
      files: sortFilesByRole(ungrouped),
      children: [],
    });
  }

  return result;
}

/** Group notes/PPT by Unit N. */
export function groupByUnit(
  items: ResourceItem[],
  subjectName?: string,
): ResourceFolderNode[] {
  const buckets = new Map<number, ResourceItem[]>();
  const ungrouped: ResourceItem[] = [];

  for (const item of items) {
    const unit = parseUnitKey(item.title);
    if (!unit) {
      ungrouped.push(item);
      continue;
    }
    const list = buckets.get(unit.num) ?? [];
    list.push(item);
    buckets.set(unit.num, list);
  }

  const result: ResourceFolderNode[] = Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([num, files]) => ({
      id: unitFolderId(num, subjectName),
      kind: "unit" as const,
      label: `Unit ${num}`,
      sortKey: num,
      key: String(num),
      files: sortFilesByRole(files),
      children: [] as ResourceFolderNode[],
    }));

  if (ungrouped.length > 0) {
    result.push({
      id: otherFolderId(subjectName),
      kind: "other",
      label: "Other files",
      sortKey: 9999,
      files: sortFilesByRole(ungrouped),
      children: [],
    });
  }

  return result;
}

/** Group PYQ by year. */
export function groupByYear(
  items: ResourceItem[],
  subjectName?: string,
): ResourceFolderNode[] {
  const buckets = new Map<number, ResourceItem[]>();
  const ungrouped: ResourceItem[] = [];

  for (const item of items) {
    const year = parseYearKey(item.title);
    if (!year) {
      ungrouped.push(item);
      continue;
    }
    const list = buckets.get(year) ?? [];
    list.push(item);
    buckets.set(year, list);
  }

  const result: ResourceFolderNode[] = Array.from(buckets.entries())
    .sort(([a], [b]) => b - a) // newest first
    .map(([year, files]) => ({
      id: yearFolderId(year, subjectName),
      kind: "year" as const,
      label: String(year),
      sortKey: year,
      key: String(year),
      files: sortFilesByRole(files),
      children: [] as ResourceFolderNode[],
    }));

  if (ungrouped.length > 0) {
    result.push({
      id: otherFolderId(subjectName),
      kind: "other",
      label: "Other files",
      sortKey: 0,
      files: sortFilesByRole(ungrouped),
      children: [],
    });
  }

  return result;
}

/** Count files in a folder tree (including children). */
export function countFolderFiles(folder: ResourceFolderNode): number {
  return (
    folder.files.length +
    folder.children.reduce((sum, child) => sum + countFolderFiles(child), 0)
  );
}

/** True when the folder (including nested children) contains exactly one file. */
export function isSingletonFolder(folder: ResourceFolderNode): boolean {
  return countFolderFiles(folder) === 1;
}

/** Return the sole file in a singleton folder tree, or null. */
export function singletonFile(folder: ResourceFolderNode): ResourceItem | null {
  if (!isSingletonFolder(folder)) return null;
  if (folder.files.length === 1) return folder.files[0];
  for (const child of folder.children) {
    const file = singletonFile(child);
    if (file) return file;
  }
  return null;
}

/** Collect one file per top-level singleton folder (preserves folder order). */
export function collectSingletonFiles(
  folders: ResourceFolderNode[],
): ResourceItem[] {
  return folders
    .filter(isSingletonFolder)
    .map(singletonFile)
    .filter((item): item is ResourceItem => item !== null);
}

/** True when every top-level folder holds only one file. */
export function allTopLevelSingletons(folders: ResourceFolderNode[]): boolean {
  return folders.length > 0 && folders.every(isSingletonFolder);
}

/** Find a folder by id in a tree (including nested children). */
export function findFolderById(
  folders: ResourceFolderNode[],
  id: string,
): ResourceFolderNode | null {
  for (const folder of folders) {
    if (folder.id === id) return folder;
    const nested = findFolderById(folder.children, id);
    if (nested) return nested;
  }
  return null;
}

/** Resolve which assignment/unit/year folder a resource belongs to. */
export function folderIdForResource(item: ResourceItem): string | null {
  const subject = item.subject_name;
  if (
    item.category === "writeup" ||
    item.category === "codes" ||
    isDatasetResource(item)
  ) {
    const key =
      parseAssignmentKey(item.title) || parseWriteUpKey(item.title);
    if (key) {
      const num = assignmentBaseNum(key);
      // Letter variants (2A/2B) nest under Assignment 2 - deep-link the child folder.
      if (isLetterVariant(key) && key.toUpperCase() !== String(num)) {
        const childBase = `assignment-${key.toLowerCase()}`;
        return subject ? scopedFolderId(subject, childBase) : childBase;
      }
      return assignmentFolderId(String(num || key), subject);
    }
  }
  if (item.category === "notes" || item.category === "ppt") {
    const unit = parseUnitKey(item.title);
    if (unit) return unitFolderId(unit.num, subject);
  }
  if (item.category === "pyq") {
    const year = parseYearKey(item.title);
    if (year) return yearFolderId(year, subject);
  }
  return null;
}

/** Human label for a folder id, e.g. assignment-1 → Assignment 1 */
export function folderLabelFromId(folderId: string | null | undefined): string | null {
  if (!folderId) return null;
  const baseId = unscopedFolderId(folderId);
  const assignment = baseId.match(/^assignment-(.+)$/i);
  if (assignment) return `Assignment ${assignment[1].toUpperCase()}`;
  const unit = baseId.match(/^unit-(\d+)$/i);
  if (unit) return `Unit ${unit[1]}`;
  const year = baseId.match(/^year-(\d+)$/i);
  if (year) return year[1];
  if (baseId === "other") return "Other files";
  return null;
}

/**
 * Collect all siblings in the same assignment (writeups, codes, datasets)
 * for the "This assignment" viewer strip.
 */
export function findAssignmentSiblings(
  resource: ResourceItem,
  pool: ResourceItem[],
): ResourceItem[] {
  const key =
    parseAssignmentKey(resource.title) || parseWriteUpKey(resource.title);
  if (!key) return [];

  const base = String(assignmentBaseNum(key) || key);

  return pool
    .filter((item) => {
      if (item.id === resource.id) return false;
      if (item.subject_name !== resource.subject_name) return false;
      const itemKey =
        parseAssignmentKey(item.title) || parseWriteUpKey(item.title);
      if (!itemKey) return false;
      return String(assignmentBaseNum(itemKey) || itemKey) === base;
    })
    .sort((a, b) => {
      const roleDiff =
        ROLE_ORDER[getResourceFileRole(a)] -
        ROLE_ORDER[getResourceFileRole(b)];
      if (roleDiff !== 0) return roleDiff;
      return a.title.localeCompare(b.title, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
}

/** Subject summary counts for the vault header hint. */
export function subjectSummaryCounts(items: ResourceItem[]): {
  assignments: number;
  notes: number;
  ppt: number;
  pyq: number;
  qb: number;
} {
  const assignmentKeys = new Set<string>();
  let notes = 0;
  let ppt = 0;
  let pyq = 0;
  let qb = 0;

  for (const item of items) {
    if (item.category === "notes") notes++;
    else if (item.category === "ppt") ppt++;
    else if (item.category === "pyq") pyq++;
    else if (
      item.category === "question-bank" ||
      item.category === "solved-question-bank"
    ) {
      qb++;
    } else if (
      item.category === "writeup" ||
      item.category === "codes" ||
      isDatasetResource(item)
    ) {
      const key =
        parseAssignmentKey(item.title) || parseWriteUpKey(item.title);
      if (key) {
        assignmentKeys.add(String(assignmentBaseNum(key) || key));
      }
    }
  }

  return {
    assignments: assignmentKeys.size,
    notes,
    ppt,
    pyq,
    qb,
  };
}

export const FOLDER_SCROLL_ATTR = "data-folder-scroll";

/** CSS selector for a folder scroll anchor (scoped ids may contain `::`). */
export function folderScrollSelector(folderId: string): string {
  return `[${FOLDER_SCROLL_ATTR}="${CSS.escape(folderId)}"]`;
}
