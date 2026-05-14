/**
 * scripts/rebuild-database.mjs
 * Robust synchronization between Storage Buckets and Relational Database.
 * Optimized for the current directory structure and full public URLs.
 */

import { listAllFiles, getPublicUrl } from "../runtime/lib/storage.mjs";
import { insert, remove, select } from "../runtime/lib/db.mjs";
import { executeSQL } from "../runtime/lib/sql.mjs";
import crypto from "crypto";

const BUCKET = "course-content";

async function rebuild() {
  console.log("🚀 Starting database rebuild from storage...");

  try {
    const files = await listAllFiles(BUCKET);
    console.log(`📦 Found ${files.length} files in storage.`);

    console.log("🧹 Clearing old data...");
    try {
      await executeSQL("DELETE FROM resources", { silent: true });
      await executeSQL("DELETE FROM subjects", { silent: true });
    } catch {
      await remove("resources", [{ column: "id", op: "neq", value: "00000000-0000-0000-0000-000000000000" }]);
      await remove("subjects", [{ column: "id", op: "neq", value: "00000000-0000-0000-0000-000000000000" }]);
    }

    const subjectMap = new Map(); // key: "branch|semester|name", value: id
    const resourcesToInsert = [];

    for (const file of files) {
      if (file.name === ".emptyFolderPlaceholder") continue;
      
      const parts = file.path.split("/");
      if (parts.length < 2) continue;

      const branchPart = parts[0]; 
      const semMatch = branchPart.match(/Sem_(\d+)/i);
      const semester = semMatch ? parseInt(semMatch[1]) : 4;
      const branch = branchPart.split("_").pop()?.toUpperCase() || "GEN";

      let subjectName = "General";
      let fileName = parts[parts.length - 1];

      if (parts.length >= 4) {
        subjectName = parts[2].toUpperCase();
      } else if (parts.length === 3) {
        const prefixMatch = fileName.match(/^([A-Z0-9]{2,})_/i);
        if (prefixMatch) subjectName = prefixMatch[1].toUpperCase();
      } else if (parts.length === 2 && fileName.toLowerCase().includes("syllabus")) {
        subjectName = "Syllabus";
      }

      subjectName = subjectName.replace(/^SEM_\d+_?/i, "");

      const subjectKey = `${branch}|${semester}|${subjectName}`;
      let subjectId;
      if (subjectMap.has(subjectKey)) {
        subjectId = subjectMap.get(subjectKey);
      } else {
        subjectId = crypto.randomUUID();
        await insert("subjects", {
          id: subjectId,
          name: subjectName,
          branch: branch,
          semester: semester
        });
        subjectMap.set(subjectKey, subjectId);
        console.log(`   ➕ Created subject: ${subjectName} (${branch} Sem ${semester})`);
      }

      // Generate FULL public URL
      const fullUrl = getPublicUrl(BUCKET, file.path);

      // Enhanced title generation: Include folder context for better clarity
      let finalTitle = fileName.replace(/\.[^/.]+$/, "").replace(/_/g, " ").trim();
      
      // If the file is nested in "Solved", "Questions", or a Year-like folder, add it to title
      if (parts.length >= 5) {
        const folderContext = parts[parts.length - 2];
        const subContext = parts[parts.length - 3];
        
        if (/^20\d{2}$/.test(folderContext)) {
          finalTitle = `${finalTitle} (${folderContext})`;
        } else if (/solved|questions|unsolved/i.test(folderContext)) {
          // If it's something like AIES/2023/Solved/File.pdf
          const yearMatch = subContext.match(/^20\d{2}$/);
          if (yearMatch) {
            finalTitle = `${finalTitle} (${folderContext} - ${yearMatch[0]})`;
          } else {
            finalTitle = `${finalTitle} (${folderContext})`;
          }
        }
      } else if (parts.length === 4) {
        const folderContext = parts[parts.length - 2];
        if (/solved|questions|unsolved|^20\d{2}$/i.test(folderContext)) {
          finalTitle = `${finalTitle} (${folderContext})`;
        }
      }

      resourcesToInsert.push({
        id: crypto.randomUUID(),
        title: finalTitle,
        file_url: fullUrl,
        subject_id: subjectId,
        created_at: file.updatedAt || new Date().toISOString()
      });
    }

    if (resourcesToInsert.length > 0) {
      console.log(`📥 Inserting ${resourcesToInsert.length} resources...`);
      for (let i = 0; i < resourcesToInsert.length; i += 50) {
        await insert("resources", resourcesToInsert.slice(i, i + 50));
      }
    }

    console.log("\n✨ Database rebuild complete!");
    console.log(`   Total Subjects: ${subjectMap.size}`);
    console.log(`   Total Resources: ${resourcesToInsert.length}`);

  } catch (error) {
    console.error("\n❌ Rebuild failed:", error.message);
    process.exit(1);
  }
}

rebuild();
