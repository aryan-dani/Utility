import { createClient } from "@/lib/supabaseServer";
import CommunityClient from "./CommunityClient";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export const revalidate = 3600;

export default async function CommunityPage() {
  const supabase = await createClient();
  const { data: decks } = await supabase
    .from("community_decks")
    .select("*")
    .order("upvotes", { ascending: false })
    .limit(50);

  return (
    <Suspense fallback={<CommunityLoading />}>
      <CommunityClient initialDecks={decks || []} />
    </Suspense>
  );
}

function CommunityLoading() {
  return (
    <div className="flex justify-center items-center py-40 min-h-[80vh] w-full">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
}
