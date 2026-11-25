import {
  ADMIN_UPLOAD_MAX_BYTES,
  assertCanonicalDestPath,
  buildAdminDestPath,
  buildAdminRemoteName,
  type AdminFilenameInput,
  type AdminUploadCategory,
  type AdminUploadDestination,
} from "@/lib/adminDriveUpload";
import {
  CAMPUS_HOST,
  CAMPUS_ORIGIN,
  CANONICAL_HOST,
  CANONICAL_ORIGIN,
  CANONICAL_WWW_HOST,
  CANONICAL_WWW_ORIGIN,
} from "@/lib/siteOrigins";

const ALLOWED_ORIGINS = new Set([
  CANONICAL_ORIGIN,
  CANONICAL_WWW_ORIGIN,
  CAMPUS_ORIGIN,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

export function resolveUploadOrigin(request: Request): string | null {
  const origin = request.headers.get("origin")?.trim() || "";
  if (origin) {
    return ALLOWED_ORIGINS.has(origin) ? origin : null;
  }
  const host = request.headers.get("host")?.trim().toLowerCase() || "";
  if (
    host === CANONICAL_HOST ||
    host === CANONICAL_WWW_HOST ||
    host === CAMPUS_HOST
  ) {
    return `https://${host}`;
  }
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) {
    return `http://${host}`;
  }
  return null;
}

export function parseDestinationBody(body: Record<string, unknown>): {
  dest: AdminUploadDestination;
  filenameInput: AdminFilenameInput;
  remoteName: string;
  destPath: string;
  size: number;
  mimeType: string;
  overwrite: boolean;
} {
  const year = String(body.year ?? "").trim();
  const branch = String(body.branch ?? "").trim();
  const semester = Number(body.semester);
  const subject = String(body.subject ?? "").trim();
  const category = String(body.category ?? "").trim() as AdminUploadCategory;
  const extension = String(body.extension ?? "").trim();
  const size = Number(body.size);
  const mimeType =
    String(body.mimeType ?? "").trim() || "application/octet-stream";
  const overwrite = body.overwrite === true;

  if (!Number.isFinite(size) || size <= 0 || size > ADMIN_UPLOAD_MAX_BYTES) {
    throw new Error(
      `File size must be between 1 byte and ${ADMIN_UPLOAD_MAX_BYTES} bytes.`,
    );
  }

  const dest: AdminUploadDestination = {
    year,
    branch,
    semester,
    subject,
    category,
  };
  const filenameInput: AdminFilenameInput = {
    ...dest,
    extension,
    unit: body.unit != null ? String(body.unit) : undefined,
    examYear: body.examYear != null ? Number(body.examYear) : undefined,
    examTerm:
      body.examTerm === "Mid" || body.examTerm === "End"
        ? body.examTerm
        : undefined,
    writeupNumber:
      body.writeupNumber != null ? String(body.writeupNumber) : undefined,
    assignmentNumber:
      body.assignmentNumber != null
        ? String(body.assignmentNumber)
        : undefined,
    qbYear: body.qbYear != null ? Number(body.qbYear) : undefined,
    qbSolved: body.qbSolved === true,
    qbPart: body.qbPart != null ? Number(body.qbPart) : undefined,
  };

  const destPath = buildAdminDestPath(dest);
  if (body.destPath != null && String(body.destPath).trim()) {
    assertCanonicalDestPath(String(body.destPath).trim(), dest);
  }
  const remoteName = buildAdminRemoteName(filenameInput);

  return {
    dest,
    filenameInput,
    remoteName,
    destPath,
    size,
    mimeType,
    overwrite,
  };
}
