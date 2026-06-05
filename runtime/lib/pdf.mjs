/**
 * runtime/lib/pdf.mjs
 * PDF text extraction and search functionality.
 * Uses pdf-parse to extract content from PDF buffers.
 */

import * as pdfParse from "pdf-parse";
const { PDFParse } = pdfParse;
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { pathToFileURL } from "url";
import { createRequire } from "module";

try {
  const require = createRequire(import.meta.url);
  const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).toString();
} catch (e) {
  console.warn("⚠️ Failed to resolve pdf.worker.mjs path:", e);
}

import { downloadFile } from "./storage.mjs";

/**
 * Extract all text from a PDF Buffer.
 * @param {Buffer} buffer
 * @returns {Promise<object>} - { text, pages, metadata }
 */
export async function extractText(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const info = await parser.getInfo();
    const textResult = await parser.getText();
    
    return {
      text: textResult.text,
      pages: info.total,
      metadata: info.info,
      version: info.metadata?.get?.('PDFFormatVersion')
    };
  } catch (error) {
    console.error("PDF Parse Error Details:", error);
    throw new Error(`PDF Extraction failed: ${error.message}`);
  } finally {
    await parser.destroy();
  }
}

/**
 * Download a PDF from Supabase storage and extract its text.
 * @param {string} bucket
 * @param {string} path
 */
export async function extractFromStorage(bucket, path) {
  const buffer = await downloadFile(bucket, path);
  return extractText(buffer);
}

/**
 * Search for a term within a PDF buffer.
 * Returns matches with context (surrounding text).
 */
export async function searchInPdf(buffer, query) {
  const { text } = await extractText(buffer);
  const regex = new RegExp(query, "gi");
  const matches = [];
  let match;

  while ((match = regex.exec(text)) !== null) {
    const start = Math.max(0, match.index - 50);
    const end = Math.min(text.length, match.index + query.length + 50);
    matches.push({
      index: match.index,
      context: text.substring(start, end).replace(/\n/g, " ").trim()
    });
    // Limit to first 20 matches per file to avoid bloat
    if (matches.length >= 20) break;
  }

  return matches;
}

/**
 * Summarize a PDF by returning first N characters and metadata.
 */
export async function summarize(buffer, maxLength = 1000) {
  const { text, pages, metadata } = await extractText(buffer);
  return {
    summary: text.substring(0, maxLength).trim() + (text.length > maxLength ? "..." : ""),
    pages,
    metadata
  };
}
