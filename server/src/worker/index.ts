import type { Job } from "pg-boss";
import { getBoss, stopBoss } from "./boss.js";
import { runDriveSync, type DriveSyncPayload } from "./jobs/driveSync.js";
import { runCachePurge } from "./jobs/cachePurge.js";
import { runUsersReconcile } from "./jobs/usersReconcile.js";
import { runStudyPack } from "./jobs/studyPack.js";
import { runRagEval } from "./jobs/ragEval.js";
import { closeDb } from "../db/client.js";

async function main() {
  const boss = await getBoss();

  // Full Drive mirrors can run for hours; default expireInSeconds is only 15m.
  await boss.createQueue("drive.sync");
  await boss.updateQueue("drive.sync", {
    expireInSeconds: 6 * 60 * 60,
    retryLimit: 1,
  });
  await boss.createQueue("cache.purge");
  await boss.createQueue("users.reconcile");
  await boss.createQueue("catalog.publish");
  await boss.createQueue("study.pack");
  await boss.createQueue("rag.eval");

  await boss.work("drive.sync", async (jobs: Job<DriveSyncPayload>[]) => {
    for (const job of jobs) {
      await runDriveSync(job.data);
    }
  });

  await boss.work("cache.purge", async (_jobs: Job[]) => {
    await runCachePurge();
  });

  await boss.work("users.reconcile", async (_jobs: Job[]) => {
    await runUsersReconcile();
  });

  await boss.work("study.pack", async (_jobs: Job[]) => {
    await runStudyPack();
  });

  await boss.work("rag.eval", async (_jobs: Job[]) => {
    await runRagEval();
  });

  console.log("utility-worker listening");

  const shutdown = async () => {
    await stopBoss();
    await closeDb();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
