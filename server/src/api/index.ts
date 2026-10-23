import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { corsMiddleware } from "./middleware/cors.js";
import { healthRoutes } from "./routes/health.js";
import { v1Routes } from "./routes/v1.js";
import { internalRoutes } from "./routes/internal.js";
import { env } from "../lib/env.js";

const app = new Hono();

app.use("*", corsMiddleware());
app.use(
  "*",
  bodyLimit({
    maxSize: 64 * 1024,
    onError: (c) => c.json({ error: "Payload too large" }, 413),
  }),
);

app.route("/", healthRoutes);
app.route("/v1", v1Routes);
app.route("/internal", internalRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal error" }, 500);
});

const port = env().PORT;
// Bind all interfaces inside the container. Host isolation still comes from
// compose publishing only 127.0.0.1:18100:18100 — not from this hostname.
console.log(`utility-api listening on 0.0.0.0:${port}`);
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" });
