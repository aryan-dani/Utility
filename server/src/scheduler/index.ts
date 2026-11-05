import { getBoss, stopBoss } from "../worker/boss.js";
import { closeDb } from "../db/client.js";

/**
 * Schedules (Asia/Kolkata via container TZ):
 * - incremental Drive sync every 15 minutes
 * - full reconcile Sunday 03:00
 * - semantic cache purge daily 04:00
 * - users.reconcile nightly 04:30
 */
async function main() {
  const boss = await getBoss();

  await boss.createQueue("drive.sync");
  await boss.updateQueue("drive.sync", {
    expireInSeconds: 6 * 60 * 60,
    retryLimit: 1,
  });
  await boss.createQueue("cache.purge");
  await boss.createQueue("users.reconcile");
  await boss.createQueue("study.pack");
  await boss.createQueue("rag.eval");

  // Same queue name with an empty key overwrites the previous row. Keep both crons.
  await boss.unschedule("drive.sync");
  await boss.schedule(
    "drive.sync",
    "*/15 * * * *",
    { mode: "incremental" },
    {
      key: "incremental",
      tz: "Asia/Kolkata",
      expireInSeconds: 2 * 60 * 60,
    },
  );

  await boss.schedule(
    "drive.sync",
    "0 3 * * 0",
    { mode: "full" },
    {
      key: "full",
      tz: "Asia/Kolkata",
      expireInSeconds: 6 * 60 * 60,
    },
  );

  await boss.schedule("cache.purge", "0 4 * * *", {}, { tz: "Asia/Kolkata" });
  await boss.schedule(
    "users.reconcile",
    "30 4 * * *",
    {},
    { tz: "Asia/Kolkata" },
  );
  await boss.schedule("rag.eval", "15 4 * * *", {}, { tz: "Asia/Kolkata" });
  await boss.schedule("study.pack", "45 4 * * *", {}, { tz: "Asia/Kolkata" });

  console.log("utility-scheduler schedules registered");

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
