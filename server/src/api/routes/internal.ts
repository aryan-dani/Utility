import { Hono } from "hono";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import {
  activityLogs,
  qaAnswers,
  qaQuestions,
  qaSaved,
  qaVotes,
  resourceUsage,
  visualizeTelemetry,
} from "../../db/schema.js";
import { requireInternalKey } from "../middleware/auth.js";
import { getBoss } from "../../worker/boss.js";
import { ingestDriveFile } from "../../lib/catalogIngest.js";

export const internalRoutes = new Hono();

internalRoutes.use("*", requireInternalKey);

internalRoutes.post("/sync", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { mode?: string };
  const mode = body.mode === "full" ? "full" : "incremental";
  const boss = await getBoss();
  const id = await boss.send(
    "drive.sync",
    { mode },
    {
      // Full vault mirrors exceed the 15m default; keep incremental shorter.
      expireInSeconds: mode === "full" ? 6 * 60 * 60 : 2 * 60 * 60,
    },
  );
  return c.json({ ok: true, jobId: id, mode });
});

/** Vercel calls this after an admin Drive upload so the vault updates without waiting for the sync. */
internalRoutes.post("/catalog/ingest", async (c) => {
  const body = (await c.req.json().catch(() => null)) as
    | { driveFileId?: unknown; path?: unknown }
    | null;
  const driveFileId = typeof body?.driveFileId === "string" ? body.driveFileId.trim() : "";
  const path = typeof body?.path === "string" ? body.path.trim() : "";
  if (!driveFileId || !path) {
    return c.json({ error: "driveFileId and path are required" }, 400);
  }
  const result = await ingestDriveFile(getDb(), { driveFileId, path });
  if (!result.ok) return c.json({ error: result.reason }, 422);
  return c.json({ ok: true, resourceId: result.resourceId, catalogChanged: result.catalog.changed });
});

internalRoutes.post("/purge-user", async (c) => {
  const body = (await c.req.json().catch(() => null)) as { uid?: string } | null;
  if (!body?.uid) return c.json({ error: "uid required" }, 400);
  const uid = body.uid;
  const db = getDb();
  await db.delete(activityLogs).where(eq(activityLogs.userId, uid));
  await db.delete(resourceUsage).where(eq(resourceUsage.userId, uid));
  await db.delete(visualizeTelemetry).where(eq(visualizeTelemetry.userId, uid));
  await db.delete(qaVotes).where(eq(qaVotes.userId, uid));
  await db.delete(qaSaved).where(eq(qaSaved.userId, uid));
  const ownedQ = await db
    .select({ id: qaQuestions.id })
    .from(qaQuestions)
    .where(eq(qaQuestions.userId, uid));
  const qids = ownedQ.map((q) => q.id);
  if (qids.length) {
    await db.delete(qaAnswers).where(inArray(qaAnswers.questionId, qids));
    await db.delete(qaQuestions).where(inArray(qaQuestions.id, qids));
  }
  await db.delete(qaAnswers).where(eq(qaAnswers.userId, uid));
  return c.json({ ok: true });
});

internalRoutes.get("/admin/usage", async (c) => {
  const db = getDb();
  const totals = await db.select().from(resourceUsage).limit(500);
  return c.json({ usage: totals });
});
