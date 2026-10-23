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
  await boss.createQueue("cache.purge");
  await boss.createQueue("users.reconcile");

  await boss.schedule(
    "drive.sync",
    "*/15 * * * *",
    { mode: "incremental" },
    { tz: "Asia/Kolkata" },
  );

  // Separate cron string for full reconcile (pg-boss ScheduleOptions has no `key`)
  await boss.schedule(
    "drive.sync",
    "0 3 * * 0",
    { mode: "full" },
    { tz: "Asia/Kolkata" },
  );

  await boss.schedule("cache.purge", "0 4 * * *", {}, { tz: "Asia/Kolkata" });
  await boss.schedule(
    "users.reconcile",
    "30 4 * * *",
    {},
    { tz: "Asia/Kolkata" },
  );

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
