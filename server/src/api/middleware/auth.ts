import { createMiddleware } from "hono/factory";
import { adminEmails } from "../../lib/env.js";
import { secretsEqual } from "../../lib/crypto.js";
import { env } from "../../lib/env.js";
import { verifyIdToken, type AuthedUser } from "../../lib/firebase.js";

export type AppVars = {
  Variables: {
    user: AuthedUser;
    clientIp: string;
  };
};

export function clientIp(c: {
  req: { header: (n: string) => string | undefined };
}): string {
  return (
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/** Require Firebase ID token for /v1/* browser routes. */
export const requireUser = createMiddleware<AppVars>(async (c, next) => {
  const auth = c.req.header("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const user = await verifyIdToken(auth.slice(7).trim());
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  c.set("user", user);
  c.set("clientIp", clientIp(c));
  await next();
});

export const requireAdmin = createMiddleware<AppVars>(async (c, next) => {
  const auth = c.req.header("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const user = await verifyIdToken(auth.slice(7).trim());
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const email = user.email?.toLowerCase();
  if (!email || !adminEmails().includes(email)) {
    return c.json({ error: "Forbidden" }, 403);
  }
  c.set("user", user);
  c.set("clientIp", clientIp(c));
  await next();
});

/** Shared secret for Vercel → server /internal/* calls. */
export const requireInternalKey = createMiddleware(async (c, next) => {
  const key = c.req.header("x-utility-key") || "";
  if (!secretsEqual(key, env().UTILITY_API_SECRET)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});
