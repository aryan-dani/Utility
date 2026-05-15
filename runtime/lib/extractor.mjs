/**
 * runtime/lib/extractor.mjs
 * Universal text extraction from various file formats.
 * Supports PDF, DOCX, PPTX.
 */

import * as pdfParse from "pdf-parse";
const { PDFParse } = pdfParse;
import officeparser from 'officeparser';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

/**
 * Extract text from a buffer based on file extension.
 */
export async function extractText(buffer, extension) {
  const ext = extension.toLowerCase().replace('.', '');

  if (ext === 'pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      const info = await parser.getInfo();
      const textResult = await parser.getText();
      return {
        text: textResult.text,
        pages: info.total,
      };
    } finally {
      await parser.destroy();
    }
  }

  if (['docx', 'pptx', 'doc', 'ppt', 'xls', 'xlsx'].includes(ext)) {
    const tempPath = join(tmpdir(), `office-${randomUUID()}.${ext}`);
    try {
      await writeFile(tempPath, buffer);
      
      const text = await new Promise((resolve, reject) => {
        officeparser.parseOffice(tempPath, (data, err) => {
          if (err) return reject(new Error(err));
          resolve(data);
        });
      });

      return {
        text: typeof text === 'string' ? text : JSON.stringify(text),
        pages: 1, 
      };
    } catch (err) {
      console.error(`Office Parse Error (${ext}):`, err.message || err);
      throw err;
    } finally {
      try {
        await unlink(tempPath);
      } catch {}
    }
  }

  throw new Error(`Unsupported file extension: ${ext}`);
}
