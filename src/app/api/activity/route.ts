import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "@/lib/firebaseAdmin";
import { isAuthFailure, requireUser } from "@/lib/apiAuth";
import { localDateKey } from "@/lib/dateLocal";
import { enforceUserRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const ALLOWED_ACTIONS = new Set([
  "ai_prompt",
  "flashcard_generated",
  "community_deck_published",
  "community_deck_upvoted",
  "community_deck_copied",
  "quiz_generated",
  "quiz_submitted",
  "syllabus_module_completed",
  "srs_flashcard_reviewed",
  "focus_timer_completed",
  "planner_task_completed",
  "focus_session",
  "srs_review",
  "planner_task",
  "ask_chat",
  "study_flashcards",
  "study_quiz",
  "resource_open",
  "summary_generated",
]);

const actionSchema = z.object({
  actionType: z
    .string()
    .refine((v) => ALLOWED_ACTIONS.has(v), { message: "Invalid actionType" }),
  count: z.number().int().min(1).max(100),
});

const openSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().max(200).optional().default(""),
  subject: z.string().max(120).optional().default(""),
  count: z.number().int().min(1).max(100),
});

const legacyPostSchema = actionSchema;

const batchPostSchema = z
  .object({
    actions: z.array(actionSchema).max(20).optional(),
    opens: z.array(openSchema).max(15).optional(),
  })
  .refine(
    (v) => (v.actions?.length ?? 0) + (v.opens?.length ?? 0) > 0,
    { message: "Empty batch" },
  );

function daysAgoLocal(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDateKey(d);
}

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max);
}

async function writeActionLog(
  userId: string,
  actionType: string,
  count: number,
  today: string,
) {
  const db = adminDb();
  const docId = `${userId}_${actionType}_${today}`;
  await db
    .collection("activity_logs")
    .doc(docId)
    .set(
      {
        user_id: userId,
        action_type: actionType,
        count: FieldValue.increment(Math.floor(count)),
        logged_date: today,
      },
      { merge: true },
    );
}

async function writeResourceOpens(
  userId: string,
  opens: z.infer<typeof openSchema>[],
  today: string,
) {
  const db = adminDb();
  const nowIso = new Date().toISOString();
  let totalOpenIncrements = 0;

  for (const open of opens) {
    const resourceId = truncate(open.id, 128);
    if (!resourceId) continue;
    const count = Math.floor(open.count);
    const title = truncate(open.title || "", 200);
    const subject = truncate(open.subject || "", 120);
    const usageId = `${userId}_${resourceId}`;
    const usageRef = db.collection("resource_usage").doc(usageId);
    const totalsRef = db.collection("resource_totals").doc(resourceId);

    await db.runTransaction(async (tx) => {
      const usageSnap = await tx.get(usageRef);
      const isNew = !usageSnap.exists;

      tx.set(
        usageRef,
        {
          user_id: userId,
          resource_id: resourceId,
          count: FieldValue.increment(count),
          lastOpenedAt: nowIso,
          ...(title ? { title } : {}),
          ...(subject ? { subject } : {}),
        },
        { merge: true },
      );

      tx.set(
        totalsRef,
        {
          resource_id: resourceId,
          opens: FieldValue.increment(count),
          lastOpenedAt: nowIso,
          ...(title ? { title } : {}),
          ...(subject ? { subject } : {}),
          ...(isNew ? { uniqueOpeners: FieldValue.increment(1) } : {}),
        },
        { merge: true },
      );
    });

    totalOpenIncrements += count;
  }

  if (totalOpenIncrements <= 0) return;

  const last = opens[opens.length - 1];
  const lastTitle = truncate(last?.title || "", 200);
  const lastId = truncate(last?.id || "", 128);

  await Promise.all([
    writeActionLog(userId, "resource_open", totalOpenIncrements, today),
    db
      .collection("users")
      .doc(userId)
      .set(
        {
          resourceOpenCount: FieldValue.increment(totalOpenIncrements),
          lastOpenedAt: nowIso,
          ...(lastTitle ? { lastOpenedTitle: lastTitle } : {}),
          ...(lastId ? { lastOpenedResourceId: lastId } : {}),
        },
        { merge: true },
      ),
    db
      .collection("stats")
      .doc("usage")
      .set(
        {
          totalOpens: FieldValue.increment(totalOpenIncrements),
          updatedAt: nowIso,
        },
        { merge: true },
      ),
  ]);
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (isAuthFailure(auth)) return auth;

    const userId = auth.uid;
    const db = adminDb();
    const since = daysAgoLocal(90);

    const snapshot = await db
      .collection("activity_logs")
      .where("user_id", "==", userId)
      .where("logged_date", ">=", since)
      .limit(120)
      .get();

    const counts: Record<string, number> = {};
    for (const docSnap of snapshot.docs) {
      const d = docSnap.data();
      const date = d.logged_date as string | undefined;
      const count = Number(d.count) || 0;
      if (!date || count <= 0) continue;
      counts[date] = (counts[date] || 0) + count;
    }

    return NextResponse.json(
      { counts },
      {
        headers: {
          "Cache-Control": "private, max-age=300",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity logs" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (isAuthFailure(auth)) return auth;

    const rate = await enforceUserRateLimit(auth.uid, "activity", 60, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec) },
        },
      );
    }

    const userId = auth.uid;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const today = localDateKey();
    const legacy = legacyPostSchema.safeParse(body);
    if (legacy.success) {
      await writeActionLog(
        userId,
        legacy.data.actionType,
        legacy.data.count,
        today,
      );
      return NextResponse.json({ success: true });
    }

    const batch = batchPostSchema.safeParse(body);
    if (!batch.success) {
      return NextResponse.json(
        { error: "Invalid actionType, count, or opens batch" },
        { status: 400 },
      );
    }

    const actions = batch.data.actions ?? [];
    const opens = batch.data.opens ?? [];

    await Promise.all(
      actions.map((a) => writeActionLog(userId, a.actionType, a.count, today)),
    );

    if (opens.length > 0) {
      await writeResourceOpens(userId, opens, today);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error logging activity:", error);
    return NextResponse.json(
      { error: "Failed to log activity" },
      { status: 500 },
    );
  }
}
