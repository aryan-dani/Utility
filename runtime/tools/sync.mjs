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

    const stats = { subjects: new Set(), resources: 0, skipped: 0 };

    for (const file of files) {
      // Expected path: Semester_Branch/Category/Subject/File
      // Examples:
      // Sem_4_AIDS/Sem_4_Notes/AIES/Unit1.pdf
      // Sem_4_AIDS/Sem_4_Syllabus.pdf
      
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
      stats.subjects.add(subjectId);

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
      stats.resources++;

      console.log(`  ✅ Synced: ${fileName.substring(0, 30).padEnd(30)} [${subjectName}]`);
    }

    console.log(`\n✨ Sync Complete!`);
    console.log(`   - Subjects synchronized: ${stats.subjects.size}`);
    console.log(`   - Resources synchronized: ${stats.resources}`);
    console.log(`   - Files skipped: ${stats.skipped}\n`);

  } catch (error) {
    console.error(`\n❌ Sync failed: ${error.message}`);
  }
}

// Allow running directly
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  syncProject();
}

export default syncProject;
