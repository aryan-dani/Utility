import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { getDb } from "../../db/client.js";
import { healthMeta, studyPacks } from "../../db/schema.js";
import { env } from "../../lib/env.js";
import { retrieve } from "../../lib/retrieve.js";

/** Nightly in-app study pack per semester. Does not touch mail or Telegram. */
export async function runStudyPack(): Promise<void> {
  if (!env().GROQ_API_KEY) {
    console.log("study-pack skipped: no GROQ_API_KEY");
    return;
  }
  const groq = createGroq({ apiKey: env().GROQ_API_KEY });
  for (const semester of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const { context, sources } = await retrieve({
      query: "important exam topics and definitions",
      semester,
    });
    if (sources.length === 0 || !context.trim()) continue;
    const out = await generateText({
      model: groq("openai/gpt-oss-20b"),
      prompt: `From these notes, return ONLY JSON {"flashcards":[{"id":"1","question":"...","answer":"..."}],"quiz":[{"id":"1","question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"...","citations":[]}]}. Five flashcards and five quiz items.\n${context.slice(0, 6000)}`,
      temperature: 0.3,
      abortSignal: AbortSignal.timeout(45_000),
    });
    let payload: unknown = { text: out.text };
    try {
      payload = JSON.parse(out.text.replace(/```json|```/g, "").trim());
    } catch {
      /* keep raw text */
    }
    await getDb().insert(studyPacks).values({
      id: randomUUID(),
      scopeKey: `semester:${semester}`,
      payload,
    });
  }
  await getDb()
    .insert(healthMeta)
    .values({ key: "last_study_pack_at", value: new Date().toISOString() })
    .onConflictDoUpdate({
      target: healthMeta.key,
      set: { value: new Date().toISOString(), updatedAt: sql`now()` },
    });
}
