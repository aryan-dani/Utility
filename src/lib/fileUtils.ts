/**
 * Shared file utility functions used by ResourceViewer and ResourceCard.
 * Extracted to avoid code duplication across components.
 */

const CODE_EXTENSIONS = new Set([
  "c",
  "h",
  "cpp",
  "hpp",
  "cc",
  "sh",
  "bash",
  "py",
  "js",
  "ts",
  "tsx",
  "jsx",
  "java",
  "txt",
  "md",
  "json",
  "css",
  "html",
  "sql",
  "ipynb",
]);

export function isCodeExtension(extension: string): boolean {
  return CODE_EXTENSIONS.has(extension.toLowerCase());
}

export function isNotebookExtension(extension: string): boolean {
  return extension.toLowerCase() === "ipynb";
}

export function isCsvExtension(extension: string): boolean {
  return extension.toLowerCase() === "csv";
}

export function isImageExtension(extension: string): boolean {
  return ["png", "jpg", "jpeg", "webp", "gif"].includes(
    extension.toLowerCase(),
  );
}

export function getFileExtension(title: string, url: string): string {
  if (title && title.includes(".")) {
    const ext = title.split(".").pop()?.toLowerCase();
    if (ext) return ext;
  }
  try {
    const pathname = new URL(url).pathname;
    return pathname.split(".").pop()?.toLowerCase() ?? "";
  } catch {
    return (
      url.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase() ?? ""
    );
  }
}

export function getDriveFileId(url: string): string | null {
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  const idParam = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParam) return idParam[1];

  return null;
}

/** Google Drive embed URL - works in-app for PDFs, slides, and docs when files are shared. */
export function getDriveEmbedUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}
