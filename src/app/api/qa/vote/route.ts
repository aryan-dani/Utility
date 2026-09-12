import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { isAuthFailure, requireUser } from "@/lib/apiAuth";
import { enforceUserRateLimit } from "@/lib/rateLimit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const voteSchema = z.object({
  target_type: z.enum(["question", "answer"]),
  target_id: z.string().min(1).max(128),
  value: z.union([z.literal(1), z.literal(-1)]),
});

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (isAuthFailure(auth)) return auth;

  const rate = await enforceUserRateLimit(auth.uid, "qa-vote", 60, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }

  try {
    const body = await request.json();
    const parsed = voteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid vote payload" }, { status: 400 });
    }

    const { target_type, target_id, value } = parsed.data;

    // Questions only support upvotes (+1), not downvotes
    if (target_type === "question" && value === -1) {
      return NextResponse.json({ error: "Questions can only be upvoted" }, { status: 400 });
    }

    const db = adminDb();
    const collection = target_type === "question" ? "qa_questions" : "qa_answers";
    const targetRef = db.collection(collection).doc(target_id);
    const targetDoc = await targetRef.get();
    if (!targetDoc.exists) {
      return NextResponse.json({ error: `${target_type} not found` }, { status: 404 });
    }

    const voteId = `${auth.uid}_${target_type}_${target_id}`;
    const voteRef = db.collection("qa_votes").doc(voteId);
    const existingVote = await voteRef.get();

    await db.runTransaction(async (transaction) => {
      if (existingVote.exists) {
        const oldValue = existingVote.data()?.value as number;
        if (oldValue === value) {
          // Same vote - remove it (toggle off)
          transaction.delete(voteRef);
          if (target_type === "question") {
            transaction.update(targetRef, { upvotes: FieldValue.increment(-1) });
          } else {
            if (value === 1) {
              transaction.update(targetRef, { upvotes: FieldValue.increment(-1) });
            } else {
              transaction.update(targetRef, { downvotes: FieldValue.increment(-1) });
            }
          }
        } else {
          // Changed vote direction (answers only, question can only be +1)
          transaction.set(voteRef, {
            user_uid: auth.uid,
            target_type,
            target_id,
            value,
            created_at: FieldValue.serverTimestamp(),
          });
          if (target_type === "answer") {
            if (value === 1) {
              // Was -1, now +1
              transaction.update(targetRef, {
                upvotes: FieldValue.increment(1),
                downvotes: FieldValue.increment(-1),
              });
            } else {
              // Was +1, now -1
              transaction.update(targetRef, {
                upvotes: FieldValue.increment(-1),
                downvotes: FieldValue.increment(1),
              });
            }
          }
        }
      } else {
        // New vote
        transaction.set(voteRef, {
          user_uid: auth.uid,
          target_type,
          target_id,
          value,
          created_at: FieldValue.serverTimestamp(),
        });
        if (target_type === "question") {
          transaction.update(targetRef, { upvotes: FieldValue.increment(1) });
        } else {
          if (value === 1) {
            transaction.update(targetRef, { upvotes: FieldValue.increment(1) });
          } else {
            transaction.update(targetRef, { downvotes: FieldValue.increment(1) });
          }
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("qa/vote POST", error);
    return NextResponse.json({ error: "Failed to cast vote" }, { status: 500 });
  }
}
