/**
 * Gemini embedding client for the indexer.
 */

import { EMBED_BATCH_SIZE, EMBED_CONCURRENCY, EMBED_DIMS, EMBED_MODEL } from "./rag/config.mjs";

const API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";

function getApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return key;
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {string[]} texts
 * @param {"RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"} taskType
 */
export async function embedTexts(texts, taskType = "RETRIEVAL_DOCUMENT") {
  const key = getApiKey();
  const url = `${API_BASE}/${EMBED_MODEL}:batchEmbedContents`;

  const requests = texts.map((text) => ({
    model: `models/${EMBED_MODEL}`,
    content: { parts: [{ text: text.slice(0, 8000) }] },
    taskType,
    outputDimensionality: EMBED_DIMS,
  }));

  let attempt = 0;
  while (attempt < 5) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ requests }),
      });

      if (res.status === 429) {
        const delay = Math.min(60_000, 1000 * 2 ** attempt);
        console.warn(`   ⏳ Embed rate limited, waiting ${delay}ms…`);
        await sleep(delay);
        attempt++;
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Embed API ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      return (data.embeddings || []).map((e) => e.values || e.embedding?.values || []);
    } catch (err) {
      attempt++;
      if (attempt >= 5) throw err;
      await sleep(1000 * 2 ** attempt);
    }
  }

  throw new Error("Embed failed after retries");
}

/**
 * Embed chunks in batches with limited concurrency.
 * @param {Array<{ text: string, content_hash?: string, embedding?: number[] }>} chunks
 * @param {Set<string>} skipHashes
 */
export async function embedChunks(chunks, skipHashes = new Set()) {
  const toEmbed = chunks.filter(
    (c) => !skipHashes.has(c.content_hash || "") && !c.embedding?.length,
  );

  if (toEmbed.length === 0) return;

  console.log(`   🔢 Embedding ${toEmbed.length} chunks…`);

  for (let i = 0; i < toEmbed.length; i += EMBED_BATCH_SIZE * EMBED_CONCURRENCY) {
    const wave = [];
    for (let j = 0; j < EMBED_CONCURRENCY; j++) {
      const start = i + j * EMBED_BATCH_SIZE;
      const batch = toEmbed.slice(start, start + EMBED_BATCH_SIZE);
      if (batch.length === 0) continue;
      wave.push(
        embedTexts(
          batch.map((c) => c.text),
          "RETRIEVAL_DOCUMENT",
        ).then((vectors) => {
          batch.forEach((chunk, idx) => {
            chunk.embedding = vectors[idx];
          });
        }),
      );
    }
    await Promise.all(wave);
  }
}

/** Query embedding for runtime (also used in eval). */
export async function embedQuery(text) {
  const [vec] = await embedTexts([text], "RETRIEVAL_QUERY");
  return vec;
}
