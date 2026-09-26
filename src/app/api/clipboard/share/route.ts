import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { isAuthFailure, requireUser } from "@/lib/apiAuth";
import { enforceUserRateLimit } from "@/lib/rateLimit";
import {
  CLIPBOARD_COLLECTION,
  CLIPBOARD_SHARES_COLLECTION,
  generateShareId,
  shareExpiresAt,
} from "@/lib/clipboard";

export const dynamic = "force-dynamic";

function rateLimited(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Rate limit exceeded" },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (isAuthFailure(auth)) return auth;

  const rate = await enforceUserRateLimit(auth.uid, "clipboard-share", 8, 60_000);
  if (!rate.allowed) return rateLimited(rate.retryAfterSec);

  try {
    const db = adminDb();
    const clipRef = db.collection(CLIPBOARD_COLLECTION).doc(auth.uid);
    const snap = await clipRef.get();
    const prev = snap.data() ?? {};
    const oldShareId = typeof prev.share_id === "string" ? prev.share_id : null;

    if (oldShareId) {
      await db.collection(CLIPBOARD_SHARES_COLLECTION).doc(oldShareId).delete();
    }

    let shareId = generateShareId();
    const collision = await db.collection(CLIPBOARD_SHARES_COLLECTION).doc(shareId).get();
    if (collision.exists) shareId = generateShareId();
    const expiresAt = shareExpiresAt();
    const createdAt = new Date().toISOString();

    await db.collection(CLIPBOARD_SHARES_COLLECTION).doc(shareId).set({
      owner_id: auth.uid,
      expires_at: expiresAt,
      created_at: createdAt,
    });

    await clipRef.set(
      {
        owner_id: auth.uid,
        text: typeof prev.text === "string" ? prev.text : "",
        updated_at: typeof prev.updated_at === "string" ? prev.updated_at : createdAt,
        share_id: shareId,
        share_expires_at: expiresAt,
      },
      { merge: true },
    );

    return NextResponse.json({
      share_id: shareId,
      share_expires_at: expiresAt,
    });
  } catch (error) {
    console.error("clipboard share POST", error);
    return NextResponse.json({ error: "Failed to create share" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireUser(request);
  if (isAuthFailure(auth)) return auth;

  const rate = await enforceUserRateLimit(auth.uid, "clipboard-share-del", 12, 60_000);
  if (!rate.allowed) return rateLimited(rate.retryAfterSec);

  try {
    const db = adminDb();
    const clipRef = db.collection(CLIPBOARD_COLLECTION).doc(auth.uid);
    const snap = await clipRef.get();
    const prev = snap.data() ?? {};
    const shareId = typeof prev.share_id === "string" ? prev.share_id : null;

    if (shareId) {
      await db.collection(CLIPBOARD_SHARES_COLLECTION).doc(shareId).delete();
    }

    if (snap.exists) {
      await clipRef.set(
        { share_id: null, share_expires_at: null },
        { merge: true },
      );
    }

    return NextResponse.json({ ok: true, share_id: null });
  } catch (error) {
    console.error("clipboard share DELETE", error);
    return NextResponse.json({ error: "Failed to revoke share" }, { status: 500 });
  }
}
