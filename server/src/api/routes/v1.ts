import { Hono } from "hono";
import { streamText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb } from "../../db/client.js";
import {
  activityLogs,
  qaAnswers,
  qaQuestions,
  qaSaved,
  qaVotes,
  resourceContent,
  resourceTotals,
  resourceUsage,
  visualizeTelemetry,
} from "../../db/schema.js";
import { env } from "../../lib/env.js";
import { checkRateLimit } from "../../lib/rateLimit.js";
import { retrieve } from "../../lib/retrieve.js";
import { CHAT_TEMPERATURE } from "../../lib/ragConfig.js";
import {
  requireUser,
  type AppVars,
  clientIp,
} from "../middleware/auth.js";

export const v1Routes = new Hono<AppVars>();

v1Routes.use("*", requireUser);

function rateOr429(
  c: { json: (b: unknown, s: number, h?: Record<string, string>) => Response; get: (k: "user") => { uid: string } },
  bucket: string,
  limit: number,
  windowMs = 60_000,
) {
  const uid = c.get("user").uid;
  const ip = clientIp(c as never);
  const r = checkRateLimit(`${bucket}:${uid}:${ip}`, limit, windowMs);
  if (!r.ok) {
    return c.json(
      { error: "Rate limit exceeded" },
      429,
      { "Retry-After": String(r.retryAfterSec) },
    );
  }
  return null;
}

v1Routes.get("/search", async (c) => {
  const limited = rateOr429(c, "search", 20);
  if (limited) return limited;
  const q = c.req.query("q") || "";
  const academicYear = c.req.query("year") || undefined;
  const branch = c.req.query("branch") || undefined;
  const semesterRaw = c.req.query("semester");
  const semester = semesterRaw ? Number(semesterRaw) : undefined;
  const resourceId = c.req.query("resourceId") || undefined;
  const { sources, context } = await retrieve({
    query: q,
    academicYear,
    branch,
    semester,
    resourceId,
  });
  return c.json({ sources, context });
});

v1Routes.post("/chat", async (c) => {
  const limited = rateOr429(c, "chat", 30);
  if (limited) return limited;
  if (!env().GROQ_API_KEY) {
    return c.json({ error: "GROQ_API_KEY not configured" }, 503);
  }
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  const messages = (body as { messages?: Array<{ role: string; content: string }> })
    .messages;
  const scope = (body as {
    academicYear?: string;
    branch?: string;
    semester?: number;
  }) || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return c.json({ error: "messages required" }, 400);
  }
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const query = lastUser?.content || "";
  const { sources, context } = await retrieve({
    query,
    academicYear: scope.academicYear,
    branch: scope.branch,
    semester: scope.semester,
  });

  const groq = createGroq({ apiKey: env().GROQ_API_KEY });
  const system = [
    "You are Utility OS study assistant for MIT-WPU students.",
    "Answer using the provided notes context when relevant. Cite sources as [n].",
    "If context is empty, say you lack notes and answer from general knowledge carefully.",
    context ? `\nNotes context:\n${context}` : "\n(No notes retrieved.)",
  ].join("\n");

  const result = streamText({
    model: groq("openai/gpt-oss-120b"),
    system,
    messages: messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
    temperature: CHAT_TEMPERATURE,
    abortSignal: AbortSignal.timeout(45_000),
  });

  // Attach sources as a header for clients that want them without parsing the stream.
  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "X-Utility-Sources": Buffer.from(
      JSON.stringify(
        sources.map((s) => ({
          resourceId: s.resourceId,
          title: s.title,
          chunkIndex: s.chunkIndex,
        })),
      ),
    ).toString("base64url"),
  });

  return result.toTextStreamResponse({ headers });
});

v1Routes.post("/study", async (c) => {
  const limited = rateOr429(c, "study", 20);
  if (limited) return limited;
  if (!env().GROQ_API_KEY) {
    return c.json({ error: "GROQ_API_KEY not configured" }, 503);
  }
  const body = (await c.req.json().catch(() => null)) as {
    mode?: string;
    query?: string;
    academicYear?: string;
    branch?: string;
    semester?: number;
  } | null;
  if (!body?.query) return c.json({ error: "query required" }, 400);
  const { sources, context } = await retrieve({
    query: body.query,
    academicYear: body.academicYear,
    branch: body.branch,
    semester: body.semester,
  });
  const groq = createGroq({ apiKey: env().GROQ_API_KEY });
  const mode = body.mode === "quiz" ? "quiz" : "flashcards";
  const prompt =
    mode === "quiz"
      ? `Create 5 short quiz Q&As from the notes. Return JSON {items:[{q,a}]}.\n${context}`
      : `Create 8 flashcards from the notes. Return JSON {items:[{front,back}]}.\n${context}`;
  const { generateText } = await import("ai");
  const out = await generateText({
    model: groq("openai/gpt-oss-20b"),
    prompt,
    temperature: 0.3,
    abortSignal: AbortSignal.timeout(45_000),
  });
  return c.json({ text: out.text, sources });
});

v1Routes.get("/resources/:id/summarize", async (c) => {
  const limited = rateOr429(c, "summarize", 20);
  if (limited) return limited;
  const id = c.req.param("id");
  const rows = await getDb()
    .select()
    .from(resourceContent)
    .where(eq(resourceContent.resourceId, id))
    .limit(1);
  const row = rows[0];
  if (!row) return c.json({ error: "Not found" }, 404);
  if (row.aiSummary) return c.json({ summary: row.aiSummary });
  if (!env().GROQ_API_KEY) {
    return c.json({ summary: row.content.slice(0, 800) });
  }
  const groq = createGroq({ apiKey: env().GROQ_API_KEY });
  const { generateText } = await import("ai");
  const out = await generateText({
    model: groq("openai/gpt-oss-20b"),
    prompt: `Summarize these course notes in 5 bullet points:\n${row.content.slice(0, 6000)}`,
    temperature: 0.2,
    abortSignal: AbortSignal.timeout(45_000),
  });
  await getDb()
    .update(resourceContent)
    .set({ aiSummary: out.text, updatedAt: new Date() })
    .where(eq(resourceContent.resourceId, id));
  return c.json({ summary: out.text });
});

v1Routes.get("/activity", async (c) => {
  const uid = c.get("user").uid;
  const rows = await getDb()
    .select()
    .from(activityLogs)
    .where(eq(activityLogs.userId, uid))
    .orderBy(desc(activityLogs.loggedDate))
    .limit(120);
  return c.json({
    logs: rows.map((r) => ({
      id: r.id,
      actionType: r.actionType,
      loggedDate: r.loggedDate,
      count: r.count,
    })),
  });
});

v1Routes.post("/activity", async (c) => {
  const limited = rateOr429(c, "activity", 60);
  if (limited) return limited;
  const uid = c.get("user").uid;
  const body = (await c.req.json().catch(() => null)) as {
    events?: Array<{
      actionType: string;
      loggedDate: string;
      count?: number;
      resourceId?: string;
    }>;
  } | null;
  const events = body?.events;
  if (!Array.isArray(events) || events.length === 0) {
    return c.json({ error: "events required" }, 400);
  }
  const db = getDb();
  for (const ev of events.slice(0, 50)) {
    if (!ev.actionType || !ev.loggedDate) continue;
    const id = `${uid}_${ev.loggedDate}_${ev.actionType}`;
    await db
      .insert(activityLogs)
      .values({
        id,
        userId: uid,
        actionType: ev.actionType,
        loggedDate: ev.loggedDate,
        count: ev.count ?? 1,
      })
      .onConflictDoUpdate({
        target: [activityLogs.userId, activityLogs.loggedDate, activityLogs.actionType],
        set: {
          count: sql`${activityLogs.count} + ${ev.count ?? 1}`,
          updatedAt: new Date(),
        },
      });
    if (ev.resourceId && ev.actionType === "resource_open") {
      await db
        .insert(resourceUsage)
        .values({
          userId: uid,
          resourceId: ev.resourceId,
          count: 1,
          lastOpenedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [resourceUsage.userId, resourceUsage.resourceId],
          set: {
            count: sql`${resourceUsage.count} + 1`,
            lastOpenedAt: new Date(),
          },
        });
      await db
        .insert(resourceTotals)
        .values({ resourceId: ev.resourceId, openCount: 1 })
        .onConflictDoUpdate({
          target: resourceTotals.resourceId,
          set: { openCount: sql`${resourceTotals.openCount} + 1` },
        });
    }
  }
  return c.json({ ok: true });
});

v1Routes.get("/qa/questions", async (c) => {
  const academicYear = c.req.query("year");
  const branch = c.req.query("branch");
  const semester = c.req.query("semester");
  const conditions = [];
  if (academicYear) conditions.push(eq(qaQuestions.academicYear, academicYear));
  if (branch) conditions.push(eq(qaQuestions.branch, branch));
  if (semester) conditions.push(eq(qaQuestions.semester, Number(semester)));
  const rows = await getDb()
    .select()
    .from(qaQuestions)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(qaQuestions.createdAt))
    .limit(50);
  return c.json({ questions: rows });
});

v1Routes.post("/qa/questions", async (c) => {
  const limited = rateOr429(c, "qa_post", 10);
  if (limited) return limited;
  const uid = c.get("user").uid;
  const body = (await c.req.json().catch(() => null)) as {
    title?: string;
    body?: string;
    academicYear?: string;
    branch?: string;
    semester?: number;
    subjectName?: string;
    authorName?: string;
  } | null;
  if (!body?.title || !body?.body || !body.academicYear || !body.branch || body.semester == null) {
    return c.json({ error: "missing fields" }, 400);
  }
  const id = randomUUID();
  await getDb().insert(qaQuestions).values({
    id,
    userId: uid,
    authorName: body.authorName ?? null,
    academicYear: body.academicYear,
    branch: body.branch,
    semester: body.semester,
    subjectName: body.subjectName ?? null,
    title: body.title.slice(0, 200),
    body: body.body.slice(0, 8000),
  });
  return c.json({ id }, 201);
});

v1Routes.get("/qa/questions/:id", async (c) => {
  const id = c.req.param("id");
  const q = await getDb()
    .select()
    .from(qaQuestions)
    .where(eq(qaQuestions.id, id))
    .limit(1);
  if (!q[0]) return c.json({ error: "Not found" }, 404);
  const answers = await getDb()
    .select()
    .from(qaAnswers)
    .where(eq(qaAnswers.questionId, id))
    .orderBy(desc(qaAnswers.upvotes))
    .limit(100);
  return c.json({ question: q[0], answers });
});

v1Routes.post("/qa/questions/:id/answers", async (c) => {
  const limited = rateOr429(c, "qa_answer", 20);
  if (limited) return limited;
  const uid = c.get("user").uid;
  const qid = c.req.param("id");
  const body = (await c.req.json().catch(() => null)) as {
    body?: string;
    authorName?: string;
  } | null;
  if (!body?.body) return c.json({ error: "body required" }, 400);
  const id = randomUUID();
  await getDb().insert(qaAnswers).values({
    id,
    questionId: qid,
    userId: uid,
    authorName: body.authorName ?? null,
    body: body.body.slice(0, 8000),
  });
  await getDb()
    .update(qaQuestions)
    .set({
      answerCount: sql`${qaQuestions.answerCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(qaQuestions.id, qid));
  return c.json({ id }, 201);
});

v1Routes.post("/qa/vote", async (c) => {
  const limited = rateOr429(c, "qa_vote", 60);
  if (limited) return limited;
  const uid = c.get("user").uid;
  const body = (await c.req.json().catch(() => null)) as {
    targetType?: "question" | "answer";
    targetId?: string;
    value?: 1 | -1 | 0;
  } | null;
  if (!body?.targetType || !body.targetId || body.value == null) {
    return c.json({ error: "missing fields" }, 400);
  }
  const id = `${uid}_${body.targetType}_${body.targetId}`;
  if (body.value === 0) {
    await getDb().delete(qaVotes).where(eq(qaVotes.id, id));
  } else {
    await getDb()
      .insert(qaVotes)
      .values({
        id,
        userId: uid,
        targetType: body.targetType,
        targetId: body.targetId,
        value: body.value,
      })
      .onConflictDoUpdate({
        target: [qaVotes.userId, qaVotes.targetType, qaVotes.targetId],
        set: { value: body.value },
      });
  }
  return c.json({ ok: true });
});

v1Routes.post("/qa/save", async (c) => {
  const uid = c.get("user").uid;
  const body = (await c.req.json().catch(() => null)) as {
    questionId?: string;
    saved?: boolean;
  } | null;
  if (!body?.questionId) return c.json({ error: "questionId required" }, 400);
  const id = `${uid}_${body.questionId}`;
  if (body.saved === false) {
    await getDb().delete(qaSaved).where(eq(qaSaved.id, id));
  } else {
    await getDb()
      .insert(qaSaved)
      .values({ id, userId: uid, questionId: body.questionId })
      .onConflictDoNothing();
  }
  return c.json({ ok: true });
});

v1Routes.post("/visualize/telemetry", async (c) => {
  const limited = rateOr429(c, "viz_tel", 60);
  if (limited) return limited;
  const uid = c.get("user").uid;
  const body = (await c.req.json().catch(() => null)) as {
    event?: string;
    payload?: unknown;
  } | null;
  if (!body?.event) return c.json({ error: "event required" }, 400);
  await getDb().insert(visualizeTelemetry).values({
    id: randomUUID(),
    userId: uid,
    event: body.event.slice(0, 64),
    payload: body.payload ?? null,
  });
  return c.json({ ok: true });
});
