/**
 * Resumable Firestore → Postgres export.
 * Cap: 25k reads/day. Checkpoint in migrate_checkpoint.
 *
 * Usage: npx tsx src/migrate/firestore-export.ts [collection]
 * Collections: qa_questions | qa_answers | qa_votes | qa_saved | activity_logs | resource_usage
 */
import { eq } from "drizzle-orm";
import { getDb, closeDb } from "../db/client.js";
import { migrateCheckpoint, activityLogs, qaQuestions, qaAnswers, qaVotes, qaSaved, resourceUsage } from "../db/schema.js";
import { adminDb } from "../lib/firebase.js";

const DAILY_CAP = 25_000;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function bumpReads(collection: string, n: number): Promise<boolean> {
  const db = getDb();
  const day = todayKey();
  const rows = await db
    .select()
    .from(migrateCheckpoint)
    .where(eq(migrateCheckpoint.collection, collection))
    .limit(1);
  let reads = 0;
  if (rows[0]?.readsDay === day) reads = rows[0].readsToday;
  if (reads + n > DAILY_CAP) return false;
  await db
    .insert(migrateCheckpoint)
    .values({
      collection,
      readsToday: reads + n,
      readsDay: day,
      done: false,
    })
    .onConflictDoUpdate({
      target: migrateCheckpoint.collection,
      set: {
        readsToday: reads + n,
        readsDay: day,
        updatedAt: new Date(),
      },
    });
  return true;
}

async function markDone(collection: string, cursor: string | null) {
  await getDb()
    .insert(migrateCheckpoint)
    .values({
      collection,
      cursor,
      done: true,
      readsToday: 0,
      readsDay: todayKey(),
    })
    .onConflictDoUpdate({
      target: migrateCheckpoint.collection,
      set: { done: true, cursor, updatedAt: new Date() },
    });
}

async function exportCollection(name: string): Promise<void> {
  const firestore = adminDb();
  const db = getDb();
  const cp = await db
    .select()
    .from(migrateCheckpoint)
    .where(eq(migrateCheckpoint.collection, name))
    .limit(1);
  if (cp[0]?.done) {
    console.log(`${name}: already done`);
    return;
  }

  let query = firestore.collection(name).orderBy("__name__").limit(200);
  if (cp[0]?.cursor) {
    const start = await firestore.collection(name).doc(cp[0].cursor).get();
    if (start.exists) query = query.startAfter(start);
  }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (!(await bumpReads(name, 200))) {
      console.log(`${name}: daily read cap reached`);
      return;
    }
    const snap = await query.get();
    if (snap.empty) {
      await markDone(name, null);
      console.log(`${name}: complete`);
      return;
    }
    for (const doc of snap.docs) {
      const d = doc.data();
      if (name === "activity_logs") {
        await db
          .insert(activityLogs)
          .values({
            id: doc.id,
            userId: String(d.user_id || d.userId || ""),
            actionType: String(d.action_type || d.actionType || "unknown"),
            loggedDate: String(d.logged_date || d.loggedDate || ""),
            count: Number(d.count || 1),
            meta: d.meta ?? null,
          })
          .onConflictDoNothing();
      } else if (name === "qa_questions") {
        await db
          .insert(qaQuestions)
          .values({
            id: doc.id,
            userId: String(d.user_uid || d.user_id || d.userId || ""),
            authorName: d.author_name ?? null,
            academicYear: String(d.academic_year || ""),
            branch: String(d.branch || ""),
            semester: Number(d.semester || 0),
            subjectName: d.subject_name ?? null,
            title: String(d.title || ""),
            body: String(d.body || ""),
            upvotes: Number(d.upvotes || 0),
            downvotes: Number(d.downvotes || 0),
            answerCount: Number(d.answer_count || 0),
          })
          .onConflictDoNothing();
      } else if (name === "qa_answers") {
        await db
          .insert(qaAnswers)
          .values({
            id: doc.id,
            questionId: String(d.question_id || ""),
            userId: String(d.user_uid || d.user_id || ""),
            authorName: d.author_name ?? null,
            body: String(d.body || ""),
            upvotes: Number(d.upvotes || 0),
            downvotes: Number(d.downvotes || 0),
          })
          .onConflictDoNothing();
      } else if (name === "qa_votes") {
        await db
          .insert(qaVotes)
          .values({
            id: doc.id,
            userId: String(d.user_uid || d.user_id || ""),
            targetType: String(d.target_type || "question"),
            targetId: String(d.target_id || ""),
            value: Number(d.value || 0),
          })
          .onConflictDoNothing();
      } else if (name === "qa_saved") {
        await db
          .insert(qaSaved)
          .values({
            id: doc.id,
            userId: String(d.user_uid || d.user_id || ""),
            questionId: String(d.question_id || ""),
          })
          .onConflictDoNothing();
      } else if (name === "resource_usage") {
        await db
          .insert(resourceUsage)
          .values({
            userId: String(d.user_id || ""),
            resourceId: String(d.resource_id || doc.id),
            count: Number(d.count || 0),
          })
          .onConflictDoNothing();
      }
    }
    const last = snap.docs[snap.docs.length - 1];
    await db
      .insert(migrateCheckpoint)
      .values({
        collection: name,
        cursor: last.id,
        readsToday: 0,
        readsDay: todayKey(),
        done: false,
      })
      .onConflictDoUpdate({
        target: migrateCheckpoint.collection,
        set: { cursor: last.id, updatedAt: new Date() },
      });
    query = firestore
      .collection(name)
      .orderBy("__name__")
      .startAfter(last)
      .limit(200);
  }
}

const target = process.argv[2];
const all = [
  "qa_questions",
  "qa_answers",
  "qa_votes",
  "qa_saved",
  "activity_logs",
  "resource_usage",
];

async function main() {
  const list = target ? [target] : all;
  for (const c of list) {
    await exportCollection(c);
  }
}

main()
  .then(() => closeDb())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(err);
    await closeDb();
    process.exit(1);
  });
