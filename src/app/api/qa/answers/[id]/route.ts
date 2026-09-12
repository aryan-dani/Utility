import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { isAuthFailure, requireUser } from "@/lib/apiAuth";
import { enforceUserRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (isAuthFailure(auth)) return auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Answer ID required" }, { status: 400 });
  }

  const rate = await enforceUserRateLimit(auth.uid, "qa-answer-delete", 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }

  try {
    const db = adminDb();
    const aRef = db.collection("qa_answers").doc(id);
    const aDoc = await aRef.get();
    if (!aDoc.exists) {
      return NextResponse.json({ error: "Answer not found" }, { status: 404 });
    }

    const data = aDoc.data()!;
    if (data.author_uid !== auth.uid) {
      return NextResponse.json({ error: "Forbidden: can only delete your own answers" }, { status: 403 });
    }

    const questionId = data.question_id as string;
    const batch = db.batch();

    // Delete the answer
    batch.delete(aRef);

    // Decrement question answer_count
    const qRef = db.collection("qa_questions").doc(questionId);
    batch.update(qRef, {
      answer_count: FieldValue.increment(-1),
      last_activity_at: new Date().toISOString(),
    });

    // If this was the accepted answer, clear it
    const qDoc = await qRef.get();
    if (qDoc.exists && qDoc.data()?.accepted_answer_id === id) {
      batch.update(qRef, {
        accepted_answer_id: null,
        status: "open",
      });
    }

    // Clean up votes on this answer
    const votes = await db.collection("qa_votes")
      .where("target_type", "==", "answer")
      .where("target_id", "==", id)
      .limit(500)
      .get();
    votes.docs.forEach((d) => batch.delete(d.ref));

    await batch.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("qa/answers/[id] DELETE", error);
    return NextResponse.json({ error: "Failed to delete answer" }, { status: 500 });
  }
}
