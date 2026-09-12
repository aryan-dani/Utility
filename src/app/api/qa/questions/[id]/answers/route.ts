import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { isAuthFailure, requireUser } from "@/lib/apiAuth";
import { enforceUserRateLimit } from "@/lib/rateLimit";
import { z } from "zod";
import { ANSWER_BODY_MAX, ATTACHMENT_MAX } from "@/lib/qa/types";

export const dynamic = "force-dynamic";

const answerSchema = z.object({
  body: z.string().min(1).max(ANSWER_BODY_MAX),
  attachments: z
    .array(
      z
        .string()
        .max(500_000)
        .refine(
          (val) =>
            val.startsWith("http://") ||
            val.startsWith("https://") ||
            val.startsWith("data:image/"),
          { message: "Attachment must be a valid URL or image data" },
        ),
    )
    .max(ATTACHMENT_MAX)
    .optional(),
  author_name: z.string().max(80).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (isAuthFailure(auth)) return auth;

  const { id: questionId } = await params;
  if (!questionId) {
    return NextResponse.json({ error: "Question ID required" }, { status: 400 });
  }

  const rate = await enforceUserRateLimit(auth.uid, "qa-answer-create", 20, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }

  try {
    const body = await request.json();
    const parsed = answerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid answer payload" }, { status: 400 });
    }

    const db = adminDb();
    const qRef = db.collection("qa_questions").doc(questionId);
    const qDoc = await qRef.get();
    if (!qDoc.exists) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const data = parsed.data;
    const authorName =
      data.author_name?.trim() ||
      auth.email?.split("@")[0] ||
      "Anonymous Scholar";

    const now = new Date().toISOString();

    const answerRef = await db.collection("qa_answers").add({
      question_id: questionId,
      author_uid: auth.uid,
      author_name: authorName.slice(0, 80),
      body: data.body.slice(0, ANSWER_BODY_MAX),
      attachments: data.attachments || [],
      upvotes: 0,
      downvotes: 0,
      is_accepted: false,
      created_at: now,
    });

    // Update question's denormalized count and last_activity_at
    await qRef.update({
      answer_count: FieldValue.increment(1),
      last_activity_at: now,
    });

    return NextResponse.json({ success: true, id: answerRef.id });
  } catch (error) {
    console.error("qa/questions/[id]/answers POST", error);
    return NextResponse.json({ error: "Failed to post answer" }, { status: 500 });
  }
}
