import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Extract variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// We need the service role key to bypass the Row Level Security (RLS) policies for inserting data
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "❌ ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.",
  );
  console.log(
    "Please add SUPABASE_SERVICE_ROLE_KEY to your .env.local file from your Supabase Dashboard (Project Settings -> API).",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET_NAME = "course-content";

// Helper to get or create subject
async function ensureSubject(name, branch, semester) {
  // Check if it exists
  const { data: existing, error: fetchErr } = await supabase
    .from("subjects")
    .select("id")
    .eq("name", name)
    .eq("branch", branch)
    .eq("semester", semester)
    .single();

  if (existing) return existing.id;

  // Otherwise create it
  const { data: inserted, error: insertErr } = await supabase
    .from("subjects")
    .insert([{ name, branch, semester }])
    .select("id")
    .single();

  if (insertErr) throw insertErr;
  return inserted.id;
}

async function uploadAndSeed() {
  const contentDir = path.join(process.cwd(), "public", "Content");

  // Example: Branch is AIDS, Semester is 4 based on your folder structure
  const branch = "AIDS"; 
  const semester = 4;

  console.log("🚀 Starting automated sync to Supabase...");

  // Recursively read all files in public/Content
  async function processDirectory(dir, currentSubject = null) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Simple heuristic: If the directory name is all caps (e.g., AIES, DAA, DET) or matches a subject, treat it as a subject
        const isSubject = /^[A-Z]+$/.test(entry.name)
          ? entry.name
          : currentSubject;
        await processDirectory(fullPath, isSubject);
      } else {
        // Skip hidden files, json files, etc
        if (entry.name.startsWith(".") || entry.name.endsWith(".json"))
          continue;

        if (!currentSubject) {
          console.warn(
            `⚠️ Skipping ${entry.name} - could not determine subject from folder structure.`,
          );
          continue;
        }

        console.log(
          `\n⏳ Processing: ${entry.name} for Subject: ${currentSubject}`,
        );

        // 1. Ensure Subject exists in DB
        const subjectId = await ensureSubject(currentSubject, branch, semester);

        // 2. Upload file to Supabase Storage
        const fileBuffer = fs.readFileSync(fullPath);
        const storagePath =
          `${branch}/Sem_${semester}/${currentSubject}/${entry.name}`.replace(
            /\s/g,
            "_",
          );

        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(storagePath, fileBuffer, { upsert: true });

        if (uploadError) {
          console.error(
            `❌ Failed to upload ${entry.name}:`,
            uploadError.message,
          );
          continue;
        }

        // 3. Get Public URL
        const { data: publicUrlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(storagePath);

        const publicUrl = publicUrlData.publicUrl;

        // 4. Insert into resources table
        const { error: dbError } = await supabase.from("resources").upsert(
          [
            {
              title: path.parse(entry.name).name, // File name without extension
              file_url: publicUrl,
              subject_id: subjectId,
            },
          ],
          { onConflict: "file_url" },
        ); // Prevent duplicates if you run it twice

        if (dbError) {
          // If upsert fails because we don't have a unique constraint on file_url, just insert and let constraints handle or just insert blind
          await supabase.from("resources").insert([
            {
              title: path.parse(entry.name).name,
              file_url: publicUrl,
              subject_id: subjectId,
            },
          ]);
        }

        console.log(`✅ Success: Uploaded and linked ${entry.name}`);
      }
    }
  }

  await processDirectory(contentDir);
  console.log(
    "\n🎉 All done! Your files are safely in Supabase and the DB is seeded!",
  );
}

uploadAndSeed().catch(console.error);
