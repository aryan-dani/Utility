import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { isAuthFailure, requireUser } from "@/lib/apiAuth";
import { enforceUserRateLimit } from "@/lib/rateLimit";
import { z } from "zod";
import type { QAQuestion } from "@/lib/qa/types";
import { QUESTION_BODY_MAX, ATTACHMENT_MAX } from "@/lib/qa/types";

export const dynamic = "force-dynamic";

// ─── GET - list questions for a board ────────────────────────────────────────

const listSchema = z.object({
  academic_year: z.string().max(16),
  branch: z.string().max(16),
  semester: z.coerce.number().int().min(1).max(8),
  subject_name: z.string().max(120).optional(),
  resource_id: z.string().max(128).optional(),
  category: z.enum(["doubt", "general"]).optional(),
  status: z.enum(["open", "resolved"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = listSchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query params" }, { status: 400 });
  }

  const { academic_year, branch, semester, subject_name, resource_id, category, status, limit = 50 } = parsed.data;

  try {
    const db = adminDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ref: any = db.collection("qa_questions")
      .where("academic_year", "==", academic_year)
      .where("branch", "==", branch)
      .where("semester", "==", semester);

    if (subject_name) {
      ref = ref.where("subject_name", "==", subject_name);
    }
    if (resource_id) {
      ref = ref.where("resource_id", "==", resource_id);
    }
    if (category) {
      ref = ref.where("category", "==", category);
    }
    if (status) {
      ref = ref.where("status", "==", status);
    }

    let snap: FirebaseFirestore.QuerySnapshot;
    try {
      snap = await ref.orderBy("created_at", "desc").limit(limit).get();
    } catch {
      // Fallback if index is building or composite filter combination is unindexed
      snap = await ref.limit(limit).get();
    }

    const questions: QAQuestion[] = snap.docs.map(
      (doc: FirebaseFirestore.QueryDocumentSnapshot) => ({
        id: doc.id,
        ...doc.data(),
      } as QAQuestion),
    );

    // Ensure sorted by created_at descending
    questions.sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
    );

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("qa/questions GET", error);
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 });
  }
}

// ─── POST - create a new question ───────────────────────────────────────────

const createSchema = z.object({
  academic_year: z.string().max(16),
  branch: z.string().max(16),
  semester: z.coerce.number().int().min(1).max(8),
  subject_name: z.string().min(1).max(120),
  resource_id: z.string().max(128).optional(),
  resource_title: z.string().max(200).optional(),
  resource_url: z.string().max(1000).optional(),
  topic_unit: z.string().max(80).optional(),
  category: z.enum(["doubt", "general"]),
  body: z.string().min(1).max(QUESTION_BODY_MAX),
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

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (isAuthFailure(auth)) return auth;

  const rate = await enforceUserRateLimit(auth.uid, "qa-question-create", 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid question payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const data = parsed.data;
    const authorName =
      data.author_name?.trim() ||
      auth.email?.split("@")[0] ||
      "Anonymous Scholar";

    const now = new Date().toISOString();

    const db = adminDb();
    const docData = {
      academic_year: data.academic_year,
      branch: data.branch,
      semester: data.semester,
      subject_name: data.subject_name,
      resource_id: data.resource_id || null,
      resource_title: data.resource_title || null,
      resource_url: data.resource_url || null,
      topic_unit: data.topic_unit || null,
      category: data.category,
      author_uid: auth.uid,
      author_name: authorName.slice(0, 80),
      body: data.body.slice(0, QUESTION_BODY_MAX),
      attachments: data.attachments || [],
      status: "open" as const,
      upvotes: 0,
      answer_count: 0,
      accepted_answer_id: null,
      ai_auto_answered: false,
      ai_answer: null,
      needs_human: false,
      created_at: now,
      last_activity_at: now,
    };

    const ref = await db.collection("qa_questions").add(docData);

    return NextResponse.json({ success: true, id: ref.id });
  } catch (error) {
    console.error("qa/questions POST", error);
    return NextResponse.json({ error: "Failed to create question" }, { status: 500 });
  }
}
