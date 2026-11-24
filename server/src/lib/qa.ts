import { eq, inArray, and } from "drizzle-orm";
import type { getDb } from "../db/client.js";
import { qaAnswers, qaQuestions, qaSaved, qaVotes, userProfiles } from "../db/schema.js";

type Db = ReturnType<typeof getDb>;

export const QUESTION_BODY_MAX = 5000;
export const ANSWER_BODY_MAX = 5000;
export const ATTACHMENT_MAX = 4;

export type VoteValue = 1 | -1;

export type QuestionRow = typeof qaQuestions.$inferSelect;
export type AnswerRow = typeof qaAnswers.$inferSelect;

const iso = (d: Date) => d.toISOString();

/** Firestore-shaped question, matching `QAQuestion` in the web client. */
export function questionDto(
  row: QuestionRow,
  viewer?: { userVote: VoteValue | null; isSaved: boolean },
) {
  return {
    id: row.id,
    academic_year: row.academicYear,
    branch: row.branch,
    semester: row.semester,
    subject_name: row.subjectName ?? "",
    resource_id: row.resourceId ?? undefined,
    resource_title: row.resourceTitle ?? undefined,
    resource_url: row.resourceUrl ?? undefined,
    topic_unit: row.topicUnit ?? undefined,
    category: (row.category === "general" ? "general" : "doubt") as "doubt" | "general",
    author_uid: row.userId,
    author_name: row.authorName || "Student",
    author_photo_url: row.authorPhotoUrl ?? null,
    body: row.body,
    attachments: row.attachments ?? [],
    status: (row.status === "resolved" ? "resolved" : "open") as "open" | "resolved",
    upvotes: row.upvotes,
    answer_count: row.answerCount,
    accepted_answer_id: row.acceptedAnswerId ?? undefined,
    ai_auto_answered: row.aiAutoAnswered,
    ai_answer: row.aiAnswer ?? undefined,
    needs_human: row.needsHuman,
    created_at: iso(row.createdAt),
    last_activity_at: iso(row.lastActivityAt),
    ...(viewer ? { user_vote: viewer.userVote, is_saved: viewer.isSaved } : {}),
  };
}

/** Firestore-shaped answer, matching `QAAnswer` in the web client. */
export function answerDto(row: AnswerRow, userVote?: VoteValue | null) {
  return {
    id: row.id,
    question_id: row.questionId,
    author_uid: row.userId,
    author_name: row.authorName || "Student",
    author_photo_url: row.authorPhotoUrl ?? null,
    body: row.body,
    attachments: row.attachments ?? [],
    upvotes: row.upvotes,
    downvotes: row.downvotes,
    is_accepted: row.isAccepted,
    created_at: iso(row.createdAt),
    ...(userVote !== undefined ? { user_vote: userVote } : {}),
  };
}

/**
 * Vote semantics copied from the Firestore route: pressing the same direction again
 * removes the vote, switching direction replaces it, and questions only take +1.
 * Returns the stored value (null = delete) and the counter deltas to apply.
 */
export function voteTransition(
  previous: VoteValue | null,
  next: VoteValue,
): { set: VoteValue | null; up: number; down: number } {
  if (previous === next) {
    return { set: null, up: next === 1 ? -1 : 0, down: next === -1 ? -1 : 0 };
  }
  if (previous === null) {
    return { set: next, up: next === 1 ? 1 : 0, down: next === -1 ? 1 : 0 };
  }
  // Direction flip (answers only; questions cannot receive -1).
  return { set: next, up: next === 1 ? 1 : -1, down: next === 1 ? -1 : 1 };
}

/** Display name and photo for a signed-in user: home profile mirror, then token email. */
export async function resolveAuthor(
  db: Db,
  uid: string,
  email?: string | null,
): Promise<{ name: string | null; photoUrl: string | null }> {
  const [profile] = await db
    .select({ displayName: userProfiles.displayName, photoUrl: userProfiles.photoUrl })
    .from(userProfiles)
    .where(eq(userProfiles.uid, uid))
    .limit(1);
  const name = profile?.displayName?.trim().slice(0, 80) || email?.split("@")[0]?.slice(0, 80) || null;
  const photo = profile?.photoUrl?.trim();
  const photoUrl = photo && (photo.startsWith("https://") || photo.startsWith("http://") || photo.startsWith("data:image/"))
    ? photo.slice(0, 2000)
    : null;
  return { name, photoUrl };
}

/** Per-question viewer state (the caller's vote and bookmark) for a page of questions. */
export async function questionViewerState(db: Db, uid: string, ids: string[]) {
  const votes = new Map<string, VoteValue | null>();
  const saved = new Set<string>();
  if (ids.length === 0) return { votes, saved };
  const [voteRows, savedRows] = await Promise.all([
    db
      .select({ targetId: qaVotes.targetId, value: qaVotes.value })
      .from(qaVotes)
      .where(and(eq(qaVotes.userId, uid), eq(qaVotes.targetType, "question"), inArray(qaVotes.targetId, ids))),
    db
      .select({ questionId: qaSaved.questionId })
      .from(qaSaved)
      .where(and(eq(qaSaved.userId, uid), inArray(qaSaved.questionId, ids))),
  ]);
  for (const v of voteRows) votes.set(v.targetId, v.value as VoteValue);
  for (const s of savedRows) saved.add(s.questionId);
  return { votes, saved };
}

/** The caller's vote for each answer id. */
export async function answerViewerVotes(db: Db, uid: string, ids: string[]) {
  const votes = new Map<string, VoteValue>();
  if (ids.length === 0) return votes;
  const rows = await db
    .select({ targetId: qaVotes.targetId, value: qaVotes.value })
    .from(qaVotes)
    .where(and(eq(qaVotes.userId, uid), eq(qaVotes.targetType, "answer"), inArray(qaVotes.targetId, ids)));
  for (const r of rows) votes.set(r.targetId, r.value as VoteValue);
  return votes;
}
