import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getPool, closeDb } from "./client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const dir = join(__dirname, "migrations");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const id = file;
    const { rows } = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE id = $1",
      [id],
    );
    if (rows.length > 0) {
      console.log(`skip ${id}`);
      continue;
    }
    const sql = readFileSync(join(dir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [id]);
      await client.query("COMMIT");
      console.log(`applied ${id}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
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
