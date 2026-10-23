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

export async function embedBatch(
  texts: string[],
): Promise<(number[] | null)[]> {
  const out: (number[] | null)[] = [];
  for (const t of texts) {
    out.push(await embedQuery(t));
  }
  return out;
}
