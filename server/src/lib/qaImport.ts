import { eq } from "drizzle-orm";
import type { getDb } from "../db/client.js";
import { migrateCheckpoint, qaAnswers, qaQuestions, qaSaved, qaVotes } from "../db/schema.js";
import { adminFirestore } from "./firebase.js";
import { int, stringArray, text, toDate } from "./firestoreValues.js";

type Db = ReturnType<typeof getDb>;

const QA_IMPORT_KEY = "qa_v1";

export type QaImportResult = {
  alreadyRun: boolean;
  questions: number;
  answers: number;
  votes: number;
  saved: number;
};

/**
 * One-time: copies the Firestore Q&A board (questions, answers, votes, bookmarks) into
 * Postgres. Existing rows are never overwritten. Guarded by a checkpoint and one transaction.
 */
export async function importQa(db: Db): Promise<QaImportResult> {
  const [done] = await db
    .select({ done: migrateCheckpoint.done })
    .from(migrateCheckpoint)
    .where(eq(migrateCheckpoint.collection, QA_IMPORT_KEY))
    .limit(1);
  if (done?.done) {
    return { alreadyRun: true, questions: 0, answers: 0, votes: 0, saved: 0 };
  }

  const fs = adminFirestore();
  const [qSnap, aSnap, vSnap, sSnap] = await Promise.all([
    fs.collection("qa_questions").get(),
    fs.collection("qa_answers").get(),
    fs.collection("qa_votes").get(),
    fs.collection("qa_saved").get(),
  ]);

  const now = new Date();
  const questionRows = qSnap.docs.flatMap((doc) => {
    const d = doc.data();
    const userId = text(d.author_uid, 128);
    const academicYear = text(d.academic_year, 16);
    const branch = text(d.branch, 32);
    const semester = int(d.semester, 0);
    if (!userId || !academicYear || !branch || semester < 1 || semester > 8) return [];
    const body = typeof d.body === "string" ? d.body.slice(0, 8000) : "";
    const createdAt = toDate(d.created_at) ?? now;
    return [
      {
        id: doc.id,
        userId,
        authorName: text(d.author_name, 80),
        authorPhotoUrl: text(d.author_photo_url, 2048),
        academicYear,
        branch,
        semester,
        subjectName: text(d.subject_name, 120),
        resourceId: text(d.resource_id, 128),
        resourceTitle: text(d.resource_title, 200),
        resourceUrl: text(d.resource_url, 1000),
        topicUnit: text(d.topic_unit, 80),
        category: d.category === "general" ? "general" : "doubt",
        title: body.slice(0, 80) || "Question",
        body,
        attachments: stringArray(d.attachments, 4),
        status: d.status === "resolved" ? "resolved" : "open",
        acceptedAnswerId: text(d.accepted_answer_id, 128),
        aiAutoAnswered: d.ai_auto_answered === true,
        aiAnswer: text(d.ai_answer, 8000),
        needsHuman: d.needs_human === true,
        upvotes: Math.max(0, int(d.upvotes, 0)),
        downvotes: 0,
        answerCount: Math.max(0, int(d.answer_count, 0)),
        createdAt,
        lastActivityAt: toDate(d.last_activity_at) ?? createdAt,
        updatedAt: now,
      },
    ];
  });
  const questionIds = new Set(questionRows.map((q) => q.id));

  const answerRows = aSnap.docs.flatMap((doc) => {
    const d = doc.data();
    const questionId = text(d.question_id, 128);
    const userId = text(d.author_uid, 128);
    if (!questionId || !userId || !questionIds.has(questionId)) return [];
    return [
      {
        id: doc.id,
        questionId,
        userId,
        authorName: text(d.author_name, 80),
        authorPhotoUrl: text(d.author_photo_url, 2048),
        body: typeof d.body === "string" ? d.body.slice(0, 8000) : "",
        attachments: stringArray(d.attachments, 4),
        isAccepted: d.is_accepted === true,
        upvotes: Math.max(0, int(d.upvotes, 0)),
        downvotes: Math.max(0, int(d.downvotes, 0)),
        createdAt: toDate(d.created_at) ?? now,
        updatedAt: now,
      },
    ];
  });
  const answerIds = new Set(answerRows.map((a) => a.id));

  const voteRows = vSnap.docs.flatMap((doc) => {
    const d = doc.data();
    const userId = text(d.user_uid, 128);
    const targetId = text(d.target_id, 128);
    if (!userId || !targetId) return [];
    const targetType = d.target_type === "question" ? "question" : "answer";
    const known = targetType === "question" ? questionIds.has(targetId) : answerIds.has(targetId);
    if (!known) return [];
    return [
      {
        id: doc.id,
        userId,
        targetType,
        targetId,
        value: d.value === -1 ? -1 : 1,
      },
    ];
  });

  const savedRows = sSnap.docs.flatMap((doc) => {
    const d = doc.data();
    const userId = text(d.user_uid, 128);
    const questionId = text(d.question_id, 128);
    if (!userId || !questionId || !questionIds.has(questionId)) return [];
    return [{ id: doc.id, userId, questionId, createdAt: toDate(d.created_at) ?? now }];
  });

  await db.transaction(async (tx) => {
    for (const row of questionRows) {
      await tx.insert(qaQuestions).values(row).onConflictDoNothing();
    }
    for (const row of answerRows) {
      await tx.insert(qaAnswers).values(row).onConflictDoNothing();
    }
    for (const row of voteRows) {
      await tx.insert(qaVotes).values(row).onConflictDoNothing();
    }
    for (const row of savedRows) {
      await tx.insert(qaSaved).values(row).onConflictDoNothing();
    }
    await tx
      .insert(migrateCheckpoint)
      .values({ collection: QA_IMPORT_KEY, done: true, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: migrateCheckpoint.collection,
        set: { done: true, updatedAt: new Date() },
      });
  });

  return {
    alreadyRun: false,
    questions: questionRows.length,
    answers: answerRows.length,
    votes: voteRows.length,
    saved: savedRows.length,
  };
}
