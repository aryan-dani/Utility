/**
 * runtime/tools/sync.mjs
 * Synchronizes Supabase Storage with the Database.
 * Scans 'course-content' bucket and populates 'subjects' and 'resources' tables.
 */

import { listAllFiles, getPublicUrl } from "../lib/storage.mjs";
import { upsert } from "../lib/db.mjs";
import crypto from "crypto";

/**
 * Deterministic UUID generation
 */
function generateId(input) {
  const hash = crypto.createHash('sha256').update(input).digest('hex');
  return `${hash.substring(0, 8)}-${hash.substring(8, 12)}-4${hash.substring(12, 15)}-a${hash.substring(15, 18)}-${hash.substring(18, 30)}`;
}

async function syncProject() {
  console.log(`\n🚀 Starting Supabase Sync…\n`);

  try {
    const bucket = "course-content";
    const files = await listAllFiles(bucket);
    console.log(`📦 Found ${files.length} files in '${bucket}'\n`);

    const stats = { subjects: 0, resources: 0, skipped: 0, deletedResources: 0, deletedSubjects: 0 };
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
        // Sem_4_AIDS/Category/Subject/File
        subjectName = parts[2];
      } else if (parts.length === 3) {
        // Sem_4_AIDS/Category/File
        subjectName = "General";
      }

      // Clean subject name: replace underscores with spaces and title case
      subjectName = subjectName.replace(/_/g, ' ')
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      // 1. Upsert Subject
      const subjectId = generateId(`subject-${branch}-${semester}-${subjectName.toLowerCase()}`);
      await upsert("subjects", {
        id: subjectId,
        name: subjectName,
        branch: branch,
        semester: semester
      }, "id");
      liveSubjectIds.add(subjectId);

      // 2. Upsert Resource
      const publicUrl = getPublicUrl(bucket, file.path);
      const resourceId = generateId(file.path);
      
      await upsert("resources", {
        id: resourceId,
        title: fileName,
        file_url: publicUrl,
        subject_id: subjectId,
        created_at: file.updatedAt || new Date().toISOString()
      }, "id");
      liveResourceIds.add(resourceId);
      stats.resources++;

      console.log(`  ✅ Synced: ${fileName.substring(0, 30).padEnd(30)} [${subjectName}]`);
    }

    // 3. Cleanup Stale Data
    console.log(`\n🧹 Cleaning up stale database records…`);
    
    // Delete resources not in the bucket
    const { data: allResources } = await import("../lib/db.mjs").then(m => m.select("resources", { columns: "id, title", limit: 5000 }));
    const staleResourceIds = allResources.filter(r => !liveResourceIds.has(r.id)).map(r => r.id);
    
    if (staleResourceIds.length > 0) {
      console.log(`  🗑️  Deleting ${staleResourceIds.length} stale resources…`);
      await import("../lib/db.mjs").then(m => m.remove("resources", [{ column: "id", op: "in", value: staleResourceIds }]));
      stats.deletedResources = staleResourceIds.length;
      
      // Also cleanup resource_content if not cascaded
      try {
        console.log(`  🗑️  Cleaning up orphaned indexed content…`);
        await import("../lib/db.mjs").then(m => m.remove("resource_content", [{ column: "resource_id", op: "in", value: staleResourceIds }]));
      } catch (e) {
        // Might fail if table doesn't exist or already handled by cascade
      }
    }

    // Delete subjects that have no resources left (and weren't hit)
    const { data: allSubjects } = await import("../lib/db.mjs").then(m => m.select("subjects", { columns: "id, name", limit: 5000 }));
    const staleSubjectIds = allSubjects.filter(s => !liveSubjectIds.has(s.id)).map(s => s.id);
    
    if (staleSubjectIds.length > 0) {
      console.log(`  🗑️  Deleting ${staleSubjectIds.length} stale subjects…`);
      await import("../lib/db.mjs").then(m => m.remove("subjects", [{ column: "id", op: "in", value: staleSubjectIds }]));
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
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  syncProject();
}

export default syncProject;
