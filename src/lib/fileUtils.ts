/**
 * Shared file utility functions used by ResourceViewer and ResourceCard.
 * Extracted to avoid code duplication across components.
 */

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
