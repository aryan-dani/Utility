import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { isAuthFailure, requireUser } from "@/lib/apiAuth";
import { enforceUserRateLimit } from "@/lib/rateLimit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const saveSchema = z.object({
  question_id: z.string().min(1).max(128),
});

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (isAuthFailure(auth)) return auth;

  const rate = await enforceUserRateLimit(auth.uid, "qa-save", 30, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }

  try {
    const body = await request.json();
    const parsed = saveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { question_id } = parsed.data;

    const db = adminDb();

    // Verify the question exists
    const qDoc = await db.collection("qa_questions").doc(question_id).get();
    if (!qDoc.exists) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const docId = `${auth.uid}_${question_id}`;
    const ref = db.collection("qa_saved").doc(docId);
    const existing = await ref.get();

    if (existing.exists) {
      // Toggle off — unsave
      await ref.delete();
      return NextResponse.json({ success: true, saved: false });
    } else {
      // Save
      await ref.set({
        user_uid: auth.uid,
        question_id,
        created_at: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, saved: true });
    }
  } catch (error) {
    console.error("qa/save POST", error);
    return NextResponse.json({ error: "Failed to toggle bookmark" }, { status: 500 });
  }
}
