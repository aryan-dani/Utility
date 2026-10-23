import { eq, inArray } from "drizzle-orm";
import { getDb } from "../../db/client.js";
import {
  activityLogs,
  qaAnswers,
  qaQuestions,
  qaSaved,
  qaVotes,
  resourceUsage,
  visualizeTelemetry,
} from "../../db/schema.js";
import { adminAuth } from "../../lib/firebase.js";

/**
 * Nightly: remove Postgres rows whose Firebase Auth user no longer exists.
 * Samples distinct user ids from activity_logs (high-volume table).
 */
export async function runUsersReconcile(): Promise<void> {
  const db = getDb();
  const rows = await db
    .selectDistinct({ userId: activityLogs.userId })
    .from(activityLogs)
    .limit(2000);
  const auth = adminAuth();
  const gone: string[] = [];
  for (const { userId } of rows) {
    try {
      await auth.getUser(userId);
    } catch {
      gone.push(userId);
    }
  }
  for (const uid of gone) {
    await db.delete(activityLogs).where(eq(activityLogs.userId, uid));
    await db.delete(resourceUsage).where(eq(resourceUsage.userId, uid));
    await db.delete(visualizeTelemetry).where(eq(visualizeTelemetry.userId, uid));
    await db.delete(qaVotes).where(eq(qaVotes.userId, uid));
    await db.delete(qaSaved).where(eq(qaSaved.userId, uid));
    const owned = await db
      .select({ id: qaQuestions.id })
      .from(qaQuestions)
      .where(eq(qaQuestions.userId, uid));
    const qids = owned.map((q) => q.id);
    if (qids.length) {
      await db.delete(qaAnswers).where(inArray(qaAnswers.questionId, qids));
      await db.delete(qaQuestions).where(inArray(qaQuestions.id, qids));
    }
    await db.delete(qaAnswers).where(eq(qaAnswers.userId, uid));
  }
  console.log(`users.reconcile removed=${gone.length}`);
}
