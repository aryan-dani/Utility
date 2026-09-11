import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { isAuthFailure, requireUser } from "@/lib/apiAuth";
import { enforceUserRateLimit } from "@/lib/rateLimit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Deck ID is required" }, { status: 400 });
    }

    const db = adminDb();
    const deckDoc = await db.collection("community_decks").doc(id).get();
    if (!deckDoc.exists) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    const d = deckDoc.data() || {};
    const flashcards = Array.isArray(d.flashcards) ? d.flashcards : [];

    return NextResponse.json(
      {
        id: deckDoc.id,
        title: d.title || "",
        branch: d.branch || "",
        semester: Number(d.semester || 0),
        author_name: d.author_name || "",
        author_uid: d.author_uid || "",
        upvotes: Number(d.upvotes || 0),
        cardCount: flashcards.length,
        flashcards,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching deck:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Deck ID is required" }, { status: 400 });
    }

    const auth = await requireUser(request);
    if (isAuthFailure(auth)) return auth;

    const rate = await enforceUserRateLimit(
      auth.uid,
      "community-deck-upvote",
      30,
      60_000,
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    let body: { action?: string } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    if (body.action !== "upvote") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    const db = adminDb();
    const deckRef = db.collection("community_decks").doc(id);
    const deckDoc = await deckRef.get();
    if (!deckDoc.exists) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    const voteRef = db.collection("community_deck_upvotes").doc(`${auth.uid}_${id}`);
    const existingVote = await voteRef.get();
    if (existingVote.exists) {
      const upvotes = Number(deckDoc.data()?.upvotes || 0);
      return NextResponse.json({ success: true, upvotes, alreadyUpvoted: true });
    }

    await db.runTransaction(async (transaction) => {
      transaction.set(voteRef, {
        uid: auth.uid,
        deck_id: id,
        created_at: FieldValue.serverTimestamp(),
      });
      transaction.update(deckRef, { upvotes: FieldValue.increment(1) });
    });
    const updated = await deckRef.get();
    const upvotes = Number(updated.data()?.upvotes || 0);

    return NextResponse.json({ success: true, upvotes });
  } catch (error) {
    console.error("Error upvoting deck:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Deck ID is required" },
        { status: 400 },
      );
    }

    const authResult = await requireUser(request);
    if (isAuthFailure(authResult)) return authResult;

    const rate = await enforceUserRateLimit(
      authResult.uid,
      "community-deck-delete",
      10,
      60_000,
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const db = adminDb();

    const deckDoc = await db.collection("community_decks").doc(id).get();

    if (!deckDoc.exists) {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }

    const deck = deckDoc.data();
    const authorUid = typeof deck?.author_uid === "string" ? deck.author_uid : "";

    if (!authorUid || authorUid !== authResult.uid) {
      return NextResponse.json(
        { error: "Forbidden: You can only delete your own decks" },
        { status: 403 },
      );
    }

    // Delete deck and orphan upvote docs
    const upvoteSnap = await db
      .collection("community_deck_upvotes")
      .where("deck_id", "==", id)
      .limit(500)
      .get();
    const batch = db.batch();
    batch.delete(deckDoc.ref);
    upvoteSnap.docs.forEach((d) => batch.delete(d.ref));
    // Also try doc-id convention `{uid}_{deckId}` if field query returns empty
    if (upvoteSnap.empty) {
      // Best-effort: no secondary index — skip bulk scan
    }
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting deck:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
