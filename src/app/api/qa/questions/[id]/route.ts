import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { isAuthFailure, requireUser, optionalUser, getAdminEmails } from "@/lib/apiAuth";
import { enforceUserRateLimit } from "@/lib/rateLimit";
import type { QAQuestion, QAAnswer } from "@/lib/qa/types";

export const dynamic = "force-dynamic";

// ─── GET - single question with answers ──────────────────────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await optionalUser(request);

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Question ID required" }, { status: 400 });
  }

  try {
    const db = adminDb();
    const qDoc = await db.collection("qa_questions").doc(id).get();
    if (!qDoc.exists) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const question: QAQuestion = { id: qDoc.id, ...qDoc.data() } as QAQuestion;

    // Fetch answers sorted by upvotes desc (with graceful fallback if index is building)
    let answerSnap: FirebaseFirestore.QuerySnapshot;
    try {
      answerSnap = await db
        .collection("qa_answers")
        .where("question_id", "==", id)
        .orderBy("upvotes", "desc")
        .limit(100)
        .get();
    } catch {
      answerSnap = await db
        .collection("qa_answers")
        .where("question_id", "==", id)
        .limit(100)
        .get();
    }

    const answers: QAAnswer[] = answerSnap.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as QAAnswer),
    );
    answers.sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0));

    // Check if current user voted on or saved this question
    let userVote: number | null = null;
    let isSaved = false;

    if (user) {
      const [voteDoc, savedDoc] = await Promise.all([
        db.collection("qa_votes").doc(`${user.uid}_question_${id}`).get(),
        db.collection("qa_saved").doc(`${user.uid}_${id}`).get(),
      ]);
      userVote = voteDoc.exists ? (voteDoc.data()?.value as number) : null;
      isSaved = savedDoc.exists;
    }

    return NextResponse.json({
      question: {
        ...question,
        answers,
        user_vote: userVote,
        is_saved: isSaved,
      },
    });
  } catch (error) {
    console.error("qa/questions/[id] GET", error);
    return NextResponse.json({ error: "Failed to fetch question" }, { status: 500 });
  }
}

// ─── PATCH - update status / accept answer ───────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (isAuthFailure(auth)) return auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Question ID required" }, { status: 400 });
  }

  try {
    const db = adminDb();
    const qRef = db.collection("qa_questions").doc(id);
    const qDoc = await qRef.get();
    if (!qDoc.exists) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const data = qDoc.data()!;
    const userEmail = auth.email?.toLowerCase() ?? "";
    const isAdmin = !!userEmail && getAdminEmails().includes(userEmail);
    if (data.author_uid !== auth.uid && !isAdmin) {
      return NextResponse.json({ error: "Only the author or an admin can update this question" }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.status === "open" || body.status === "resolved") {
      updates.status = body.status;
    }

    if (typeof body.accepted_answer_id === "string") {
      // Verify the answer exists and belongs to this question
      const aDoc = await db.collection("qa_answers").doc(body.accepted_answer_id).get();
      if (!aDoc.exists || aDoc.data()?.question_id !== id) {
        return NextResponse.json({ error: "Invalid answer ID" }, { status: 400 });
      }

      // Un-accept previous answer if any
      if (data.accepted_answer_id && data.accepted_answer_id !== body.accepted_answer_id) {
        await db.collection("qa_answers").doc(data.accepted_answer_id).update({ is_accepted: false });
      }

      await db.collection("qa_answers").doc(body.accepted_answer_id).update({ is_accepted: true });
      updates.accepted_answer_id = body.accepted_answer_id;
      updates.status = "resolved";
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid updates" }, { status: 400 });
    }

    updates.last_activity_at = new Date().toISOString();
    await qRef.update(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("qa/questions/[id] PATCH", error);
    return NextResponse.json({ error: "Failed to update question" }, { status: 500 });
  }
}

// ─── DELETE - delete own question ────────────────────────────────────────────

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (isAuthFailure(auth)) return auth;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Question ID required" }, { status: 400 });
  }

  const rate = await enforceUserRateLimit(auth.uid, "qa-question-delete", 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }

  try {
    const db = adminDb();
    const qRef = db.collection("qa_questions").doc(id);
    const qDoc = await qRef.get();
    if (!qDoc.exists) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const userEmail = auth.email?.toLowerCase() ?? "";
    const isAdmin = !!userEmail && getAdminEmails().includes(userEmail);
    const isAuthor = qDoc.data()?.author_uid === auth.uid;

    if (!isAuthor && !isAdmin) {
      return NextResponse.json({ error: "Forbidden: can only delete your own questions or as an admin" }, { status: 403 });
    }

    // Delete answers, votes, and saved items for this question
    const batch = db.batch();
    batch.delete(qRef);

    const answerSnap = await db.collection("qa_answers").where("question_id", "==", id).limit(500).get();
    answerSnap.docs.forEach((d) => batch.delete(d.ref));

    // Clean up votes referencing this question
    const qVotes = await db.collection("qa_votes").where("target_type", "==", "question").where("target_id", "==", id).limit(500).get();
    qVotes.docs.forEach((d) => batch.delete(d.ref));

    // Clean up answer votes
    for (const aDoc of answerSnap.docs) {
      const aVotes = await db.collection("qa_votes").where("target_type", "==", "answer").where("target_id", "==", aDoc.id).limit(500).get();
      aVotes.docs.forEach((d) => batch.delete(d.ref));
    }

    // Clean up saved items
    const savedSnap = await db.collection("qa_saved").where("question_id", "==", id).limit(500).get();
    savedSnap.docs.forEach((d) => batch.delete(d.ref));

    await batch.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("qa/questions/[id] DELETE", error);
    return NextResponse.json({ error: "Failed to delete question" }, { status: 500 });
  }
}
