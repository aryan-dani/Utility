import { Hono } from "hono";
import { getPool } from "../../db/client.js";
import { env } from "../../lib/env.js";
import { healthMeta } from "../../db/schema.js";
import { getDb } from "../../db/client.js";
import { eq } from "drizzle-orm";
import { access, statfs } from "node:fs/promises";

export const healthRoutes = new Hono();

healthRoutes.get("/health", (c) =>
  c.json({ ok: true, service: "utility-api", ts: new Date().toISOString() }),
);

healthRoutes.get("/health/ready", async (c) => {
  const checks: Record<string, unknown> = {};
  let ready = true;

  try {
    await getPool().query("SELECT 1");
    checks.db = "ok";
  } catch (err) {
    ready = false;
    checks.db = err instanceof Error ? err.message : "fail";
  }

  try {
    const fs = await statfs(env().FILES_ROOT);
    const freeRatio = Number(fs.bfree) / Number(fs.blocks);
    checks.diskFreeRatio = Math.round(freeRatio * 1000) / 1000;
    if (freeRatio < 0.1) {
      ready = false;
      checks.disk = "low";
    } else {
      checks.disk = "ok";
    }
  } catch {
    // FILES_ROOT may not exist in local unit tests
    checks.disk = "skip";
  }

  try {
    const rows = await getDb()
      .select()
      .from(healthMeta)
      .where(eq(healthMeta.key, "last_sync_at"))
      .limit(1);
    const last = rows[0]?.value;
    checks.lastSyncAt = last ?? null;
    if (last) {
      const ageMs = Date.now() - Date.parse(last);
      if (Number.isFinite(ageMs) && ageMs > 2 * 60 * 60 * 1000) {
        ready = false;
        checks.sync = "stale";
      } else {
        checks.sync = "ok";
      }
    } else {
      checks.sync = "never";
    }
  } catch {
    checks.sync = "unknown";
  }

  try {
    const url = `${env().GOTENBERG_URL}/health`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    checks.gotenberg = res.ok ? "ok" : `http_${res.status}`;
    if (!res.ok) ready = false;
  } catch {
    checks.gotenberg = "unreachable";
    // Gotenberg optional for readiness of API-only features
  }

  try {
    await access(env().FILES_ROOT);
    checks.filesRoot = "ok";
  } catch {
    checks.filesRoot = "missing";
  }

  return c.json({ ready, checks }, ready ? 200 : 503);
});
