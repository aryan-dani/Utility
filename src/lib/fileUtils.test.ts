import { describe, expect, it } from "vitest";
import { getDriveEmbedUrl, getDriveFileId, getFileExtension } from "@/lib/fileUtils";

describe("getDriveFileId", () => {
  it("extracts id from /file/d/ URLs", () => {
    expect(
      getDriveFileId("https://drive.google.com/file/d/abc123XYZ/view"),
    ).toBe("abc123XYZ");
  });

  it("extracts id from ?id= query param", () => {
    expect(
      getDriveFileId("https://drive.google.com/open?id=abc123XYZ"),
    ).toBe("abc123XYZ");
  });

  it("returns null when no id is present", () => {
    expect(getDriveFileId("https://example.com/file.txt")).toBeNull();
  });

  it("appends a page hash on Drive preview URLs", () => {
    expect(getDriveEmbedUrl("abc123XYZ")).toBe(
      "https://drive.google.com/file/d/abc123XYZ/preview",
    );
    expect(getDriveEmbedUrl("abc123XYZ", 4)).toBe(
      "https://drive.google.com/file/d/abc123XYZ/preview#page=4",
    );
  });
});

describe("getFileExtension", () => {
  it("prefers extension from title", () => {
    expect(
      getFileExtension("notes.pdf", "https://example.com/unknown"),
    ).toBe("pdf");
  });

  it("falls back to URL pathname extension", () => {
    expect(getFileExtension("", "https://example.com/path/data.csv")).toBe(
      "csv",
    );
  });
});
