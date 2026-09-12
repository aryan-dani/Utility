import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "../../..");
const API_DIR = join(ROOT, "src/app/api");

const FORBIDDEN_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  {
    re: /alt\s*:\s*["']media["']/,
    reason: 'Drive alt: "media" streams file bytes through a Vercel Function',
  },
  {
    re: /responseType\s*:\s*["']stream["']/,
    reason: "Streaming binary responses through API routes burns Fast Origin Transfer",
  },
  {
    re: /responseType\s*:\s*["']arraybuffer["']/,
    reason: "Buffering binary responses through API routes burns Fast Origin Transfer",
  },
  {
    re: /Readable\.toWeb/,
    reason: "Node-to-Web stream conversion usually means proxying file bytes",
  },
  {
    re: /application\/pdf/,
    reason: "Serving application/pdf from an API route proxies file bytes",
  },
  {
    re: /drive\.usercontent\.google\.com/,
    reason:
      "Server-side Drive usercontent fetches must not live in API routes; browsers fetch Drive directly",
  },
];

function walkRouteFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkRouteFiles(full));
    } else if (entry === "route.ts" || entry === "route.js") {
      out.push(full);
    }
  }
  return out;
}

describe("bandwidth policy: no file-byte proxying", () => {
  it("does not introduce middleware or proxy that would double origin transfer", () => {
    expect(
      existsSync(join(ROOT, "src/middleware.ts")),
      "Do not add src/middleware.ts: it can double Fast Origin Transfer. See .cursor/rules/bandwidth-policy.mdc",
    ).toBe(false);
    expect(
      existsSync(join(ROOT, "src/proxy.ts")),
      "Do not add src/proxy.ts without a narrow matcher. See .cursor/rules/bandwidth-policy.mdc",
    ).toBe(false);
  });

  it("API routes never stream Drive / binary file bytes", () => {
    const routes = walkRouteFiles(API_DIR);
    const violations: string[] = [];

    for (const file of routes) {
      const source = readFileSync(file, "utf8");
      const rel = relative(ROOT, file).replace(/\\/g, "/");
      for (const { re, reason } of FORBIDDEN_PATTERNS) {
        if (re.test(source)) {
          violations.push(`${rel}: ${reason} (matched ${re})`);
        }
      }
    }

    expect(
      violations,
      [
        "File bytes must never flow through Vercel Functions.",
        "Browsers fetch Google Drive (CORS) directly via src/lib/driveFileCache.ts.",
        "Policy: .cursor/rules/bandwidth-policy.mdc",
        "",
        ...violations,
      ].join("\n"),
    ).toEqual([]);
  });
});
