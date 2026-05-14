/**
 * runtime/lib/pdf.mjs
 * PDF text extraction and search functionality.
 * Uses pdf-parse to extract content from PDF buffers.
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
import { downloadFile } from "./storage.mjs";

/**
 * Extract all text from a PDF Buffer.
 * @param {Buffer} buffer
 * @returns {Promise<object>} - { text, pages, metadata }
 */
export async function extractText(buffer) {
  try {
    const data = await pdf(buffer);
    return {
      text: data.text,
      pages: data.numpages,
      metadata: data.info,
      version: data.version
    };
  } catch (error) {
    throw new Error(`PDF Extraction failed: ${error.message}`);
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
