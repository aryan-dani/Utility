import { sql } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { healthMeta, resourceChunks } from "../../db/schema.js";

/** Counts indexed chunks so admin health can show whether retrieval is alive. */
export async function runRagEval(): Promise<void> {
  const rows = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(resourceChunks);
  const count = String(rows[0]?.n ?? 0);
  await getDb()
    .insert(healthMeta)
    .values({ key: "rag_chunk_count", value: count })
    .onConflictDoUpdate({
      target: healthMeta.key,
      set: { value: count, updatedAt: sql`now()` },
    });
  console.log("rag-eval chunk count", count);
}
