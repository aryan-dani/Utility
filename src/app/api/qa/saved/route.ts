import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { isAuthFailure, requireUser } from "@/lib/apiAuth";
import type { QAQuestion } from "@/lib/qa/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (isAuthFailure(auth)) return auth;

  try {
    const db = adminDb();
    const savedSnap = await db
      .collection("qa_saved")
      .where("user_uid", "==", auth.uid)
      .limit(200)
      .get();

    if (savedSnap.empty) {
      return NextResponse.json({ questions: [] });
    }

    const questionIds = savedSnap.docs.map((d) => d.data().question_id as string);

    // Firestore 'in' supports up to 30 items
    const chunkSize = 30;
    const questions: QAQuestion[] = [];
    for (let i = 0; i < questionIds.length; i += chunkSize) {
      const chunk = questionIds.slice(i, i + chunkSize);
      const qSnap = await db
        .collection("qa_questions")
        .where("__name__", "in", chunk)
        .get();
      qSnap.docs.forEach((doc) => {
        questions.push({ id: doc.id, ...doc.data() } as QAQuestion);
      });
    }

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("qa/saved GET", error);
    return NextResponse.json({ error: "Failed to fetch saved questions" }, { status: 500 });
  }
}
