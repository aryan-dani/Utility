import { Hono } from "hono";
import { createUIMessageStream, createUIMessageStreamResponse, streamText } from "ai";
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
  const results = sources.map((s) => ({
    resource_id: s.resourceId,
    title: s.title,
    subject_name: "",
    snippet: s.text.slice(0, 400),
    section_label: s.sectionLabel ?? undefined,
  }));
  return c.json({ sources, context, results });
});

function messageText(m: {
  content?: string;
  parts?: Array<{ text?: string }>;
}): string {
  if (typeof m.content === "string" && m.content.trim()) return m.content;
  if (Array.isArray(m.parts)) return m.parts.map((p) => p.text || "").join("\n").trim();
  return "";
}

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
  const raw = body as {
    messages?: Array<{ role?: string; content?: string; parts?: Array<{ text?: string }> }>;
    academicYear?: string;
    branch?: string;
    semester?: number;
    context?: {
      academicYear?: string;
      branch?: string;
      semester?: number;
      resourceId?: string;
    };
  };
  const messages = raw.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return c.json({ error: "messages required" }, 400);
  }
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const query = lastUser ? messageText(lastUser) : "";
  const { sources, context } = await retrieve({
    query,
    academicYear: raw.context?.academicYear || raw.academicYear,
    branch: raw.context?.branch || raw.branch,
    semester: raw.context?.semester ?? raw.semester,
    resourceId: raw.context?.resourceId,
  });

  // Empty home index: client falls back to Vercel, which still has PDF text.
  if (sources.length === 0) {
    return c.json({ fallback: true, sources: [] }, 200, {
      "X-Utility-Source-Count": "0",
    });
  }

  const groq = createGroq({ apiKey: env().GROQ_API_KEY });
  const system = [
    "You are Utility OS study assistant for MIT-WPU students.",
    "Answer using the provided notes context. Cite sources as [S1], [S2].",
    `\nNotes context:\n${context}`,
  ].join("\n");

  const uiSources = sources.map((s, i) => ({
    marker: `S${i + 1}`,
    resource_id: s.resourceId,
    title: s.title,
    subject_name: "",
    section_label: s.sectionLabel ?? undefined,
    snippet: s.text.slice(0, 400),
  }));

  const stream = createUIMessageStream({
    execute({ writer }) {
      writer.write({ type: "data-sources", data: uiSources } as never);
      const result = streamText({
        model: groq("openai/gpt-oss-120b"),
        system,
        messages: messages
          .map((m) => ({
            role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
            content: messageText(m),
          }))
          .filter((m) => m.content),
        temperature: CHAT_TEMPERATURE,
        abortSignal: AbortSignal.timeout(45_000),
      });
      writer.merge(result.toUIMessageStream());
    },
  });

  return createUIMessageStreamResponse({
    stream,
    headers: {
      "X-Utility-Source-Count": String(sources.length),
    },
  });
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
    type?: string;
    topic?: string;
    academicYear?: string;
    branch?: string;
    semester?: number;
    context?: {
      academicYear?: string;
      branch?: string;
      semester?: number;
    };
  } | null;
  const topic = (body?.topic || body?.query || "").trim();
  if (!topic) return c.json({ error: "query required" }, 400);
  const academicYear = body?.context?.academicYear || body?.academicYear;
  const branch = body?.context?.branch || body?.branch;
  const semester = body?.context?.semester ?? body?.semester;
  const { sources, context } = await retrieve({
    query: topic,
    academicYear,
    branch,
    semester,
  });
  const groq = createGroq({ apiKey: env().GROQ_API_KEY });
  const mode =
    body?.type === "pyq" || body?.mode === "pyq"
      ? "pyq"
      : body?.type === "quiz" || body?.mode === "quiz"
        ? "quiz"
        : "flashcards";
  const prompt =
    mode === "pyq"
      ? `Write 5 university exam questions (PYQ style) from the notes. Return ONLY JSON {quiz:[{id,question,options:[A,B,C,D],correctIndex,explanation,citations:[]}]}.\n${context}`
      : mode === "quiz"
      ? `Create a 5-question multiple-choice quiz from the notes. Return ONLY JSON {quiz:[{id,question,options:[A,B,C,D],correctIndex,explanation,citations:[]}]}.\n${context}`
      : `Create 8 flashcards from the notes. Return ONLY JSON {flashcards:[{id,question,answer}]}.\n${context}`;
  const { generateText } = await import("ai");
  const out = await generateText({
    model: groq("openai/gpt-oss-20b"),
    prompt,
    temperature: 0.3,
    abortSignal: AbortSignal.timeout(45_000),
  });
  try {
    const parsed = JSON.parse(
      out.text.replace(/```json|```/g, "").trim(),
    ) as Record<string, unknown>;
    if (parsed.flashcards || parsed.quiz) {
      return c.json({ ...parsed, sources });
    }
  } catch {
    /* return raw text for client-side parse */
  }
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
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const n = Number(r.count) || 0;
    if (!r.loggedDate || n <= 0) continue;
    counts[r.loggedDate] = (counts[r.loggedDate] || 0) + n;
  }
  return c.json({
    counts,
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

function questionDto(row: typeof qaQuestions.$inferSelect) {
  return {
    id: row.id,
    academic_year: row.academicYear,
    branch: row.branch,
    semester: row.semester,
    subject_name: row.subjectName || "",
    category: "doubt" as const,
    author_uid: row.userId,
    author_name: row.authorName || "Student",
    body: row.body,
    attachments: [] as string[],
    status: "open" as const,
    upvotes: row.upvotes,
    answer_count: row.answerCount,
    ai_auto_answered: false,
    needs_human: false,
    created_at: row.createdAt.toISOString(),
    last_activity_at: row.updatedAt.toISOString(),
    title: row.title,
  };
}

v1Routes.get("/qa/questions", async (c) => {
  const academicYear = c.req.query("academic_year") || c.req.query("year");
  const branch = c.req.query("branch");
  const semester = c.req.query("semester");
  const subject = c.req.query("subject_name");
  const conditions = [];
  if (academicYear) conditions.push(eq(qaQuestions.academicYear, academicYear));
  if (branch) conditions.push(eq(qaQuestions.branch, branch));
  if (semester) conditions.push(eq(qaQuestions.semester, Number(semester)));
  if (subject) conditions.push(eq(qaQuestions.subjectName, subject));
  const rows = await getDb()
    .select()
    .from(qaQuestions)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(qaQuestions.createdAt))
    .limit(50);
  return c.json({ questions: rows.map(questionDto) });
});

v1Routes.post("/qa/questions", async (c) => {
  const limited = rateOr429(c, "qa_post", 10);
  if (limited) return limited;
  const uid = c.get("user").uid;
  const body = (await c.req.json().catch(() => null)) as {
    title?: string;
    body?: string;
    academicYear?: string;
    academic_year?: string;
    branch?: string;
    semester?: number;
    subjectName?: string;
    subject_name?: string;
    authorName?: string;
    author_name?: string;
  } | null;
  const academicYear = body?.academicYear || body?.academic_year;
  const text = body?.body || "";
  const title = body?.title || text.slice(0, 80);
  if (!title || !text || !academicYear || !body?.branch || body.semester == null) {
    return c.json({ error: "missing fields" }, 400);
  }
  const id = randomUUID();
  await getDb().insert(qaQuestions).values({
    id,
    userId: uid,
    authorName: body.authorName || body.author_name || null,
    academicYear,
    branch: body.branch,
    semester: body.semester,
    subjectName: body.subjectName || body.subject_name || null,
    title: title.slice(0, 200),
    body: text.slice(0, 8000),
  });
  return c.json({ id, success: true }, 201);
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
  const answerDtos = answers.map((a) => ({
    id: a.id,
    question_id: a.questionId,
    author_uid: a.userId,
    author_name: a.authorName || "Student",
    body: a.body,
    attachments: [] as string[],
    upvotes: a.upvotes,
    downvotes: a.downvotes,
    is_accepted: false,
    created_at: a.createdAt.toISOString(),
  }));
  return c.json({
    question: { ...questionDto(q[0]), answers: answerDtos },
    answers: answerDtos,
  });
});

v1Routes.delete("/qa/questions/:id", async (c) => {
  const uid = c.get("user").uid;
  const id = c.req.param("id");
  const rows = await getDb().select().from(qaQuestions).where(eq(qaQuestions.id, id)).limit(1);
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  if (rows[0].userId !== uid) return c.json({ error: "Forbidden" }, 403);
  await getDb().delete(qaQuestions).where(eq(qaQuestions.id, id));
  return c.json({ ok: true });
});

v1Routes.delete("/qa/answers/:id", async (c) => {
  const uid = c.get("user").uid;
  const id = c.req.param("id");
  const rows = await getDb().select().from(qaAnswers).where(eq(qaAnswers.id, id)).limit(1);
  if (!rows[0]) return c.json({ error: "Not found" }, 404);
  if (rows[0].userId !== uid) return c.json({ error: "Forbidden" }, 403);
  await getDb().delete(qaAnswers).where(eq(qaAnswers.id, id));
  return c.json({ ok: true });
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
    target_type?: "question" | "answer";
    targetId?: string;
    target_id?: string;
    value?: 1 | -1 | 0;
  } | null;
  const targetType = body?.targetType || body?.target_type;
  const targetId = body?.targetId || body?.target_id;
  if (!targetType || !targetId || body?.value == null) {
    return c.json({ error: "missing fields" }, 400);
  }
  const id = `${uid}_${targetType}_${targetId}`;
  if (body.value === 0) {
    await getDb().delete(qaVotes).where(eq(qaVotes.id, id));
  } else {
    await getDb()
      .insert(qaVotes)
      .values({
        id,
        userId: uid,
        targetType,
        targetId,
        value: body.value,
      })
      .onConflictDoUpdate({
        target: [qaVotes.userId, qaVotes.targetType, qaVotes.targetId],
        set: { value: body.value },
      });
  }
  return c.json({ ok: true });
});

v1Routes.get("/qa/saved", async (c) => {
  const uid = c.get("user").uid;
  const saved = await getDb().select().from(qaSaved).where(eq(qaSaved.userId, uid)).limit(200);
  if (saved.length === 0) return c.json({ questions: [] });
  const questions = [];
  for (const row of saved) {
    const q = await getDb().select().from(qaQuestions).where(eq(qaQuestions.id, row.questionId)).limit(1);
    if (q[0]) questions.push(questionDto(q[0]));
  }
  return c.json({ questions });
});

v1Routes.post("/qa/save", async (c) => {
  const uid = c.get("user").uid;
  const body = (await c.req.json().catch(() => null)) as {
    questionId?: string;
    question_id?: string;
    saved?: boolean;
  } | null;
  const questionId = body?.questionId || body?.question_id;
  if (!questionId) return c.json({ error: "questionId required" }, 400);
  const id = `${uid}_${questionId}`;
  const existing = await getDb().select().from(qaSaved).where(eq(qaSaved.id, id)).limit(1);
  if (body.saved === false || existing[0]) {
    await getDb().delete(qaSaved).where(eq(qaSaved.id, id));
    return c.json({ ok: true, saved: false });
  }
  await getDb().insert(qaSaved).values({ id, userId: uid, questionId });
  return c.json({ ok: true, saved: true });
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
