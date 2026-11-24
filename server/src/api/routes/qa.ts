import { Hono, type Context } from "hono";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "../../db/client.js";
import { qaAnswers, qaQuestions, qaSaved, qaVotes } from "../../db/schema.js";
import { isAdminAccount } from "../../lib/env.js";
import { checkRateLimit } from "../../lib/rateLimit.js";
import {
  ANSWER_BODY_MAX,
  ATTACHMENT_MAX,
  QUESTION_BODY_MAX,
  answerDto,
  answerViewerVotes,
  questionDto,
  questionViewerState,
  resolveAuthor,
  voteTransition,
  type VoteValue,
} from "../../lib/qa.js";
import { clientIp, requireUser, type AppVars } from "../middleware/auth.js";

/**
 * Doubt board on the home server. Mounted at /v1/qa. Response shapes match the
 * Firestore routes the web client already reads, so the client needs no changes.
 */
export const qaRoutes = new Hono<AppVars>();
qaRoutes.use("*", requireUser);

function limitOr429(c: Context<AppVars>, bucket: string, limit: number) {
  const uid = c.get("user").uid;
  const r = checkRateLimit(`${bucket}:${uid}:${clientIp(c)}`, limit, 60_000);
  if (r.ok) return null;
  return c.json({ error: "Rate limit exceeded" }, 429, { "Retry-After": String(r.retryAfterSec) });
}

const attachment = z
  .string()
  .max(500_000)
  .refine(
    (v) => v.startsWith("http://") || v.startsWith("https://") || v.startsWith("data:image/"),
    { message: "Attachment must be a valid URL or image data" },
  );

const listSchema = z.object({
  academic_year: z.string().min(1).max(16),
  branch: z.string().min(1).max(16),
  semester: z.coerce.number().int().min(1).max(8),
  subject_name: z.string().max(120).optional(),
  resource_id: z.string().max(128).optional(),
  category: z.enum(["doubt", "general"]).optional(),
  status: z.enum(["open", "resolved"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const createSchema = z.object({
  academic_year: z.string().min(1).max(16),
  branch: z.string().min(1).max(16),
  semester: z.coerce.number().int().min(1).max(8),
  subject_name: z.string().min(1).max(120),
  resource_id: z.string().max(128).optional(),
  resource_title: z.string().max(200).optional(),
  resource_url: z.string().max(1000).optional(),
  topic_unit: z.string().max(80).optional(),
  category: z.enum(["doubt", "general"]),
  body: z.string().min(1).max(QUESTION_BODY_MAX),
  attachments: z.array(attachment).max(ATTACHMENT_MAX).optional(),
  author_name: z.string().max(80).optional(),
});

const answerSchema = z.object({
  body: z.string().min(1).max(ANSWER_BODY_MAX),
  attachments: z.array(attachment).max(ATTACHMENT_MAX).optional(),
});

const patchSchema = z.object({
  status: z.enum(["open", "resolved"]).optional(),
  accepted_answer_id: z.string().min(1).max(128).optional(),
});

const voteSchema = z.object({
  target_type: z.enum(["question", "answer"]),
  target_id: z.string().min(1).max(128),
  value: z.union([z.literal(1), z.literal(-1)]),
});

const saveSchema = z.object({ question_id: z.string().min(1).max(128) });

async function readJson(c: Context): Promise<unknown> {
  return c.req.json().catch(() => null);
}

// ─── Questions ───────────────────────────────────────────────────────────────

qaRoutes.get("/questions", async (c) => {
  const parsed = listSchema.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return c.json({ error: "Invalid query params" }, 400);
  const q = parsed.data;
  const uid = c.get("user").uid;
  const db = getDb();

  const conditions = [
    eq(qaQuestions.academicYear, q.academic_year),
    eq(qaQuestions.branch, q.branch),
    eq(qaQuestions.semester, q.semester),
  ];
  if (q.subject_name) conditions.push(eq(qaQuestions.subjectName, q.subject_name));
  if (q.resource_id) conditions.push(eq(qaQuestions.resourceId, q.resource_id));
  if (q.category) conditions.push(eq(qaQuestions.category, q.category));
  if (q.status) conditions.push(eq(qaQuestions.status, q.status));

  const rows = await db
    .select()
    .from(qaQuestions)
    .where(and(...conditions))
    .orderBy(desc(qaQuestions.createdAt))
    .limit(q.limit ?? 50);

  const viewer = await questionViewerState(db, uid, rows.map((r) => r.id));
  return c.json({
    questions: rows.map((r) =>
      questionDto(r, {
        userVote: viewer.votes.get(r.id) ?? null,
        isSaved: viewer.saved.has(r.id),
      }),
    ),
  });
});

qaRoutes.post("/questions", async (c) => {
  const limited = limitOr429(c, "qa-question-create", 10);
  if (limited) return limited;
  const user = c.get("user");
  const parsed = createSchema.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: "Invalid question payload" }, 400);
  const data = parsed.data;
  const db = getDb();

  const author = await resolveAuthor(db, user.uid, user.email);
  const authorName =
    data.author_name?.trim() || user.email?.split("@")[0] || "Anonymous Scholar";
  const id = randomUUID();
  const body = data.body.slice(0, QUESTION_BODY_MAX);

  await db.insert(qaQuestions).values({
    id,
    userId: user.uid,
    authorName: authorName.slice(0, 80),
    authorPhotoUrl: author.photoUrl,
    academicYear: data.academic_year,
    branch: data.branch,
    semester: data.semester,
    subjectName: data.subject_name,
    resourceId: data.resource_id || null,
    resourceTitle: data.resource_title || null,
    resourceUrl: data.resource_url || null,
    topicUnit: data.topic_unit || null,
    category: data.category,
    title: body.slice(0, 80),
    body,
    attachments: data.attachments ?? [],
  });
  return c.json({ success: true, id });
});

qaRoutes.get("/questions/:id", async (c) => {
  const uid = c.get("user").uid;
  const id = c.req.param("id");
  const db = getDb();

  const [row] = await db.select().from(qaQuestions).where(eq(qaQuestions.id, id)).limit(1);
  if (!row) return c.json({ error: "Question not found" }, 404);

  const answers = await db
    .select()
    .from(qaAnswers)
    .where(eq(qaAnswers.questionId, id))
    .orderBy(desc(qaAnswers.upvotes))
    .limit(100);
  const [viewer, answerVotes] = await Promise.all([
    questionViewerState(db, uid, [id]),
    answerViewerVotes(db, uid, answers.map((a) => a.id)),
  ]);

  return c.json({
    question: {
      ...questionDto(row, {
        userVote: viewer.votes.get(id) ?? null,
        isSaved: viewer.saved.has(id),
      }),
      answers: answers.map((a) => answerDto(a, answerVotes.get(a.id) ?? null)),
    },
  });
});

qaRoutes.patch("/questions/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const db = getDb();

  const [row] = await db.select().from(qaQuestions).where(eq(qaQuestions.id, id)).limit(1);
  if (!row) return c.json({ error: "Question not found" }, 404);
  if (row.userId !== user.uid && !isAdminAccount(user)) {
    return c.json({ error: "Only the author or an admin can update this question" }, 403);
  }

  const parsed = patchSchema.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: "No valid updates" }, 400);
  const { status, accepted_answer_id: acceptedId } = parsed.data;
  if (!status && !acceptedId) return c.json({ error: "No valid updates" }, 400);

  const updates: Partial<typeof qaQuestions.$inferInsert> = {
    lastActivityAt: new Date(),
    updatedAt: new Date(),
  };
  if (status) updates.status = status;

  if (acceptedId) {
    const [answer] = await db
      .select()
      .from(qaAnswers)
      .where(eq(qaAnswers.id, acceptedId))
      .limit(1);
    if (!answer || answer.questionId !== id) {
      return c.json({ error: "Invalid answer ID" }, 400);
    }
    if (row.acceptedAnswerId && row.acceptedAnswerId !== acceptedId) {
      await db.update(qaAnswers).set({ isAccepted: false }).where(eq(qaAnswers.id, row.acceptedAnswerId));
    }
    await db.update(qaAnswers).set({ isAccepted: true }).where(eq(qaAnswers.id, acceptedId));
    updates.acceptedAnswerId = acceptedId;
    updates.status = "resolved";
  }

  await db.update(qaQuestions).set(updates).where(eq(qaQuestions.id, id));
  return c.json({ success: true });
});

qaRoutes.delete("/questions/:id", async (c) => {
  const limited = limitOr429(c, "qa-question-delete", 10);
  if (limited) return limited;
  const user = c.get("user");
  const id = c.req.param("id");
  const db = getDb();

  const [row] = await db.select().from(qaQuestions).where(eq(qaQuestions.id, id)).limit(1);
  if (!row) return c.json({ error: "Question not found" }, 404);
  if (row.userId !== user.uid && !isAdminAccount(user)) {
    return c.json({ error: "Forbidden: can only delete your own questions or as an admin" }, 403);
  }

  await db.transaction(async (tx) => {
    const answers = await tx
      .select({ id: qaAnswers.id })
      .from(qaAnswers)
      .where(eq(qaAnswers.questionId, id));
    await tx
      .delete(qaVotes)
      .where(and(eq(qaVotes.targetType, "question"), eq(qaVotes.targetId, id)));
    if (answers.length > 0) {
      await tx
        .delete(qaVotes)
        .where(and(eq(qaVotes.targetType, "answer"), inArray(qaVotes.targetId, answers.map((a) => a.id))));
    }
    // Answers and bookmarks cascade from the question row.
    await tx.delete(qaQuestions).where(eq(qaQuestions.id, id));
  });
  return c.json({ success: true });
});

// ─── Answers ─────────────────────────────────────────────────────────────────

qaRoutes.post("/questions/:id/answers", async (c) => {
  const limited = limitOr429(c, "qa-answer-create", 20);
  if (limited) return limited;
  const user = c.get("user");
  const questionId = c.req.param("id");
  const parsed = answerSchema.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: "Invalid answer payload" }, 400);
  const db = getDb();

  const [question] = await db
    .select({ id: qaQuestions.id })
    .from(qaQuestions)
    .where(eq(qaQuestions.id, questionId))
    .limit(1);
  if (!question) return c.json({ error: "Question not found" }, 404);

  const author = await resolveAuthor(db, user.uid, user.email);
  const id = randomUUID();
  await db.insert(qaAnswers).values({
    id,
    questionId,
    userId: user.uid,
    authorName: author.name,
    authorPhotoUrl: author.photoUrl,
    body: parsed.data.body.slice(0, ANSWER_BODY_MAX),
    attachments: parsed.data.attachments ?? [],
  });
  await db
    .update(qaQuestions)
    .set({
      answerCount: sql`${qaQuestions.answerCount} + 1`,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(qaQuestions.id, questionId));
  return c.json({ success: true, id });
});

qaRoutes.delete("/answers/:id", async (c) => {
  const limited = limitOr429(c, "qa-answer-delete", 10);
  if (limited) return limited;
  const user = c.get("user");
  const id = c.req.param("id");
  const db = getDb();

  const [answer] = await db.select().from(qaAnswers).where(eq(qaAnswers.id, id)).limit(1);
  if (!answer) return c.json({ error: "Answer not found" }, 404);
  if (answer.userId !== user.uid && !isAdminAccount(user)) {
    return c.json({ error: "Forbidden: can only delete your own answers or as an admin" }, 403);
  }

  await db.transaction(async (tx) => {
    await tx.delete(qaAnswers).where(eq(qaAnswers.id, id));
    await tx
      .delete(qaVotes)
      .where(and(eq(qaVotes.targetType, "answer"), eq(qaVotes.targetId, id)));
    const [question] = await tx
      .select({ acceptedAnswerId: qaQuestions.acceptedAnswerId })
      .from(qaQuestions)
      .where(eq(qaQuestions.id, answer.questionId))
      .limit(1);
    const clearsAccepted = question?.acceptedAnswerId === id;
    await tx
      .update(qaQuestions)
      .set({
        answerCount: sql`greatest(${qaQuestions.answerCount} - 1, 0)`,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
        ...(clearsAccepted ? { acceptedAnswerId: null, status: "open" } : {}),
      })
      .where(eq(qaQuestions.id, answer.questionId));
  });
  return c.json({ success: true });
});

// ─── Votes and bookmarks ─────────────────────────────────────────────────────

qaRoutes.post("/vote", async (c) => {
  const limited = limitOr429(c, "qa-vote", 60);
  if (limited) return limited;
  const uid = c.get("user").uid;
  const parsed = voteSchema.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: "Invalid vote payload" }, 400);
  const { target_type: targetType, target_id: targetId, value } = parsed.data;
  if (targetType === "question" && value === -1) {
    return c.json({ error: "Questions can only be upvoted" }, 400);
  }
  const db = getDb();

  const exists =
    targetType === "question"
      ? await db.select({ id: qaQuestions.id }).from(qaQuestions).where(eq(qaQuestions.id, targetId)).limit(1)
      : await db.select({ id: qaAnswers.id }).from(qaAnswers).where(eq(qaAnswers.id, targetId)).limit(1);
  if (exists.length === 0) return c.json({ error: `${targetType} not found` }, 404);

  const voteId = `${uid}_${targetType}_${targetId}`;
  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(qaVotes).where(eq(qaVotes.id, voteId)).limit(1);
    const t = voteTransition(existing ? (existing.value as VoteValue) : null, value);

    if (t.set === null) {
      await tx.delete(qaVotes).where(eq(qaVotes.id, voteId));
    } else {
      await tx
        .insert(qaVotes)
        .values({ id: voteId, userId: uid, targetType, targetId, value: t.set })
        .onConflictDoUpdate({ target: qaVotes.id, set: { value: t.set } });
    }

    if (targetType === "question") {
      if (t.up !== 0) {
        await tx
          .update(qaQuestions)
          .set({ upvotes: sql`${qaQuestions.upvotes} + ${t.up}` })
          .where(eq(qaQuestions.id, targetId));
      }
    } else if (t.up !== 0 || t.down !== 0) {
      await tx
        .update(qaAnswers)
        .set({
          upvotes: sql`${qaAnswers.upvotes} + ${t.up}`,
          downvotes: sql`${qaAnswers.downvotes} + ${t.down}`,
        })
        .where(eq(qaAnswers.id, targetId));
    }
  });
  return c.json({ success: true });
});

qaRoutes.post("/save", async (c) => {
  const limited = limitOr429(c, "qa-save", 30);
  if (limited) return limited;
  const uid = c.get("user").uid;
  const parsed = saveSchema.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: "Invalid payload" }, 400);
  const questionId = parsed.data.question_id;
  const db = getDb();

  const [question] = await db
    .select({ id: qaQuestions.id })
    .from(qaQuestions)
    .where(eq(qaQuestions.id, questionId))
    .limit(1);
  if (!question) return c.json({ error: "Question not found" }, 404);

  const id = `${uid}_${questionId}`;
  const [existing] = await db.select({ id: qaSaved.id }).from(qaSaved).where(eq(qaSaved.id, id)).limit(1);
  if (existing) {
    await db.delete(qaSaved).where(eq(qaSaved.id, id));
    return c.json({ success: true, saved: false });
  }
  await db.insert(qaSaved).values({ id, userId: uid, questionId }).onConflictDoNothing();
  return c.json({ success: true, saved: true });
});

qaRoutes.get("/saved", async (c) => {
  const uid = c.get("user").uid;
  const db = getDb();
  const saved = await db
    .select({ questionId: qaSaved.questionId })
    .from(qaSaved)
    .where(eq(qaSaved.userId, uid))
    .limit(200);
  if (saved.length === 0) return c.json({ questions: [] });

  const rows = await db
    .select()
    .from(qaQuestions)
    .where(inArray(qaQuestions.id, saved.map((s) => s.questionId)));
  return c.json({ questions: rows.map((r) => questionDto(r)) });
});
