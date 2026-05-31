import { adminDb } from "@/lib/firebaseAdmin";
import CommunityClient from "./CommunityClient";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export const revalidate = 3600;

export default async function CommunityPage() {
  const db = adminDb();
  let decks: any[] = [];
  try {
    const snapshot = await db.collection("community_decks")
      .orderBy("upvotes", "desc")
      .limit(50)
      .get();
      
    decks = snapshot.docs.map(doc => {
      const d = doc.data();
      let createdAtStr = new Date().toISOString();
      if (d.created_at) {
        if (typeof d.created_at.toDate === 'function') {
          createdAtStr = d.created_at.toDate().toISOString();
        } else if (d.created_at.seconds) {
          createdAtStr = new Date(d.created_at.seconds * 1000).toISOString();
        } else {
          createdAtStr = new Date(d.created_at).toISOString();
        }
      }
      return {
        id: doc.id,
        title: d.title || "",
        branch: d.branch || "",
        semester: Number(d.semester || 0),
        author_name: d.author_name || "",
        upvotes: Number(d.upvotes || 0),
        flashcards: d.flashcards || [],
        created_at: createdAtStr
      };
    });
  } catch (error) {
    console.error("Error fetching community decks from Firestore:", error);
  }

  return (
    <Suspense fallback={<CommunityLoading />}>
      <CommunityClient initialDecks={decks} />
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
