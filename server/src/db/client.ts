import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../lib/env.js";
import * as schema from "./schema.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getPool(statementTimeoutMs?: number): pg.Pool {
  if (!pool) {
    const raw = process.env.PG_STATEMENT_TIMEOUT_MS;
    const parsed = raw !== undefined ? Number(raw) : NaN;
    const timeout =
      statementTimeoutMs !== undefined
        ? statementTimeoutMs
        : Number.isFinite(parsed) && parsed >= 0
          ? parsed
          : 5_000;
    pool = new Pool({
      connectionString: env().DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30_000,
      ...(timeout > 0 ? { statement_timeout: timeout } : {}),
    });
  }
  return pool;
}

export function getDb() {
  if (!db) {
    db = drizzle(getPool(), { schema });
  }
  return db;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
}
