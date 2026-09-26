import type { Firestore } from "firebase-admin/firestore";
import type { VoteValue } from "@/lib/qa/types";

const GETALL_CHUNK = 40;

async function getAllChunked(
  db: Firestore,
  refs: FirebaseFirestore.DocumentReference[],
): Promise<FirebaseFirestore.DocumentSnapshot[]> {
  const out: FirebaseFirestore.DocumentSnapshot[] = [];
  for (let i = 0; i < refs.length; i += GETALL_CHUNK) {
    const slice = refs.slice(i, i + GETALL_CHUNK);
    if (slice.length === 0) continue;
    out.push(...(await db.getAll(...slice)));
  }
  return out;
}

export async function attachQuestionViewerState<T extends { id: string }>(
  db: Firestore,
  uid: string,
  questions: T[],
): Promise<Array<T & { user_vote: VoteValue | null; is_saved: boolean }>> {
  if (questions.length === 0) {
    return [];
  }
  const voteRefs = questions.map((q) =>
    db.collection("qa_votes").doc(`${uid}_question_${q.id}`),
  );
  const saveRefs = questions.map((q) =>
    db.collection("qa_saved").doc(`${uid}_${q.id}`),
  );
  const snaps = await getAllChunked(db, [...voteRefs, ...saveRefs]);
  const votes = snaps.slice(0, questions.length);
  const saves = snaps.slice(questions.length);
  return questions.map((q, i) => ({
    ...q,
    user_vote: (votes[i]?.exists ? (votes[i].data()?.value as VoteValue) : null) ?? null,
    is_saved: Boolean(saves[i]?.exists),
  }));
}

export async function attachAnswerVotes<T extends { id: string }>(
  db: Firestore,
  uid: string,
  answers: T[],
): Promise<Array<T & { user_vote: VoteValue | null }>> {
  if (answers.length === 0) return [];
  const refs = answers.map((a) =>
    db.collection("qa_votes").doc(`${uid}_answer_${a.id}`),
  );
  const snaps = await getAllChunked(db, refs);
  return answers.map((a, i) => ({
    ...a,
    user_vote: (snaps[i]?.exists ? (snaps[i].data()?.value as VoteValue) : null) ?? null,
  }));
}
