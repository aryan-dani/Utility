import { Hono } from "hono";
import { getDb } from "../../db/client.js";
import { computeAdminStats, listAdminUsers } from "../../lib/adminStats.js";
import { requireAdmin, type AppVars } from "../middleware/auth.js";

/** Admin-only views computed on the home server from Postgres. Mounted at /v1/admin. */
export const adminRoutes = new Hono<AppVars>();

adminRoutes.use("*", requireAdmin);

adminRoutes.get("/stats", async (c) => {
  const stats = await computeAdminStats(getDb());
  return c.json(stats, 200, { "Cache-Control": "private, no-store" });
});

adminRoutes.get("/users", async (c) => {
  const users = await listAdminUsers(getDb());
  return c.json({ users }, 200, { "Cache-Control": "private, no-store" });
});
