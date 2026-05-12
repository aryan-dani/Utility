import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fix() {
  const { data, error } = await supabase
    .from("subjects")
    .update({ branch: "AIDS" })
    .eq("branch", "AI-DS");
  
  if (error) console.error("Error setting branch to AIDS:", error);
  else console.log("✅ Fixed the database names!");
}

fix();
