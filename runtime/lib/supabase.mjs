/**
 * runtime/lib/supabase.mjs
 * Supabase client factory — reads credentials from .env.local automatically.
 * Exports a service-role client (full access, RLS bypassed) used by all runtime tools.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Env loading ────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = join(__dirname, "..", "..", ".env.local");
  if (!existsSync(envPath)) {
    throw new Error(`❌  .env.local not found at: ${envPath}`);
  }

  const content = readFileSync(envPath, "utf-8");
  const parsed = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    parsed[key] = value;
  }
  return parsed;
}

const env = loadEnv();

const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_ROLE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"];
const ANON_KEY = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

if (!SUPABASE_URL) throw new Error("❌  Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
if (!SERVICE_ROLE_KEY) throw new Error("❌  Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");

// ── Singleton client ───────────────────────────────────────────────────────────

let _client = null;

/**
 * Returns a cached Supabase admin client (service role key).
 * RLS is bypassed — full read/write access to all tables and storage.
 */
export function getClient() {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

/**
 * Raw Supabase project URL (used for direct REST/pg calls).
 */
export function getUrl() {
  return SUPABASE_URL;
}

/**
 * Service role key (for Authorization headers).
 */
export function getServiceKey() {
  return SERVICE_ROLE_KEY;
}

/**
 * Anon/publishable key.
 */
export function getAnonKey() {
  return ANON_KEY;
}

/**
 * Convenience: project ref (extracted from URL).
 * e.g. "https://ojdoyjerfdbdhqueachg.supabase.co" → "ojdoyjerfdbdhqueachg"
 */
export function getProjectRef() {
  const match = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : "unknown";
}
