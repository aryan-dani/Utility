/**
 * sync-resources.mjs
 *
 * Scans the Supabase Storage bucket and syncs all files into the `resources`
 * and `subjects` tables. Safe to run multiple times — skips existing entries.
 *
 * Usage:
 *   node scripts/sync-resources.mjs [--dry-run]
 *
 * Requires: @supabase/supabase-js (already installed)
 * Reads:    .env.local for NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ─── Config ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes("--dry-run");
const BUCKET = "course-content";

const envContent = readFileSync(join(__dirname, "..", ".env.local"), "utf-8");
const env = Object.fromEntries(
  envContent
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const [key, ...rest] = line.split("=");
      return [key.trim(), rest.join("=").trim()];
    }),
);

const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_ROLE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function listAllFiles(prefix = "") {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(prefix, { limit: 1000, offset: 0 });
  if (error) throw new Error(`list("${prefix}") failed: ${error.message}`);
  const results = [];
  for (const item of data ?? []) {
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
    if (!item.id) {
      results.push(...(await listAllFiles(fullPath)));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function fileNameToTitle(filename) {
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  // Strip trailing 3-4 digit random admin-upload suffix (e.g. _756)
  // but keep meaningful mid-string numbers like UNIT_1, UNIT_2
  const withoutSuffix = withoutExt.replace(/(?<=[a-zA-Z])_\d{3,4}$/, "");
  return withoutSuffix
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function parsePath(filePath) {
  const parts = filePath.split("/");
  if (parts.length < 4) return null;

  const filename = parts[parts.length - 1];
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!["pdf", "ppt", "pptx", "doc", "docx"].includes(ext)) return null;

  // Old format: Sem_{N}_{BRANCH} / Sem_{N}_{Notes|PPT} / {Subject} / {file}
  const oldTopMatch = parts[0].match(/^Sem_(\d+)_(.+)$/);
  if (oldTopMatch) {
    const semester = parseInt(oldTopMatch[1]);
    const branch = oldTopMatch[2];
    const categorySegment = parts[1] ?? "";
    const subject = parts[2];
    if (!subject) return null;
    const category = categorySegment.includes("PPT")
      ? "ppt"
      : categorySegment.includes("Notes")
      ? "notes"
      : "other";
    return { branch, semester, subject_name: subject, category, title: fileNameToTitle(filename) };
  }

  // Admin format: {BRANCH} / Sem_{N} / {Subject} / {file}
  const adminSemMatch = parts[1]?.match(/^Sem_(\d+)$/);
  if (adminSemMatch) {
    const branch = parts[0];
    const semester = parseInt(adminSemMatch[1]);
    const subject = parts[2];
    if (!subject) return null;
    const category = filePath.includes("_PPT/") ? "ppt"
      : filePath.includes("_Notes/") ? "notes"
      : "other";
    return { branch, semester, subject_name: subject, category, title: fileNameToTitle(filename) };
  }

  return null;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍  Scanning bucket "${BUCKET}"${DRY_RUN ? " (DRY RUN)" : ""}…\n`);

  const files = await listAllFiles();
  console.log(`   Found ${files.length} total objects.\n`);

  const parsed = [];
  const skipped = [];
  for (const path of files) {
    const meta = parsePath(path);
    if (meta) parsed.push({ path, ...meta });
    else skipped.push(path);
  }

  console.log(`   ✅  Parseable: ${parsed.length}`);
  console.log(`   ⏭️   Skipped:   ${skipped.length}`);
  skipped.forEach((p) => console.log(`        • ${p}`));
  console.log();

  if (DRY_RUN) {
    console.log("── DRY RUN preview ──────────────────────────────────────────────────");
    parsed.forEach(({ branch, semester, subject_name, category, title }) =>
      console.log(`  [${branch} Sem${semester}] ${subject_name} — ${category} — ${title}`),
    );
    console.log("\nDry run complete. Run without --dry-run to apply.\n");
    return;
  }

  // ── 1. Ensure subjects exist (select → insert if missing) ─────────────────

  const uniqueSubjects = [
    ...new Map(
      parsed.map(({ branch, semester, subject_name }) => [
        `${branch}-${semester}-${subject_name}`,
        { branch, semester, name: subject_name },
      ]),
    ).values(),
  ];

  console.log(`📂  Processing ${uniqueSubjects.length} subject(s)…`);

  for (const subj of uniqueSubjects) {
    const { data: existing } = await supabase
      .from("subjects")
      .select("id")
      .eq("name", subj.name)
      .eq("branch", subj.branch)
      .eq("semester", subj.semester)
      .maybeSingle();

    if (existing) {
      console.log(`   ⏭️   ${subj.branch} Sem${subj.semester} / ${subj.name} — exists`);
      continue;
    }

    const { error } = await supabase
      .from("subjects")
      .insert({ name: subj.name, branch: subj.branch, semester: subj.semester });

    if (error) console.error(`   ❌  ${subj.name}: ${error.message}`);
    else console.log(`   ✅  ${subj.branch} Sem${subj.semester} / ${subj.name} — created`);
  }

  // ── 2. Fetch subject id map ───────────────────────────────────────────────

  const { data: allSubjects, error: fetchErr } = await supabase
    .from("subjects")
    .select("id, name, branch, semester");
  if (fetchErr) throw new Error(`Could not fetch subjects: ${fetchErr.message}`);

  const subjectIdMap = new Map(
    (allSubjects ?? []).map((s) => [`${s.branch}-${s.semester}-${s.name}`, s.id]),
  );

  // ── 3. Fetch existing resource URLs to avoid duplicates ───────────────────

  const { data: existingResources } = await supabase
    .from("resources")
    .select("file_url");
  const existingUrls = new Set((existingResources ?? []).map((r) => r.file_url));

  // ── 4. Insert new resources ───────────────────────────────────────────────

  console.log(`\n📄  Processing ${parsed.length} resource(s)…`);
  let inserted = 0, skippedExisting = 0, failed = 0;

  for (const item of parsed) {
    const subjectKey = `${item.branch}-${item.semester}-${item.subject_name}`;
    const subject_id = subjectIdMap.get(subjectKey);

    if (!subject_id) {
      console.warn(`   ⚠️   No subject for ${subjectKey} — skipping "${item.title}"`);
      failed++;
      continue;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(item.path);
    const file_url = urlData.publicUrl;

    if (existingUrls.has(file_url)) {
      console.log(`   ⏭️   [${item.category.toUpperCase()}] "${item.title}" — already in DB`);
      skippedExisting++;
      continue;
    }

    const { error } = await supabase
      .from("resources")
      .insert({ subject_id, title: item.title, file_url });

    if (error) {
      console.error(`   ❌  "${item.title}": ${error.message}`);
      failed++;
    } else {
      console.log(`   ✅  [${item.category.toUpperCase()}] ${item.subject_name} — ${item.title}`);
      inserted++;
    }
  }

  console.log(
    `\n✨  Done — ${inserted} inserted, ${skippedExisting} already existed, ${failed} failed.\n`,
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
