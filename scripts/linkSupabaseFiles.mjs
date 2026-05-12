import { createClient } from "@supabase/supabase-js";

// Extract variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// We need the service role key to bypass the Row Level Security (RLS) policies for inserting data
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
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

async function linkExistingFiles() {
  console.log("🚀 Starting automated linking from Supabase bucket...");

  // Hardcoding Branch and Semester for now based on your UI screenshot
  const branch = "AIDS";
  const semester = 4;

  // Recursive function to step through the Supabase Storage bucket
  async function processFolder(folderPath, currentSubject = null) {
    const { data: items, error } = await supabase.storage.from(BUCKET_NAME).list(folderPath);

    if (error) {
      console.error(`❌ Error listing folder ${folderPath}:`, error.message);
      return;
    }

    for (const item of items) {
      // Exclude hidden files
      if (item.name.startsWith(".")) continue;

      const itemPath = folderPath ? `${folderPath}/${item.name}` : item.name;

      // In Supabase storage, folders often don't have an ID, while files do. 
      // Sometimes we can also check if there is no metadata or by extension.
      // Easiest is to check if it has an id (a file) or lacks an id (a folder).
      if (!item.id) {
        // It's a folder. 
        // If the folder is all caps like 'AIES', 'DAA', 'DET', treat it as a Subject name
        let nextSubject = currentSubject;
        if (/^[A-Z]+$/.test(item.name)) {
          nextSubject = item.name;
        }
        await processFolder(itemPath, nextSubject);
      } else {
        // It's a file!
        if (!currentSubject) {
          console.warn(`⚠️ Skipping ${item.name} - could not determine subject from parent folder.`);
          continue;
        }

        console.log(`\n⏳ Linking: ${item.name} for Subject: ${currentSubject}`);

        // 1. Ensure Subject exists in DB
        const subjectId = await ensureSubject(currentSubject, branch, semester);

        // 2. Get Public URL directly from Supabase
        const { data: publicUrlData } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(itemPath);

        const publicUrl = publicUrlData.publicUrl;
        
        // Remove file extension for the title (e.g. AIES_unit_1.pdf -> AIES_unit_1)
        const title = item.name.split('.').slice(0, -1).join('.') || item.name;

        // 3. Insert into resources table
        const { error: dbError } = await supabase
          .from("resources")
          .upsert([{ 
              title: title,
              file_url: publicUrl,
              subject_id: subjectId 
          }], { onConflict: 'file_url' }); // Upsert by unique file_url if possible

        if (dbError) {
           // Fallback insert if upsert fails
           await supabase.from("resources").insert([{ 
            title: title,
            file_url: publicUrl,
            subject_id: subjectId 
          }]);
        }

        console.log(`✅ Success: Linked ${item.name} to the database!`);
      }
    }
  }

  // Start checking from the root of the bucket
  await processFolder("");
  console.log("\n🎉 All done! Your files are securely linked in the Database!");
}

linkExistingFiles().catch(console.error);