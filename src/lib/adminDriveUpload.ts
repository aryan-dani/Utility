/**
 * Canonical Drive paths and filenames for admin uploads.
 * Mirrors runtime/lib/driveCatalog.mjs buildDestSegments and
 * runtime/tools/rename-drive-files.mjs naming rules.
 */

export const ADMIN_UPLOAD_MAX_BYTES = 80 * 1024 * 1024;

export type AdminUploadCategory =
  | "notes"
  | "ppt"
  | "pyq"
  | "qb"
  | "writeups"
  | "codes";

export const ADMIN_UPLOAD_CATEGORIES: {
  value: AdminUploadCategory;
  label: string;
}[] = [
  { value: "notes", label: "Notes" },
  { value: "ppt", label: "Presentation" },
  { value: "pyq", label: "Previous year questions" },
  { value: "qb", label: "Question bank" },
  { value: "writeups", label: "Writeups" },
  { value: "codes", label: "Code / assignment" },
];

const CAT_FOLDER: Record<AdminUploadCategory, string> = {
  notes: "Notes",
  ppt: "PPT",
  pyq: "PYQ",
  qb: "QB",
  writeups: "WriteUps",
  codes: "Codes",
};

const SUBJECT_RE = /^[A-Za-z0-9_]+$/;
const YEAR_RE = /^\d{4}-\d{4}$/;
const UNIT_RE = /^(\d+|[IVX]+)$/i;

const BASE_EXTS = new Set([
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "txt",
]);

const CODE_EXTS = new Set(["ipynb", "py", "zip", ...BASE_EXTS]);

export type AdminUploadDestination = {
  year: string;
  branch: string;
  semester: number;
  subject: string;
  category: AdminUploadCategory;
};

export type AdminFilenameInput = AdminUploadDestination & {
  /** File extension without the leading dot. */
  extension: string;
  unit?: string;
  examYear?: number;
  examTerm?: "Mid" | "End";
  writeupNumber?: string;
  assignmentNumber?: string;
  qbYear?: number;
  qbSolved?: boolean;
  qbPart?: number;
};

export function normalizeSubjectCode(raw: string): string | null {
  const subject = String(raw || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  if (!subject || !SUBJECT_RE.test(subject)) return null;
  return subject.toUpperCase();
}

export function buildAdminDestSegments(input: AdminUploadDestination): string[] {
  const year = String(input.year || "").trim();
  if (!YEAR_RE.test(year)) {
    throw new Error("Invalid academic year. Expected YYYY-YYYY.");
  }
  const branch = String(input.branch || "")
    .trim()
    .toUpperCase();
  if (!SUBJECT_RE.test(branch)) {
    throw new Error("Invalid branch.");
  }
  const semester = Number(input.semester);
  if (!Number.isInteger(semester) || semester < 1 || semester > 8) {
    throw new Error("Invalid semester.");
  }
  const subject = normalizeSubjectCode(input.subject);
  if (!subject) {
    throw new Error("Subject must be letters, digits, or underscores only.");
  }
  if (!(input.category in CAT_FOLDER)) {
    throw new Error("Invalid category.");
  }
  return [
    year,
    branch,
    `Sem_${semester}_${branch}`,
    `Sem_${semester}_${CAT_FOLDER[input.category]}`,
    subject,
  ];
}

export function buildAdminDestPath(input: AdminUploadDestination): string {
  return buildAdminDestSegments(input).join("/");
}

/** Reject any path that is not exactly the canonical dest segments. */
export function assertCanonicalDestPath(
  path: string,
  expected: AdminUploadDestination,
): string {
  const normalized = String(path || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .join("/");
  const expectedPath = buildAdminDestPath(expected);
  if (normalized !== expectedPath) {
    throw new Error("Destination path must match the form fields.");
  }
  return normalized;
}

export function allowedExtensionsFor(
  category: AdminUploadCategory,
): ReadonlySet<string> {
  return category === "codes" ? CODE_EXTS : BASE_EXTS;
}

export function normalizeExtension(raw: string): string | null {
  const ext = String(raw || "")
    .trim()
    .replace(/^\./, "")
    .toLowerCase();
  if (!ext || !/^[a-z0-9]{1,8}$/.test(ext)) return null;
  return ext === "jpeg" ? "jpg" : ext;
}

export function buildAdminRemoteName(input: AdminFilenameInput): string {
  const dest = buildAdminDestPath(input);
  void dest;
  const subject = normalizeSubjectCode(input.subject)!;
  const semester = Number(input.semester);
  const ext = normalizeExtension(input.extension);
  if (!ext) throw new Error("Missing or invalid file extension.");
  if (!allowedExtensionsFor(input.category).has(ext)) {
    throw new Error(`Extension .${ext} is not allowed for ${input.category}.`);
  }

  let base: string;
  switch (input.category) {
    case "notes": {
      const unit = String(input.unit || "").trim();
      if (!unit || !UNIT_RE.test(unit)) {
        throw new Error("Notes require a unit number (e.g. 1 or I).");
      }
      base = `${subject}_Unit_${unit}_Notes`;
      break;
    }
    case "ppt": {
      const unit = String(input.unit || "").trim();
      if (!unit || !UNIT_RE.test(unit)) {
        throw new Error("Presentations require a unit number (e.g. 1 or I).");
      }
      base = `${subject}_Unit_${unit}`;
      break;
    }
    case "pyq": {
      const year = Number(input.examYear);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        throw new Error("PYQ requires a four-digit exam year.");
      }
      const term = input.examTerm === "Mid" || input.examTerm === "End"
        ? `_${input.examTerm}`
        : "";
      base = `${subject}_PYQ_${year}${term}`;
      break;
    }
    case "qb": {
      const yearPart =
        input.qbYear && Number.isInteger(input.qbYear)
          ? `_${input.qbYear}`
          : "";
      const part =
        input.qbPart && Number.isInteger(input.qbPart)
          ? `_${input.qbPart}`
          : "";
      const solved = input.qbSolved ? "_Solved" : "";
      base = `${subject}_QB${yearPart}${part}${solved}`;
      break;
    }
    case "writeups": {
      const n = String(input.writeupNumber || "").trim();
      if (!n || !/^[A-Za-z0-9]+$/.test(n)) {
        throw new Error("Writeups require a writeup number.");
      }
      base = `Sem_${semester}_${subject}_WriteUp_${n}`;
      break;
    }
    case "codes": {
      const n = String(input.assignmentNumber || "").trim();
      if (!n || !/^\d+[A-Za-z]?$/.test(n)) {
        throw new Error("Codes require an assignment number (e.g. 1 or 1A).");
      }
      base = `Sem_${semester}_${subject}_Assignment_${n}`;
      break;
    }
    default: {
      const _exhaustive: never = input.category;
      throw new Error(`Unsupported category: ${_exhaustive}`);
    }
  }

  return `${base}.${ext}`;
}

export type AdminUploadPreview = {
  destPath: string;
  remoteName: string;
  fullPath: string;
};

export function previewAdminUpload(
  input: AdminFilenameInput,
): AdminUploadPreview {
  const destPath = buildAdminDestPath(input);
  const remoteName = buildAdminRemoteName(input);
  return {
    destPath,
    remoteName,
    fullPath: `${destPath}/${remoteName}`,
  };
}
