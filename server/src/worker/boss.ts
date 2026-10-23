import PgBoss from "pg-boss";
import { env } from "../lib/env.js";

let boss: PgBoss | null = null;

export async function getBoss(): Promise<PgBoss> {
  if (boss) return boss;
  boss = new PgBoss({
    connectionString: env().DATABASE_URL,
    application_name: "utility-worker",
  });
  boss.on("error", (err) => console.error("pg-boss error", err));
  await boss.start();
  return boss;
}

export async function stopBoss(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: true, timeout: 10_000 });
    boss = null;
  }
}
