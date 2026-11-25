import { EMBED_DIMS, EMBED_MODEL } from "./ragConfig.js";
import { env } from "./env.js";

export async function embedQuery(text: string): Promise<number[] | null> {
  const key = env().GEMINI_API_KEY;
  if (!key) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      outputDimensionality: EMBED_DIMS,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.warn("embedQuery failed", res.status);
    return null;
  }
  const json = (await res.json()) as {
    embedding?: { values?: number[] };
  };
  const values = json.embedding?.values;
  if (!values || values.length !== EMBED_DIMS) return null;
  return values;
}

const BATCH_EMBED_SIZE = 100;

export async function embedBatch(
  texts: string[],
): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];
  const key = env().GEMINI_API_KEY;
  if (!key) return texts.map(() => null);

  const out: (number[] | null)[] = new Array(texts.length).fill(null);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents?key=${encodeURIComponent(key)}`;
  const modelName = `models/${EMBED_MODEL}`;

  for (let start = 0; start < texts.length; start += BATCH_EMBED_SIZE) {
    const slice = texts.slice(start, start + BATCH_EMBED_SIZE);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: slice.map((text) => ({
            model: modelName,
            content: { parts: [{ text }] },
            outputDimensionality: EMBED_DIMS,
          })),
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) {
        console.warn("embedBatch failed", res.status);
        continue;
      }
      const json = (await res.json()) as {
        embeddings?: Array<{ values?: number[] }>;
      };
      const embeddings = json.embeddings ?? [];
      for (let j = 0; j < slice.length; j++) {
        const values = embeddings[j]?.values;
        if (values && values.length === EMBED_DIMS) {
          out[start + j] = values;
        }
      }
    } catch (err) {
      console.warn("embedBatch error", err);
    }
  }
  return out;
}
