/**
 * Drive path → Firestore catalog helpers.
 * Resource IDs remain sha256(drivePath) so existing RAG rows stay valid.
 */
import crypto from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase.mjs";
import { parseAcademicYearFromPath } from "./academicYear.mjs";

export function generateId(input) {
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(12, 15)}-a${hash.substring(15, 18)}-${hash.substring(18, 30)}`;
}

export function resourceIdFromPath(drivePath) {
  return generateId(drivePath);
}

export function subjectIdFromParts(academicYear, branch, semester, subjectName) {
  return generateId(
    `subject-${academicYear}-${branch}-${semester}-${String(subjectName).toLowerCase()}`,
  );
}

export function titleCaseSubject(name) {
  return String(name)
    .replace(/_/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function categoryFromSegment(catSegment, fileName = "") {
  const cat = String(catSegment || "").toLowerCase();
  if (cat.includes("notes")) return "notes";
  if (cat.includes("ppt") || cat.includes("presentation")) return "ppt";
  if (cat.includes("pyq")) return "pyq";
  if (cat.includes("qb") || cat.includes("question_bank")) {
    return String(fileName).toLowerCase().includes("solved")
      ? "solved-question-bank"
      : "question-bank";
  }
  if (cat.includes("writeup")) return "writeup";
  if (cat.includes("code")) return "codes";
  return "other";
}

/**
 * Parse a Drive-relative path into catalog fields.
 * Expected:
 *   [YYYY-YYYY/]<BRANCH>/Sem_<N>_<BRANCH>/Sem_<N>_{Notes|…}/<Subject>/<File>
 * Syllabus files may sit at semester root.
 *
 * @returns {null | {
 *   ok: true,
 *   academicYear: string,
 *   branch: string,
 *   semester: number,
 *   category: string,
 *   subjectName: string,
 *   fileName: string,
 *   path: string,
 *   semIndex: number,
 * }}
 */
export function parseDrivePath(relativePath) {
  const path = String(relativePath || "").replace(/\\/g, "/");
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 1) return null;

  const academicYear = parseAcademicYearFromPath(parts);
  const semIndex = parts.findIndex((p) => /Sem_(\d+)_(\w+)/i.test(p));
  if (semIndex === -1) {
    return { ok: false, reason: "no_sem_folder", path };
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
  } else if (parts.length === semIndex + 3) {
    subjectName = "General";
  }

  subjectName = titleCaseSubject(subjectName);

  let category = "other";
  if (parts.length >= semIndex + 2) {
    category = categoryFromSegment(parts[semIndex + 1], fileName);
  }

  return {
    ok: true,
    academicYear,
    branch,
    semester,
    category,
    subjectName,
    fileName,
    path,
    semIndex,
  };
}

export function previewUrl(driveFileId) {
  return `https://drive.google.com/file/d/${driveFileId}/preview`;
}

/**
 * Build dest segments from put flags.
 * category: notes|ppt|pyq|qb|writeups|codes
 */
export function buildDestSegments({
  year,
  branch,
  semester,
  subject,
  category = "notes",
}) {
  const catMap = {
    notes: "Notes",
    ppt: "PPT",
    pyq: "PYQ",
    qb: "QB",
    writeups: "WriteUps",
    writeup: "WriteUps",
    codes: "Codes",
    code: "Codes",
  };
  const catKey = String(category).toLowerCase();
  const catFolder = catMap[catKey] || catMap.notes;
  const br = String(branch).toUpperCase();
  const sem = Number(semester);
  return [
    year,
    br,
    `Sem_${sem}_${br}`,
    `Sem_${sem}_${catFolder}`,
    subject,
  ].filter(Boolean);
}

function resourceUnchanged(existing, payload) {
  if (!existing) return false;
  return (
    existing.drive_modified_at === payload.drive_modified_at &&
    existing.file_url === payload.file_url &&
    existing.title === payload.title &&
    existing.subject_id === payload.subject_id &&
    existing.category === payload.category &&
    existing.drive_file_id === payload.drive_file_id
  );
}

/**
 * Upsert subjects + resources for a list of Drive files.
 *
 * @param {Array<{ id: string, name: string, path: string, updatedAt?: string }>} files
 * @param {{
 *   dryRun?: boolean,
 *   verbose?: boolean,
 *   prune?: boolean,
 *   prunePrefix?: string|null,
 *   updateStats?: 'full'|'bump'|'none',
 *   subjectFilter?: string|null,
 * }} [options]
 */
export async function upsertResources(files, options = {}) {
  const {
    dryRun = false,
    verbose = false,
    prune = false,
    prunePrefix = null,
    updateStats = "none",
    subjectFilter = null,
  } = options;

  const filter = subjectFilter ? String(subjectFilter).trim().toLowerCase() : null;

  const stats = {
    subjects: 0,
    resourcesWritten: 0,
    resourcesSkipped: 0,
    pathSkipped: 0,
    filterSkipped: 0,
    deletedResources: 0,
    deletedSubjects: 0,
    reindexFlagged: 0,
    newResources: 0,
    newSubjects: 0,
  };

  const liveSubjectIds = new Set();
  const liveResourceIds = new Set();
  const syncedSubjectIds = new Set();
  const uniqueBranches = new Set();
  const uniqueSemesters = new Set();
  const pendingWrites = []; // { type: 'resource'|'subject'|'content', ref, payload }

  for (const file of files) {
    const parsed = parseDrivePath(file.path);
    if (!parsed || parsed.ok === false) {
      if (verbose) console.log(`  ⚠️  Skipping non-standard path: ${file.path}`);
      stats.pathSkipped++;
      continue;
    }

    if (filter && !parsed.subjectName.toLowerCase().includes(filter)) {
      stats.filterSkipped++;
      continue;
    }

    const subjectId = subjectIdFromParts(
      parsed.academicYear,
      parsed.branch,
      parsed.semester,
      parsed.subjectName,
    );
    const resourceId = resourceIdFromPath(file.path);
    const fileUrl = previewUrl(file.id);
    const driveModifiedAt = file.updatedAt || new Date().toISOString();

    liveSubjectIds.add(subjectId);
    liveResourceIds.add(resourceId);
    uniqueBranches.add(parsed.branch);
    uniqueSemesters.add(parsed.semester);

    if (!syncedSubjectIds.has(subjectId)) {
      syncedSubjectIds.add(subjectId);
      stats.subjects++;
      pendingWrites.push({
        kind: "subject",
        id: subjectId,
        payload: {
          name: parsed.subjectName,
          branch: parsed.branch,
          semester: parsed.semester,
          academic_year: parsed.academicYear,
        },
      });
    }

    pendingWrites.push({
      kind: "resource",
      id: resourceId,
      fileName: parsed.fileName,
      subjectName: parsed.subjectName,
      payload: {
        title: parsed.fileName,
        file_url: fileUrl,
        subject_id: subjectId,
        category: parsed.category,
        academic_year: parsed.academicYear,
        branch: parsed.branch,
        semester: parsed.semester,
        drive_modified_at: driveModifiedAt,
        drive_file_id: file.id,
        drive_path: file.path,
      },
    });
  }

  // Fetch existing resources in batches for skip-unchanged
  const resourceIds = pendingWrites
    .filter((w) => w.kind === "resource")
    .map((w) => w.id);
  const existingMap = new Map();
  if (!dryRun && resourceIds.length > 0) {
    const chunkSize = 100;
    for (let i = 0; i < resourceIds.length; i += chunkSize) {
      const chunk = resourceIds.slice(i, i + chunkSize);
      const refs = chunk.map((id) => db.collection("resources").doc(id));
      const snaps = await db.getAll(...refs);
      for (const snap of snaps) {
        if (snap.exists) existingMap.set(snap.id, snap.data());
      }
    }
  }

  // Also check which subjects already exist (for bump stats)
  const subjectIds = [...syncedSubjectIds];
  const existingSubjects = new Set();
  if (!dryRun && subjectIds.length > 0 && updateStats === "bump") {
    const chunkSize = 100;
    for (let i = 0; i < subjectIds.length; i += chunkSize) {
      const chunk = subjectIds.slice(i, i + chunkSize);
      const refs = chunk.map((id) => db.collection("subjects").doc(id));
      const snaps = await db.getAll(...refs);
      for (const snap of snaps) {
        if (snap.exists) existingSubjects.add(snap.id);
      }
    }
  }

  // Apply writes in batches
  const BATCH_LIMIT = 400;
  let batch = dryRun ? null : db.batch();
  let batchCount = 0;

  async function flush() {
    if (dryRun || batchCount === 0) return;
    await batch.commit();
    batch = db.batch();
    batchCount = 0;
  }

  async function setDoc(ref, payload, merge = true) {
    if (dryRun) return;
    batch.set(ref, payload, { merge });
    batchCount++;
    if (batchCount >= BATCH_LIMIT) await flush();
  }

  for (const write of pendingWrites) {
    if (write.kind === "subject") {
      if (updateStats === "bump" && !existingSubjects.has(write.id)) {
        stats.newSubjects++;
      }
      await setDoc(db.collection("subjects").doc(write.id), write.payload);
      continue;
    }

    const existing = existingMap.get(write.id) || null;
    const payload = {
      ...write.payload,
      created_at: existing?.created_at || write.payload.drive_modified_at,
    };

    if (resourceUnchanged(existing, payload)) {
      stats.resourcesSkipped++;
      if (verbose) {
        console.log(
          `  ⏭️  Unchanged: ${write.fileName.substring(0, 30).padEnd(30)} [${write.subjectName}]`,
        );
      }
      continue;
    }

    const contentChanged =
      !existing ||
      existing.drive_modified_at !== payload.drive_modified_at ||
      existing.file_url !== payload.file_url;

    if (contentChanged && existing?.content_hash) {
      payload.content_hash = null;
      payload.ai_summary = null;
      stats.reindexFlagged++;
      await setDoc(db.collection("resource_content").doc(write.id), {
        content_hash: null,
        ai_summary: null,
      });
    }

    if (!existing) stats.newResources++;
    stats.resourcesWritten++;

    await setDoc(db.collection("resources").doc(write.id), payload);

    if (verbose || stats.resourcesWritten <= 20) {
      console.log(
        `  ✅ ${existing ? "Updated" : "Created"}: ${write.fileName.substring(0, 30).padEnd(30)} [${write.subjectName}]${
          contentChanged && existing?.content_hash ? " (reindex)" : ""
        }`,
      );
    }
  }

  await flush();

  // Prune
  if (prune) {
    console.log(`\n🧹 Cleaning up stale database records...`);
    let candidatesSnap;
    if (prunePrefix) {
      // Scoped prune: only docs under this Drive path (not the whole collection).
      const prefix = prunePrefix.replace(/\/$/, "");
      candidatesSnap = await db
        .collection("resources")
        .where("drive_path", ">=", prefix)
        .where("drive_path", "<=", `${prefix}\uf8ff`)
        .select("drive_path", "subject_id")
        .get();
      console.log(
        `  🔎 Scoped prune candidates under ${prefix}: ${candidatesSnap.size}`,
      );
    } else {
      candidatesSnap = await db
        .collection("resources")
        .select("drive_path", "subject_id")
        .get();
    }
    const staleResourceIds = [];

    candidatesSnap.forEach((doc) => {
      if (liveResourceIds.has(doc.id)) return;
      const data = doc.data() || {};

      if (prunePrefix) {
        const path = data.drive_path || "";
        // Without drive_path, fall back to subject membership for legacy rows
        if (path) {
          if (!path.startsWith(prunePrefix.replace(/\/$/, "") + "/") &&
              path !== prunePrefix.replace(/\/$/, "")) {
            return;
          }
        } else if (filter) {
          if (!liveSubjectIds.has(data.subject_id)) return;
        } else {
          // Scoped prune without path metadata: only touch subjects we saw
          if (!liveSubjectIds.has(data.subject_id)) return;
        }
      } else if (filter) {
        if (!liveSubjectIds.has(data.subject_id)) return;
      }

      staleResourceIds.push(doc.id);
    });

    if (staleResourceIds.length > 0) {
      console.log(
        `  🗑️ Deleting ${staleResourceIds.length} stale resources${dryRun ? " (dry-run)" : ""}...`,
      );
      if (!dryRun) {
        const chunkSize = 40;
        for (let i = 0; i < staleResourceIds.length; i += chunkSize) {
          const chunk = staleResourceIds.slice(i, i + chunkSize);
          const delBatch = db.batch();
          for (const id of chunk) {
            delBatch.delete(db.collection("resources").doc(id));
            delBatch.delete(db.collection("resource_content").doc(id));
          }
          await delBatch.commit();

          for (const id of chunk) {
            const chunkSnap = await db
              .collection("resource_chunks")
              .where("resource_id", "==", id)
              .limit(500)
              .get();
            if (chunkSnap.empty) continue;
            const chunkBatch = db.batch();
            chunkSnap.docs.forEach((d) => chunkBatch.delete(d.ref));
            await chunkBatch.commit();
          }
        }
      }
      stats.deletedResources = staleResourceIds.length;
    }

    // Full subject prune only on full sync (no filter, no prunePrefix)
    if (!filter && !prunePrefix) {
      const allSubjectsSnap = await db.collection("subjects").get();
      const staleSubjectIds = [];
      allSubjectsSnap.forEach((doc) => {
        if (!liveSubjectIds.has(doc.id)) staleSubjectIds.push(doc.id);
      });
      if (staleSubjectIds.length > 0) {
        console.log(
          `  🗑️ Deleting ${staleSubjectIds.length} stale subjects${dryRun ? " (dry-run)" : ""}...`,
        );
        if (!dryRun) {
          for (let i = 0; i < staleSubjectIds.length; i += 200) {
            const chunk = staleSubjectIds.slice(i, i + 200);
            const delBatch = db.batch();
            for (const id of chunk) {
              delBatch.delete(db.collection("subjects").doc(id));
            }
            await delBatch.commit();
          }
        }
        stats.deletedSubjects = staleSubjectIds.length;
      }
    } else {
      console.log(`  ⏭️ Skipping full subject prune (scoped sync)`);
    }
  }

  // Stats
  if (!dryRun && updateStats === "full") {
    await db.collection("stats").doc("global").set(
      {
        subjects: liveSubjectIds.size,
        resources: liveResourceIds.size,
        branches: uniqueBranches.size,
        semesters: uniqueSemesters.size,
        updated_at: new Date().toISOString(),
      },
      { merge: true },
    );
    console.log(
      `📊 Wrote stats/global (${liveSubjectIds.size} subjects, ${liveResourceIds.size} resources).`,
    );
  } else if (!dryRun && updateStats === "bump") {
    const increments = {};
    if (stats.newResources > 0) {
      increments.resources = FieldValue.increment(stats.newResources);
    }
    if (stats.newSubjects > 0) {
      increments.subjects = FieldValue.increment(stats.newSubjects);
    }
    if (Object.keys(increments).length > 0) {
      increments.updated_at = new Date().toISOString();
      await db.collection("stats").doc("global").set(increments, { merge: true });
      console.log(
        `📊 Bumped stats/global (+${stats.newResources} resources, +${stats.newSubjects} subjects).`,
      );
    }
  }

  // Invalidate workspace list catalogs for touched scopes (next page load rebuilds 1 doc).
  if (!dryRun) {
    const catalogKeys = new Set();
    for (const write of pendingWrites) {
      if (write.kind !== "resource") continue;
      const year = write.payload?.academic_year;
      const br = write.payload?.branch;
      const sem = write.payload?.semester;
      if (year && br && sem != null) {
        catalogKeys.add(`${year}__${br}__${sem}`);
      }
    }
    if (catalogKeys.size > 0) {
      console.log(
        `\n🗂️  Invalidating ${catalogKeys.size} workspace catalog(s)…`,
      );
      for (const id of catalogKeys) {
        try {
          await db.collection("workspace_catalogs").doc(id).delete();
        } catch (err) {
          console.warn(`  ⚠️  catalog delete ${id}: ${err.message}`);
        }
      }
    }
  }

  return {
    stats,
    liveSubjectIds,
    liveResourceIds,
    resourceIds: [...liveResourceIds],
  };
}

/**
 * Delete a Firestore resource + content + chunks by id.
 */
export async function deleteResourceById(resourceId, { dryRun = false } = {}) {
  if (dryRun) {
    console.log(`  [dry-run] would delete resource ${resourceId}`);
    return;
  }
  await db.collection("resources").doc(resourceId).delete();
  await db.collection("resource_content").doc(resourceId).delete();
  const chunkSnap = await db
    .collection("resource_chunks")
    .where("resource_id", "==", resourceId)
    .limit(500)
    .get();
  if (!chunkSnap.empty) {
    const batch = db.batch();
    chunkSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/**
 * Persist / read Drive Changes API page token.
 */
export async function getDriveSyncState() {
  const snap = await db.collection("stats").doc("drive_sync").get();
  return snap.exists ? snap.data() : null;
}

export async function setDriveSyncState(data) {
  await db.collection("stats").doc("drive_sync").set(
    { ...data, updated_at: new Date().toISOString() },
    { merge: true },
  );
}
