/**
 * Compare Google Drive tree vs Firestore resources for disparities.
 *
 * Usage:
 *   node runtime/tools/audit-drive-site.mjs
 *   node runtime/tools/audit-drive-site.mjs --branch=AIDS --semester=3
 */
import { writeFileSync } from "fs";
import { db } from "../lib/firebase.mjs";
import { getEnv } from "../lib/env.mjs";
import { getDrive } from "../lib/drive.mjs";
import {
  LEGACY_ACADEMIC_YEAR,
  parseAcademicYearFromPath,
} from "../lib/academicYear.mjs";

const args = process.argv.slice(2);
const branchFilter = (
  args.find((a) => a.startsWith("--branch=")) || ""
)
  .slice("--branch=".length)
  .toUpperCase() || null;
const semesterFilter = (() => {
  const raw = (args.find((a) => a.startsWith("--semester=")) || "").slice(
    "--semester=".length,
  );
  return raw ? Number(raw) : null;
})();

const KNOWN_BRANCHES = new Set(["AIDS", "CSE", "ECE"]);
const CAT_RE = /notes|ppt|presentation|pyq|qb|question.?bank|writeup|codes?/i;

/** Mirror of former site exclusions (for reporting only). */
const SITE_SUBJECT_EXCLUSIONS = {
  // Cleared: AIDS no longer hides DBMS in dataFetcher.ts
};

const EXCLUDED_TITLES = [
  "aies unit-2 extra (2022)",
  "aies unit_1 (2023)",
  ".emptyfolderplaceholder",
];

async function retrieveAllFiles(folderId, currentPath = "") {
  const filesList = [];
  let pageToken = null;
  const drive = getDrive();

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: 100,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    for (const file of res.data.files || []) {
      const relativePath = currentPath
        ? `${currentPath}/${file.name}`
        : file.name;
      if (file.mimeType === "application/vnd.google-apps.folder") {
        filesList.push(...(await retrieveAllFiles(file.id, relativePath)));
      } else {
        filesList.push({
          id: file.id,
          name: file.name,
          path: relativePath,
        });
      }
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return filesList;
}

function titleCaseSubject(name) {
  return name
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function parseDriveFile(file) {
  const parts = file.path.split("/");
  const academicYear = parseAcademicYearFromPath(parts);
  const semIndex = parts.findIndex((p) => /Sem_(\d+)_(\w+)/i.test(p));
  if (semIndex === -1) {
    return { ok: false, reason: "no_sem_folder", path: file.path };
  }

  const semMatch = parts[semIndex].match(/Sem_(\d+)_(\w+)/i);
  const semester = parseInt(semMatch[1], 10);
  const branch = semMatch[2].toUpperCase();
  const fileName = parts[parts.length - 1];

  let subjectName = "General";
  if (fileName.toLowerCase().includes("syllabus")) {
    subjectName = "Syllabus";
  } else if (parts.length >= semIndex + 4) {
    subjectName = parts[semIndex + 2];
  }

  subjectName = titleCaseSubject(subjectName);

  let category = "other";
  if (parts.length >= semIndex + 2) {
    const catSegment = parts[semIndex + 1].toLowerCase();
    if (catSegment.includes("notes")) category = "notes";
    else if (catSegment.includes("ppt") || catSegment.includes("presentation"))
      category = "ppt";
    else if (catSegment.includes("pyq")) category = "pyq";
    else if (
      catSegment.includes("qb") ||
      catSegment.includes("question_bank")
    ) {
      category = file.name.toLowerCase().includes("solved")
        ? "solved-question-bank"
        : "question-bank";
    }
    else if (catSegment.includes("writeup")) category = "writeup";
    else if (catSegment.includes("code")) category = "codes";
  }

  const misnested =
    !KNOWN_BRANCHES.has(branch) ||
    (CAT_RE.test(branch) && !KNOWN_BRANCHES.has(branch));

  return {
    ok: true,
    driveId: file.id,
    path: file.path,
    name: file.name,
    academicYear,
    branch,
    semester,
    subject: subjectName,
    category,
    misnested,
  };
}

function key(academicYear, branch, semester, subject) {
  return `${academicYear || LEGACY_ACADEMIC_YEAR}|${branch}|${semester}|${subject.toUpperCase()}`;
}

async function loadFirestoreViaSubjects() {
  const subjectsSnap = await db.collection("subjects").get();
  const subjectMeta = new Map();
  for (const doc of subjectsSnap.docs) {
    const d = doc.data();
    subjectMeta.set(doc.id, {
      academicYear: String(d.academic_year || LEGACY_ACADEMIC_YEAR),
      branch: String(d.branch || "").toUpperCase(),
      semester: Number(d.semester || 0),
      subject: String(d.name || "General"),
    });
  }

  const resourcesSnap = await db.collection("resources").get();
  const byKey = new Map();

  for (const doc of resourcesSnap.docs) {
    const d = doc.data();
    const meta = subjectMeta.get(d.subject_id);
    if (!meta) continue;
    const { academicYear, branch, semester, subject } = meta;
    const category = String(d.category || "other");
    const k = key(academicYear, branch, semester, subject);
    if (!byKey.has(k)) {
      byKey.set(k, {
        academicYear,
        branch,
        semester,
        subject,
        count: 0,
        categories: {},
        titles: [],
      });
    }
    const entry = byKey.get(k);
    entry.count += 1;
    entry.categories[category] = (entry.categories[category] || 0) + 1;
    entry.titles.push(d.title || "");
  }

  return {
    byKey,
    total: resourcesSnap.size,
    subjectsTotal: subjectsSnap.size,
  };
}

async function main() {
  const rootId = getEnv("GOOGLE_DRIVE_FOLDER_ID");
  if (!rootId) {
    console.error("Missing GOOGLE_DRIVE_FOLDER_ID");
    process.exit(1);
  }

  console.log("\n🔍 Drive ↔ site disparity audit\n");

  const files = await retrieveAllFiles(rootId);
  console.log(`Drive files: ${files.length}`);

  const parsed = files.map(parseDriveFile);
  const okFiles = parsed.filter((p) => p.ok);
  const skipped = parsed.filter((p) => !p.ok);

  const driveByKey = new Map();
  const misnestedPaths = [];

  for (const f of okFiles) {
    if (branchFilter && f.branch !== branchFilter) continue;
    if (semesterFilter != null && f.semester !== semesterFilter) continue;

    if (f.misnested) {
      misnestedPaths.push(f.path);
    }

    const k = key(f.academicYear, f.branch, f.semester, f.subject);
    if (!driveByKey.has(k)) {
      driveByKey.set(k, {
        academicYear: f.academicYear,
        branch: f.branch,
        semester: f.semester,
        subject: f.subject,
        count: 0,
        categories: {},
        paths: [],
      });
    }
    const entry = driveByKey.get(k);
    entry.count += 1;
    entry.categories[f.category] = (entry.categories[f.category] || 0) + 1;
    entry.paths.push(f.path);
  }

  const { byKey: siteByKey, total: siteTotal, subjectsTotal } =
    await loadFirestoreViaSubjects();
  console.log(`Firestore resources: ${siteTotal} (via ${subjectsTotal} subjects)`);

  const missingOnSite = [];
  const countMismatches = [];
  const exclusionHits = [];

  for (const [k, drive] of driveByKey) {
    if (!KNOWN_BRANCHES.has(drive.branch)) continue;

    const excluded = (SITE_SUBJECT_EXCLUSIONS[drive.branch] || []).map((s) =>
      s.toUpperCase(),
    );
    if (excluded.includes(drive.subject.toUpperCase())) {
      exclusionHits.push({
        ...drive,
        reason: "BRANCH_SUBJECT_EXCLUSIONS (would hide on site)",
      });
    }

    const site = siteByKey.get(k);
    if (!site) {
      missingOnSite.push(drive);
      continue;
    }
    if (site.count < drive.count) {
      countMismatches.push({
        academicYear: drive.academicYear,
        branch: drive.branch,
        semester: drive.semester,
        subject: drive.subject,
        driveCount: drive.count,
        siteCount: site.count,
        driveCategories: drive.categories,
        siteCategories: site.categories,
      });
    }
  }

  const orphanOnSite = [];
  for (const [k, site] of siteByKey) {
    if (branchFilter && site.branch !== branchFilter) continue;
    if (semesterFilter != null && site.semester !== semesterFilter) continue;
    if (!KNOWN_BRANCHES.has(site.branch)) continue;
    if (!driveByKey.has(k) && site.subject.toUpperCase() !== "SYLLABUS") {
      orphanOnSite.push(site);
    }
  }

  const titleExcluded = [];
  for (const f of okFiles) {
    const t = f.name.toLowerCase();
    if (EXCLUDED_TITLES.some((ex) => t.includes(ex))) {
      titleExcluded.push(f.path);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    filters: { branchFilter, semesterFilter },
    summary: {
      driveFiles: files.length,
      parsedOk: okFiles.length,
      skippedNoSem: skipped.length,
      firestoreResources: siteTotal,
      missingSubjectsOnSite: missingOnSite.length,
      countMismatches: countMismatches.length,
      orphanSubjectsOnSite: orphanOnSite.length,
      misnestedPaths: misnestedPaths.length,
      exclusionHits: exclusionHits.length,
      titleExclusionMatches: titleExcluded.length,
    },
    missingOnSite: missingOnSite.map((d) => ({
      academicYear: d.academicYear,
      branch: d.branch,
      semester: d.semester,
      subject: d.subject,
      driveFiles: d.count,
      categories: d.categories,
      samplePaths: d.paths.slice(0, 5),
    })),
    countMismatches,
    orphanOnSite: orphanOnSite.map((s) => ({
      academicYear: s.academicYear,
      branch: s.branch,
      semester: s.semester,
      subject: s.subject,
      siteFiles: s.count,
      categories: s.categories,
    })),
    misnestedPaths: misnestedPaths.slice(0, 50),
    exclusionHits,
    titleExcluded: titleExcluded.slice(0, 30),
    note:
      "AIDS DBMS subject exclusion was removed from dataFetcher.ts. Site cache revalidates ~600s; redeploy or Sync Now to refresh.",
  };

  const outPath = "drive-site-audit.json";
  writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log("\n── Summary ──");
  console.log(JSON.stringify(report.summary, null, 2));
  if (missingOnSite.length) {
    console.log("\nSubjects on Drive missing on site (sample):");
    for (const m of missingOnSite.slice(0, 25)) {
      console.log(
        `  ${m.branch} Sem ${m.semester} / ${m.subject}: ${m.count} files`,
        m.categories,
      );
    }
  }
  if (countMismatches.length) {
    console.log("\nCount mismatches (Drive > site):");
    for (const m of countMismatches.slice(0, 25)) {
      console.log(
        `  ${m.branch} Sem ${m.semester} / ${m.subject}: drive=${m.driveCount} site=${m.siteCount}`,
      );
    }
  }
  if (misnestedPaths.length) {
    console.log(`\nMis-nested paths (branch parsed as category): ${misnestedPaths.length}`);
    for (const p of misnestedPaths.slice(0, 10)) console.log(`  ${p}`);
  }
  console.log(`\n📝 Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
