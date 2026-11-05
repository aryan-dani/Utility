import { Hono } from "hono";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getDb } from "../../db/client.js";
import {
  clipboardShares,
  clipboards,
  communityDecks,
  healthMeta,
  plannerCollaborators,
  plannerPlans,
  plannerPresence,
  srsState,
  studyPacks,
  userNotes,
} from "../../db/schema.js";
import { adminEmails, env } from "../../lib/env.js";
import { checkRateLimit } from "../../lib/rateLimit.js";
import { requireUser, type AppVars, clientIp } from "../middleware/auth.js";

export const stateRoutes = new Hono<AppVars>();
stateRoutes.use("*", requireUser);

const CLIP_MAX = 32_000;
const PLAN_MAX = 400_000;
const NOTE_MAX = 100_000;
const NOTE_QUOTA = 20;
const SHARE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function limited(
  c: { json: (b: unknown, s: number, h?: Record<string, string>) => Response; get: (k: "user") => { uid: string } },
  bucket: string,
  limit: number,
) {
  const uid = c.get("user").uid;
  const ip = clientIp(c as never);
  const r = checkRateLimit(`${bucket}:${uid}:${ip}`, limit, 60_000);
  if (!r.ok) {
    return c.json({ error: "Rate limit exceeded" }, 429, {
      "Retry-After": String(r.retryAfterSec),
    });
  }
  return null;
}

function shareId(): string {
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i += 1) {
    out += SHARE_ALPHABET[bytes[i]! % SHARE_ALPHABET.length];
  }
  return out;
}

stateRoutes.get("/clipboard", async (c) => {
  const hit = limited(c, "clip-get", 60);
  if (hit) return hit;
  const uid = c.get("user").uid;
  const rows = await getDb().select().from(clipboards).where(eq(clipboards.userId, uid)).limit(1);
  const row = rows[0];
  if (!row) {
    return c.json({
      text: "",
      updated_at: null,
      share_id: null,
      share_expires_at: null,
      drive_file_id: null,
      drive_file_name: null,
    });
  }
  const expired = row.shareExpiresAt ? row.shareExpiresAt.getTime() < Date.now() : false;
  return c.json({
    text: row.text,
    updated_at: row.updatedAt?.toISOString() ?? null,
    share_id: expired ? null : row.shareId,
    share_expires_at: expired ? null : row.shareExpiresAt?.toISOString() ?? null,
    drive_file_id: row.driveFileId,
    drive_file_name: row.driveFileName,
  });
});

stateRoutes.put("/clipboard", async (c) => {
  const hit = limited(c, "clip-put", 20);
  if (hit) return hit;
  const uid = c.get("user").uid;
  const body = (await c.req.json().catch(() => null)) as {
    text?: string;
    drive_file_id?: string | null;
    drive_file_name?: string | null;
  } | null;
  if (!body || typeof body.text !== "string" || body.text.length > CLIP_MAX) {
    return c.json({ error: "Invalid payload" }, 400);
  }
  const now = new Date();
  await getDb()
    .insert(clipboards)
    .values({
      userId: uid,
      text: body.text,
      updatedAt: now,
      driveFileId: body.drive_file_id ?? null,
      driveFileName: body.drive_file_name ?? null,
    })
    .onConflictDoUpdate({
      target: clipboards.userId,
      set: {
        text: body.text,
        updatedAt: now,
        driveFileId: body.drive_file_id ?? null,
        driveFileName: body.drive_file_name ?? null,
      },
    });
  return c.json({ ok: true, updated_at: now.toISOString() });
});

stateRoutes.post("/clipboard/share", async (c) => {
  const hit = limited(c, "clip-share", 8);
  if (hit) return hit;
  const uid = c.get("user").uid;
  const id = shareId();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const existing = await getDb().select().from(clipboards).where(eq(clipboards.userId, uid)).limit(1);
  if (existing[0]?.shareId) {
    await getDb().delete(clipboardShares).where(eq(clipboardShares.id, existing[0].shareId));
  }
  await getDb().insert(clipboardShares).values({ id, ownerId: uid, expiresAt: expires });
  await getDb()
    .insert(clipboards)
    .values({ userId: uid, text: existing[0]?.text ?? "", shareId: id, shareExpiresAt: expires, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: clipboards.userId,
      set: { shareId: id, shareExpiresAt: expires },
    });
  return c.json({ share_id: id, share_expires_at: expires.toISOString() });
});

stateRoutes.delete("/clipboard/share", async (c) => {
  const uid = c.get("user").uid;
  const existing = await getDb().select().from(clipboards).where(eq(clipboards.userId, uid)).limit(1);
  if (existing[0]?.shareId) {
    await getDb().delete(clipboardShares).where(eq(clipboardShares.id, existing[0].shareId));
  }
  await getDb().update(clipboards).set({ shareId: null, shareExpiresAt: null }).where(eq(clipboards.userId, uid));
  return c.json({ ok: true, share_id: null });
});

stateRoutes.get("/planner", async (c) => {
  const uid = c.get("user").uid;
  const email = c.get("user").email?.toLowerCase() || "";
  const month = Number(c.req.query("month"));
  const year = Number(c.req.query("year"));
  if (!month || !year) return c.json({ error: "Month and Year are required" }, 400);

  let plan = (
    await getDb()
      .select()
      .from(plannerPlans)
      .where(and(eq(plannerPlans.ownerId, uid), eq(plannerPlans.month, month), eq(plannerPlans.year, year)))
      .limit(1)
  )[0];
  let isCollaborator = false;
  let collaboratorRole: string | null = null;

  if (!plan && email) {
    const collabs = await getDb()
      .select()
      .from(plannerCollaborators)
      .where(eq(plannerCollaborators.userEmail, email))
      .limit(30);
    for (const col of collabs) {
      const rows = await getDb()
        .select()
        .from(plannerPlans)
        .where(and(eq(plannerPlans.id, col.planId), eq(plannerPlans.month, month), eq(plannerPlans.year, year)))
        .limit(1);
      if (rows[0]) {
        plan = rows[0];
        isCollaborator = true;
        collaboratorRole = col.role;
        break;
      }
    }
  }

  if (!plan) return c.json({ plan: null, collaborators: [] });
  const collaborators = await getDb()
    .select()
    .from(plannerCollaborators)
    .where(eq(plannerCollaborators.planId, plan.id));
  return c.json({
    plan: {
      id: plan.id,
      owner_id: plan.ownerId,
      month: plan.month,
      year: plan.year,
      title: plan.title,
      is_public: plan.isPublic,
      data: plan.data,
      updated_at: plan.updatedAt.toISOString(),
    },
    collaborators: collaborators.map((col) => ({
      id: col.id,
      plan_id: col.planId,
      user_email: col.userEmail,
      role: col.role,
      owner_id: col.ownerId,
    })),
    isCollaborator,
    collaboratorRole,
  });
});

stateRoutes.post("/planner", async (c) => {
  const hit = limited(c, "planner", 30);
  if (hit) return hit;
  const uid = c.get("user").uid;
  const email = c.get("user").email?.toLowerCase() || "";
  const body = (await c.req.json().catch(() => null)) as {
    month?: number;
    year?: number;
    title?: string;
    is_public?: boolean;
    data?: unknown;
    planId?: string;
  } | null;
  if (!body?.month || !body.year || !body.title) return c.json({ error: "Invalid plan payload" }, 400);
  const raw = JSON.stringify(body.data ?? {});
  if (raw.length > PLAN_MAX) return c.json({ error: "Plan data exceeds size limit" }, 413);
  const now = new Date();
  let id = body.planId;
  if (id) {
    const existing = await getDb().select().from(plannerPlans).where(eq(plannerPlans.id, id)).limit(1);
    const row = existing[0];
    if (!row) return c.json({ error: "Plan not found" }, 404);
    const owner = row.ownerId === uid;
    let editor = owner;
    if (!owner && email) {
      const col = await getDb()
        .select()
        .from(plannerCollaborators)
        .where(and(eq(plannerCollaborators.planId, id), eq(plannerCollaborators.userEmail, email)))
        .limit(1);
      editor = col[0]?.role === "editor";
    }
    if (!editor) return c.json({ error: "Forbidden" }, 403);
    await getDb()
      .update(plannerPlans)
      .set({
        title: body.title.slice(0, 200),
        isPublic: Boolean(body.is_public),
        data: body.data ?? {},
        updatedAt: now,
      })
      .where(eq(plannerPlans.id, id));
  } else {
    id = randomUUID();
    await getDb()
      .insert(plannerPlans)
      .values({
        id,
        ownerId: uid,
        ownerEmail: email || null,
        month: body.month,
        year: body.year,
        title: body.title.slice(0, 200),
        isPublic: Boolean(body.is_public),
        data: body.data ?? {},
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [plannerPlans.ownerId, plannerPlans.year, plannerPlans.month],
        set: {
          title: body.title.slice(0, 200),
          isPublic: Boolean(body.is_public),
          data: body.data ?? {},
          updatedAt: now,
        },
      });
    const saved = await getDb()
      .select()
      .from(plannerPlans)
      .where(and(eq(plannerPlans.ownerId, uid), eq(plannerPlans.month, body.month), eq(plannerPlans.year, body.year)))
      .limit(1);
    id = saved[0]?.id ?? id;
  }
  return c.json({ id, updated_at: now.toISOString() });
});

stateRoutes.post("/planner/collaborators", async (c) => {
  const uid = c.get("user").uid;
  const body = (await c.req.json().catch(() => null)) as {
    planId?: string;
    email?: string;
    role?: string;
  } | null;
  const planId = body?.planId?.trim() || "";
  const email = body?.email?.trim().toLowerCase() || "";
  const role = body?.role === "editor" ? "editor" : body?.role === "viewer" ? "viewer" : "";
  if (!planId || !email.includes("@") || !role) {
    return c.json({ error: "Valid email and role (viewer|editor) required" }, 400);
  }
  const plan = await getDb().select().from(plannerPlans).where(eq(plannerPlans.id, planId)).limit(1);
  if (!plan[0]) return c.json({ error: "Plan not found" }, 404);
  if (plan[0].ownerId !== uid) return c.json({ error: "Forbidden" }, 403);
  const id = randomUUID();
  try {
    await getDb().insert(plannerCollaborators).values({
      id,
      planId,
      userEmail: email,
      role,
      ownerId: uid,
    });
  } catch {
    return c.json({ error: "Collaborator already invited" }, 400);
  }
  return c.json({
    success: true,
    collaborator: { id, plan_id: planId, user_email: email, role, owner_id: uid },
  });
});

stateRoutes.delete("/planner/collaborators", async (c) => {
  const uid = c.get("user").uid;
  const id = c.req.query("id") || "";
  if (!id) return c.json({ error: "Valid collaborator ID is required" }, 400);
  const rows = await getDb().select().from(plannerCollaborators).where(eq(plannerCollaborators.id, id)).limit(1);
  if (!rows[0] || rows[0].ownerId !== uid) return c.json({ error: "Forbidden" }, 403);
  await getDb().delete(plannerCollaborators).where(eq(plannerCollaborators.id, id));
  return c.json({ ok: true });
});

stateRoutes.post("/planner/presence", async (c) => {
  const uid = c.get("user").uid;
  const body = (await c.req.json().catch(() => null)) as { planId?: string; displayName?: string } | null;
  if (!body?.planId) return c.json({ error: "planId required" }, 400);
  const now = new Date();
  await getDb()
    .insert(plannerPresence)
    .values({
      planId: body.planId,
      userId: uid,
      displayName: body.displayName?.slice(0, 80) ?? null,
      seenAt: now,
    })
    .onConflictDoUpdate({
      target: [plannerPresence.planId, plannerPresence.userId],
      set: { seenAt: now, displayName: body.displayName?.slice(0, 80) ?? null },
    });
  return c.json({ ok: true });
});

stateRoutes.get("/planner/presence", async (c) => {
  const planId = c.req.query("planId") || "";
  if (!planId) return c.json({ people: [] });
  const since = new Date(Date.now() - 45_000);
  const rows = await getDb()
    .select()
    .from(plannerPresence)
    .where(and(eq(plannerPresence.planId, planId), gt(plannerPresence.seenAt, since)));
  return c.json({
    people: rows.map((r) => ({
      userId: r.userId,
      displayName: r.displayName,
      seenAt: r.seenAt.toISOString(),
    })),
  });
});

function deckDto(row: typeof communityDecks.$inferSelect, withCards: boolean) {
  const cards = Array.isArray(row.flashcards) ? row.flashcards : [];
  return {
    id: row.id,
    title: row.title,
    branch: row.branch,
    semester: row.semester,
    author_name: row.authorName || "",
    author_uid: row.authorUid,
    upvotes: row.upvotes,
    cardCount: cards.length,
    flashcards: withCards ? cards : [],
    created_at: row.createdAt.toISOString(),
  };
}

stateRoutes.get("/community-decks", async (c) => {
  const rows = await getDb()
    .select()
    .from(communityDecks)
    .orderBy(desc(communityDecks.upvotes))
    .limit(50);
  return c.json({ decks: rows.map((r) => deckDto(r, false)) });
});

stateRoutes.post("/community-decks", async (c) => {
  const hit = limited(c, "decks", 10);
  if (hit) return hit;
  const uid = c.get("user").uid;
  const body = (await c.req.json().catch(() => null)) as {
    title?: string;
    branch?: string;
    semester?: number;
    author_name?: string;
    flashcards?: Array<{ front: string; back: string }>;
  } | null;
  if (!body?.semester || !Array.isArray(body.flashcards) || body.flashcards.length === 0) {
    return c.json({ error: "Invalid deck payload" }, 400);
  }
  const id = randomUUID();
  await getDb().insert(communityDecks).values({
    id,
    title: (body.title || "Academic Flashcards").slice(0, 200),
    branch: (body.branch || "AIDS").slice(0, 32),
    semester: body.semester,
    authorName: (body.author_name || c.get("user").email?.split("@")[0] || "Student").slice(0, 80),
    authorUid: uid,
    flashcards: body.flashcards.slice(0, 200),
  });
  return c.json({ success: true, id });
});

stateRoutes.get("/community-decks/:id", async (c) => {
  const id = c.req.param("id");
  const rows = await getDb().select().from(communityDecks).where(eq(communityDecks.id, id)).limit(1);
  if (!rows[0]) return c.json({ error: "Deck not found" }, 404);
  return c.json(deckDto(rows[0], true));
});

stateRoutes.post("/community-decks/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => null)) as { action?: string } | null;
  if (body?.action !== "upvote") return c.json({ error: "Unknown action" }, 400);
  await getDb()
    .update(communityDecks)
    .set({ upvotes: sql`${communityDecks.upvotes} + 1` })
    .where(eq(communityDecks.id, id));
  const rows = await getDb().select().from(communityDecks).where(eq(communityDecks.id, id)).limit(1);
  if (!rows[0]) return c.json({ error: "Deck not found" }, 404);
  return c.json({ upvotes: rows[0].upvotes });
});

stateRoutes.delete("/community-decks/:id", async (c) => {
  const uid = c.get("user").uid;
  const id = c.req.param("id");
  const rows = await getDb().select().from(communityDecks).where(eq(communityDecks.id, id)).limit(1);
  if (!rows[0]) return c.json({ error: "Deck not found" }, 404);
  if (rows[0].authorUid !== uid) return c.json({ error: "Forbidden" }, 403);
  await getDb().delete(communityDecks).where(eq(communityDecks.id, id));
  return c.json({ ok: true });
});

stateRoutes.get("/srs", async (c) => {
  const uid = c.get("user").uid;
  const rows = await getDb().select().from(srsState).where(eq(srsState.userId, uid)).limit(1);
  const row = rows[0];
  if (!row) return c.json({ decks: [], cards: [], updated_at: null });
  return c.json({
    decks: row.decks,
    cards: row.cards,
    updated_at: row.updatedAt.toISOString(),
  });
});

stateRoutes.put("/srs", async (c) => {
  const uid = c.get("user").uid;
  const body = (await c.req.json().catch(() => null)) as {
    decks?: unknown;
    cards?: unknown;
    updated_at?: string;
  } | null;
  if (!body || !Array.isArray(body.decks) || !Array.isArray(body.cards)) {
    return c.json({ error: "Invalid SRS payload" }, 400);
  }
  const updatedAt = body.updated_at ? new Date(body.updated_at) : new Date();
  await getDb()
    .insert(srsState)
    .values({ userId: uid, decks: body.decks, cards: body.cards, updatedAt })
    .onConflictDoUpdate({
      target: srsState.userId,
      set: { decks: body.decks, cards: body.cards, updatedAt },
    });
  return c.json({ ok: true, updated_at: updatedAt.toISOString() });
});

stateRoutes.get("/notes", async (c) => {
  const uid = c.get("user").uid;
  const rows = await getDb()
    .select()
    .from(userNotes)
    .where(eq(userNotes.userId, uid))
    .orderBy(desc(userNotes.createdAt))
    .limit(NOTE_QUOTA);
  return c.json({
    notes: rows.map((n) => ({
      id: n.id,
      title: n.title,
      bytes: n.bytes,
      created_at: n.createdAt.toISOString(),
      path: `/notes/${uid}/${n.id}.md`,
    })),
  });
});

stateRoutes.post("/notes", async (c) => {
  const hit = limited(c, "notes", 20);
  if (hit) return hit;
  const uid = c.get("user").uid;
  const body = (await c.req.json().catch(() => null)) as { title?: string; body?: string } | null;
  const text = body?.body?.trim() || "";
  const title = (body?.title || "Note").trim().slice(0, 120);
  if (!text || Buffer.byteLength(text) > NOTE_MAX) {
    return c.json({ error: "Note is empty or too large" }, 400);
  }
  const count = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(userNotes)
    .where(eq(userNotes.userId, uid));
  if ((count[0]?.n ?? 0) >= NOTE_QUOTA) return c.json({ error: "Note quota reached" }, 413);
  const id = randomUUID();
  const dir = join(env().FILES_ROOT, "notes", uid);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${id}.md`), `# ${title}\n\n${text}`, "utf8");
  const bytes = Buffer.byteLength(text);
  await getDb().insert(userNotes).values({ id, userId: uid, title, bytes });
  return c.json({ id, path: `/notes/${uid}/${id}.md` }, 201);
});

function noteFile(uid: string, id: string): string | null {
  if (!id || id.includes("/") || id.includes("\\") || id.includes("..")) return null;
  return join(env().FILES_ROOT, "notes", uid, `${id}.md`);
}

function noteBody(raw: string, title: string): string {
  const prefix = `# ${title}\n\n`;
  if (raw.startsWith(prefix)) return raw.slice(prefix.length);
  return raw.replace(/^# .*\r?\n\r?\n/, "");
}

stateRoutes.get("/notes/:id", async (c) => {
  const uid = c.get("user").uid;
  const id = c.req.param("id");
  const file = noteFile(uid, id);
  if (!file) return c.json({ error: "Not found" }, 404);
  const rows = await getDb()
    .select()
    .from(userNotes)
    .where(and(eq(userNotes.id, id), eq(userNotes.userId, uid)))
    .limit(1);
  const row = rows[0];
  if (!row) return c.json({ error: "Not found" }, 404);
  let body = "";
  try {
    body = noteBody(await readFile(file, "utf8"), row.title);
  } catch {
    body = "";
  }
  return c.json({
    id: row.id,
    title: row.title,
    body,
    created_at: row.createdAt.toISOString(),
  });
});

stateRoutes.patch("/notes/:id", async (c) => {
  const hit = limited(c, "notes", 20);
  if (hit) return hit;
  const uid = c.get("user").uid;
  const id = c.req.param("id");
  const file = noteFile(uid, id);
  if (!file) return c.json({ error: "Not found" }, 404);
  const rows = await getDb()
    .select()
    .from(userNotes)
    .where(and(eq(userNotes.id, id), eq(userNotes.userId, uid)))
    .limit(1);
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  const body = (await c.req.json().catch(() => null)) as { title?: string; body?: string } | null;
  const text = body?.body?.trim() || "";
  const title = (body?.title || rows[0].title || "Note").trim().slice(0, 120);
  if (!text || Buffer.byteLength(text) > NOTE_MAX) {
    return c.json({ error: "Note is empty or too large" }, 400);
  }
  await writeFile(file, `# ${title}\n\n${text}`, "utf8");
  await getDb()
    .update(userNotes)
    .set({ title, bytes: Buffer.byteLength(text) })
    .where(and(eq(userNotes.id, id), eq(userNotes.userId, uid)));
  return c.json({ id, title, path: `/notes/${uid}/${id}.md` });
});

stateRoutes.delete("/notes/:id", async (c) => {
  const uid = c.get("user").uid;
  const id = c.req.param("id");
  const file = noteFile(uid, id);
  if (!file) return c.json({ error: "Not found" }, 404);
  const rows = await getDb()
    .select()
    .from(userNotes)
    .where(and(eq(userNotes.id, id), eq(userNotes.userId, uid)))
    .limit(1);
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  await unlink(file).catch(() => undefined);
  await getDb().delete(userNotes).where(and(eq(userNotes.id, id), eq(userNotes.userId, uid)));
  return c.json({ ok: true });
});

stateRoutes.get("/study-pack", async (c) => {
  const uid = c.get("user").uid;
  const semester = c.req.query("semester") || "";
  const personal = await getDb()
    .select()
    .from(studyPacks)
    .where(eq(studyPacks.scopeKey, `user:${uid}`))
    .orderBy(desc(studyPacks.createdAt))
    .limit(1);
  const row =
    personal[0] ||
    (
      await getDb()
        .select()
        .from(studyPacks)
        .where(eq(studyPacks.scopeKey, `semester:${semester}`))
        .orderBy(desc(studyPacks.createdAt))
        .limit(1)
    )[0];
  if (!row) return c.json({ pack: null });
  return c.json({ pack: row.payload, created_at: row.createdAt.toISOString() });
});

stateRoutes.get("/admin/status", async (c) => {
  const email = c.get("user").email?.toLowerCase();
  if (!email || !adminEmails().includes(email)) return c.json({ error: "Forbidden" }, 403);
  const meta = await getDb().select().from(healthMeta);
  const map = Object.fromEntries(meta.map((m) => [m.key, m.value]));
  let diskFreeRatio: number | null = null;
  try {
    const { statfs } = await import("node:fs/promises");
    const fs = await statfs(env().FILES_ROOT);
    diskFreeRatio = Math.round((Number(fs.bfree) / Number(fs.blocks)) * 1000) / 1000;
  } catch {
    diskFreeRatio = null;
  }
  return c.json({
    lastSyncAt: map.last_sync_at ?? null,
    ragChunkCount: map.rag_chunk_count ?? null,
    lastBackupAt: map.last_backup_at ?? null,
    lastStudyPackAt: map.last_study_pack_at ?? null,
    diskFreeRatio,
  });
});
