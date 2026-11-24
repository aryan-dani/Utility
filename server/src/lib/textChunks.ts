/** Text chunking shared by the Drive sync and the PDF indexer. */
import { CHUNK_TARGET_CHARS, CHUNK_OVERLAP_CHARS } from "./ragConfig.js";

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function chunkText(text: string): Array<{ text: string; tokens: string[] }> {
  const clean = text.replace(/\u0000/g, "").trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_TARGET_CHARS) {
    const tokens = tokenize(clean);
    return [{ text: clean, tokens }];
  }
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks: Array<{ text: string; tokens: string[] }> = [];
  let buffer = "";
  for (const sentence of sentences) {
    const candidate = buffer ? `${buffer} ${sentence}` : sentence;
    if (candidate.length > CHUNK_TARGET_CHARS && buffer) {
      chunks.push({ text: buffer.trim(), tokens: tokenize(buffer) });
      const overlap = buffer.slice(-CHUNK_OVERLAP_CHARS);
      buffer = overlap ? `${overlap} ${sentence}` : sentence;
    } else {
      buffer = candidate;
    }
  }
  if (buffer.trim()) {
    chunks.push({ text: buffer.trim(), tokens: tokenize(buffer) });
  }
  return chunks;
}
