import { cors } from "hono/cors";
import { corsOrigins } from "../../lib/env.js";

export function corsMiddleware() {
  const allowed = new Set(corsOrigins());
  if (process.env.NODE_ENV !== "production") {
    allowed.add("http://localhost:3000");
    allowed.add("http://127.0.0.1:3000");
  }
  return cors({
    origin: (origin) => (origin && allowed.has(origin) ? origin : null),
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type", "X-Utility-Key"],
    exposeHeaders: ["Retry-After"],
    maxAge: 600,
  });
}
