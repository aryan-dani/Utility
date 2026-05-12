import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // We use non-null assertions here because we expect these to be defined in .env.local
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
