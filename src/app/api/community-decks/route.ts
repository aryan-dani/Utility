import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { isAuthFailure, requireUser } from "@/lib/apiAuth";
import { enforceUserRateLimit } from "@/lib/rateLimit";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (isAuthFailure(auth)) return auth;

  try {
    const db = adminDb();
    const snapshot = await db
      .collection("community_decks")
      .orderBy("upvotes", "desc")
      .limit(50)
      .get();

    const decks = snapshot.docs.map((doc) => {
      const d = doc.data();
      let createdAtStr = new Date().toISOString();
      if (d.created_at) {
        if (typeof d.created_at.toDate === "function") {
          createdAtStr = d.created_at.toDate().toISOString();
        } else if (d.created_at.seconds) {
          createdAtStr = new Date(d.created_at.seconds * 1000).toISOString();
        } else {
          createdAtStr = new Date(d.created_at).toISOString();
        }
      }
      const cards = Array.isArray(d.flashcards) ? d.flashcards : [];
      return {
        id: doc.id,
        title: d.title || "",
        branch: d.branch || "",
        semester: Number(d.semester || 0),
        author_name: d.author_name || "",
        author_uid: d.author_uid || "",
        upvotes: Number(d.upvotes || 0),
        cardCount: cards.length,
        flashcards: [],
        created_at: createdAtStr,
      };
    });

    return NextResponse.json(
      { decks },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (error) {
    console.error("community-decks GET", error);
    return NextResponse.json({ error: "Failed to load decks" }, { status: 500 });
  }
}

const cardSchema = z.object({
  front: z.string().min(1).max(2000),
  back: z.string().min(1).max(4000),
});

const publishSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  branch: z.string().min(1).max(16).optional(),
  semester: z.coerce.number().int().min(1).max(8),
  author_name: z.string().max(80).optional(),
  flashcards: z.array(cardSchema).min(1).max(200),
});

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (isAuthFailure(auth)) return auth;

  const rate = await enforceUserRateLimit(auth.uid, "community-decks", 10, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }

  try {
    const body = await request.json();
    const parsed = publishSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid deck payload" }, { status: 400 });
    }

    const {
      title = "Academic Flashcards",
      branch = "AIDS",
      semester,
      flashcards,
      author_name,
    } = parsed.data;

    const authorName =
      author_name?.trim() ||
      auth.email?.split("@")[0] ||
      "Anonymous Scholar";

    const db = adminDb();
    const ref = await db.collection("community_decks").add({
      title: title.trim().slice(0, 200),
      branch: branch.trim().slice(0, 16),
      semester,
      author_name: authorName.slice(0, 80),
      author_uid: auth.uid,
      flashcards,
      upvotes: 0,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, id: ref.id });
  } catch (error) {
    console.error("community-decks POST", error);
    return NextResponse.json({ error: "Failed to publish deck" }, { status: 500 });
  }
}
