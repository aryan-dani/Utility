import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import { clipboardShares, clipboards } from "../../db/schema.js";

/** Unauthenticated reads. Share ids are unguessable; rows expire in 24h. */
export const publicRoutes = new Hono();

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
