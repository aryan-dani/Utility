import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { env } from "../lib/env.js";
import * as schema from "./schema.js";

const { Pool } = pg;

let pool: pg.Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: env().DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30_000,
      statement_timeout: 5_000,
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
