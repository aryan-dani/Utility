/**
 * One-off: render a scanned PDF with pdfjs + @napi-rs/canvas, OCR with tesseract.js.
 * Usage: node runtime/tools/ocr-pdf-once.mjs <pdfPath> [outTxt]
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { createCanvas } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { createWorker } from "tesseract.js";

const pdfPath = process.argv[2];
const outPath =
  process.argv[3] ||
  path.join(process.cwd(), ".tmp-sem3-syllabus-ocr.txt");

if (!pdfPath) {
  console.error("Usage: node runtime/tools/ocr-pdf-once.mjs <pdfPath> [outTxt]");
  process.exit(1);
}

const PDFJS_ROOT = path.join(process.cwd(), "node_modules", "pdfjs-dist");
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
  path.join(PDFJS_ROOT, "legacy", "build", "pdf.worker.mjs"),
).toString();

const SCALE = 2;

async function main() {
  const data = new Uint8Array(readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({
    data,
    cMapUrl: pathToFileURL(path.join(PDFJS_ROOT, "cmaps")).href + "/",
    cMapPacked: true,
    standardFontDataUrl:
      pathToFileURL(path.join(PDFJS_ROOT, "standard_fonts")).href + "/",
    verbosity: 0,
  }).promise;

  console.log(`Pages: ${doc.numPages}`);
  const worker = await createWorker("eng");
  const parts = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: SCALE });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    const png = canvas.toBuffer("image/png");
    const {
      data: { text },
    } = await worker.recognize(png);
    const block = `\n\n===== PAGE ${i} / ${doc.numPages} =====\n\n${text.trim()}\n`;
    parts.push(block);
    console.log(`OCR page ${i}/${doc.numPages} (${text.trim().length} chars)`);
  }

  await worker.terminate();
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, parts.join(""), "utf8");
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
