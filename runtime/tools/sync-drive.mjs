/**
 * runtime/tools/sync-drive.mjs
 * Synchronizes Google Drive Shared Folder contents with the Firestore Database.
 * Scans Google Drive directory recursively and updates 'subjects' and 'resources' collections.
 */

import { db } from "../lib/firebase.mjs";
import crypto from "crypto";
import { env } from "../lib/env.mjs";
import { getDrive } from "../lib/drive.mjs";

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId(input) {
  const hash = crypto.createHash("sha256").update(input).digest("hex");
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(12, 15)}-a${hash.substring(15, 18)}-${hash.substring(18, 30)}`;
}

/** Recursively retrieve all files from a Google Drive folder */
async function retrieveAllFiles(folderId, currentPath = "") {
  const filesList = [];
  let pageToken = null;
  const drive = getDrive();

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime)",
      pageSize: 100,
      pageToken: pageToken,
    });

    const files = res.data.files || [];
    for (const file of files) {
      const relativePath = currentPath
        ? `${currentPath}/${file.name}`
        : file.name;
      if (file.mimeType === "application/vnd.google-apps.folder") {
        const subFiles = await retrieveAllFiles(file.id, relativePath);
        filesList.push(...subFiles);
      } else {
        filesList.push({
          id: file.id,
          name: file.name,
          path: relativePath,
          updatedAt: file.modifiedTime,
        });
      }
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return filesList;
}

// ── Sync Process ──────────────────────────────────────────────────────────────

async function syncDrive() {
  console.log(`\n🚀 Starting Google Drive Sync...\n`);

  try {
    const driveFolderId = env["GOOGLE_DRIVE_FOLDER_ID"];
    if (!driveFolderId) {
      throw new Error(
        "❌ Missing GOOGLE_DRIVE_FOLDER_ID in environment variables.",
      );
    }
    const files = await retrieveAllFiles(driveFolderId);
    console.log(`📦 Found ${files.length} files in Google Drive folder.\n`);

    const stats = {
      subjects: 0,
      resources: 0,
      skipped: 0,
      deletedResources: 0,
      deletedSubjects: 0,
    };
    const liveSubjectIds = new Set();
    const liveResourceIds = new Set();

    for (const file of files) {
      // Expected path: Semester_Branch/Category/Subject/File
      const parts = file.path.split("/");
      if (parts.length < 1) continue;

      const semBranchFolder = parts[0];
      const semMatch = semBranchFolder.match(/Sem_(\d+)_(\w+)/i);

      if (!semMatch) {
        console.log(`  ⚠️  Skipping non-standard path: ${file.path}`);
        stats.skipped++;
        continue;
      }

      const semester = parseInt(semMatch[1]);
      const branch = semMatch[2].toUpperCase();

      let subjectName = "General";
      let fileName = parts[parts.length - 1];

      // Syllabus special case
      if (fileName.toLowerCase().includes("syllabus")) {
        subjectName = "Syllabus";
      } else if (parts.length >= 4) {
        subjectName = parts[2];
      } else if (parts.length === 3) {
        subjectName = "General";
      }

      // Clean subject name
      subjectName = subjectName
        .replace(/_/g, " ")
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      // 1. Sync Subject to Firestore
      const subjectId = generateId(
        `subject-${branch}-${semester}-${subjectName.toLowerCase()}`,
      );
      const subjectRef = db.collection("subjects").doc(subjectId);
      await subjectRef.set(
        {
          name: subjectName,
          branch: branch,
          semester: semester,
        },
        { merge: true },
      );
      liveSubjectIds.add(subjectId);

      // 2. Sync Resource to Firestore
      // Instead of forcing a download, use the Google Drive preview link so it opens nicely in an iframe
      const fileUrl = `https://drive.google.com/file/d/${file.id}/preview`;
      const resourceId = generateId(file.path);
      const resourceRef = db.collection("resources").doc(resourceId);

      let category = "other";
      if (parts.length >= 2) {
        const catSegment = parts[1].toLowerCase();
        if (catSegment.includes("notes")) category = "notes";
        else if (
          catSegment.includes("ppt") ||
          catSegment.includes("presentation")
        )
          category = "ppt";
        else if (catSegment.includes("pyq")) category = "pyq";
        else if (
          catSegment.includes("qb") ||
          catSegment.includes("question_bank")
        ) {
          category = fileName.toLowerCase().includes("solved")
            ? "solved-question-bank"
            : "question-bank";
        } else if (catSegment.includes("writeup")) category = "writeup";
      }

      await resourceRef.set(
        {
          title: fileName,
          file_url: fileUrl,
          subject_id: subjectId,
          category: category,
          created_at: file.updatedAt || new Date().toISOString(),
        },
        { merge: true },
      );

      liveResourceIds.add(resourceId);
      stats.resources++;

      console.log(
        `  ✅ Synced: ${fileName.substring(0, 30).padEnd(30)} [${subjectName}]`,
      );
    }

    // 3. Cleanup Stale Data
    console.log(`\n🧹 Cleaning up stale database records...`);

    // Fetch all current resources in Firestore
    const allResourcesSnap = await db.collection("resources").get();
    const staleResourceIds = [];
    allResourcesSnap.forEach((doc) => {
      if (!liveResourceIds.has(doc.id)) {
        staleResourceIds.push(doc.id);
      }
    });

    if (staleResourceIds.length > 0) {
      console.log(
        `  🗑️ Deleting ${staleResourceIds.length} stale resources...`,
      );
      const batch = db.batch();
      for (const id of staleResourceIds) {
        batch.delete(db.collection("resources").doc(id));
        // Also cleanup resource_content
        batch.delete(db.collection("resource_content").doc(id));
      }
      await batch.commit();
      stats.deletedResources = staleResourceIds.length;
    }

    // Fetch all current subjects in Firestore
    const allSubjectsSnap = await db.collection("subjects").get();
    const staleSubjectIds = [];
    allSubjectsSnap.forEach((doc) => {
      if (!liveSubjectIds.has(doc.id)) {
        staleSubjectIds.push(doc.id);
      }
    });

    if (staleSubjectIds.length > 0) {
      console.log(`  🗑️ Deleting ${staleSubjectIds.length} stale subjects...`);
      const batch = db.batch();
      for (const id of staleSubjectIds) {
        batch.delete(db.collection("subjects").doc(id));
      }
      await batch.commit();
      stats.deletedSubjects = staleSubjectIds.length;
    }

    console.log(`\n✨ Sync Complete!`);
    console.log(`   - Resources Synced: ${stats.resources}`);
    console.log(`   - Resources Deleted: ${stats.deletedResources}`);
    console.log(`   - Subjects Synced: ${liveSubjectIds.size}`);
    console.log(`   - Subjects Deleted: ${stats.deletedSubjects}`);
    console.log(`   - Files Skipped: ${stats.skipped}\n`);
  } catch (error) {
    console.error(`\n❌ Sync failed: ${error.message}`);
    if (error.stack) console.error(error.stack);
  }
}

// Allow running directly
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  syncDrive();
}

export default syncDrive;
