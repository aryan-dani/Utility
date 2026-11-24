import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { clipboardShares, clipboards, workspaceCatalogs } from "../../db/schema.js";

/** Unauthenticated reads. Share ids are unguessable; rows expire in 24h. */
export const publicRoutes = new Hono();

/** Vault list for one academic scope (public, same data for every visitor). */
publicRoutes.get("/catalog", async (c) => {
  const year = c.req.query("year") ?? "";
  const branch = (c.req.query("branch") ?? "").toUpperCase();
  const semester = Number(c.req.query("semester"));
  if (!/^\d{4}-\d{4}$/.test(year) || !/^[A-Z]{2,12}$/.test(branch) || !Number.isInteger(semester)) {
    return c.json({ error: "Invalid scope" }, 400);
  }
  c.header("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  const rows = await getDb()
    .select()
    .from(workspaceCatalogs)
    .where(eq(workspaceCatalogs.id, `${year}__${branch}__${semester}`))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return c.json({ resources: [], subjects: [], syllabusUrl: null, updatedAt: null });
  }
  return c.json({
    ...row.payload,
    updatedAt: row.updatedAt.toISOString(),
  });
});

publicRoutes.get("/clipboard/:id", async (c) => {
  const id = c.req.param("id");
  if (!/^[abcdefghjkmnpqrstuvwxyz23456789]{6,16}$/.test(id)) {
    return c.json({ error: "Not found" }, 404);
  }
  const shares = await getDb().select().from(clipboardShares).where(eq(clipboardShares.id, id)).limit(1);
  const share = shares[0];
  if (!share) return c.json({ error: "Not found" }, 404);
  if (share.expiresAt.getTime() < Date.now()) {
    await getDb().delete(clipboardShares).where(eq(clipboardShares.id, id));
    return c.json({ error: "Link expired" }, 410);
  }
  const clips = await getDb().select().from(clipboards).where(eq(clipboards.userId, share.ownerId)).limit(1);
  const clip = clips[0];
  return c.json(
    {
      text: clip?.text ?? "",
      share_expires_at: share.expiresAt.toISOString(),
      drive_file_id: clip?.driveFileId ?? null,
      drive_file_name: clip?.driveFileName ?? null,
    },
    200,
    { "Cache-Control": "no-store" },
  );
});
