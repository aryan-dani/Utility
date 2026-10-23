import { lt } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { semanticCache } from "../../db/schema.js";

export async function runCachePurge(): Promise<void> {
  const now = new Date();
  await getDb().delete(semanticCache).where(lt(semanticCache.expiresAt, now));
  console.log("cache.purge done");
}
