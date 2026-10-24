import { getBoss, stopBoss } from "./boss.js";
import { runDriveSync, type DriveSyncPayload } from "./jobs/driveSync.js";
import { runCachePurge } from "./jobs/cachePurge.js";
import { runUsersReconcile } from "./jobs/usersReconcile.js";
import { closeDb } from "../db/client.js";

async function main() {
  const boss = await getBoss();

  // Full Drive mirrors can run for hours; default expireInSeconds is only 15m.
  await boss.createQueue("drive.sync");
  await boss.updateQueue("drive.sync", {
    name: "drive.sync",
    expireInSeconds: 6 * 60 * 60,
    retryLimit: 1,
  });
  await boss.createQueue("cache.purge");
  await boss.createQueue("users.reconcile");
  await boss.createQueue("catalog.publish");

  await boss.work<DriveSyncPayload>("drive.sync", async (jobs) => {
    for (const job of jobs) {
      await runDriveSync(job.data);
    }
  });

  await boss.work("cache.purge", async () => {
    await runCachePurge();
  });

  await boss.work("users.reconcile", async () => {
    await runUsersReconcile();
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
