import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  CLIPBOARD_COLLECTION,
  CLIPBOARD_SHARES_COLLECTION,
  isShareExpired,
} from "@/lib/clipboard";

export const dynamic = "force-dynamic";

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "anon";
  return ip;
}

const SHARE_ID_RE = /^[abcdefghjkmnpqrstuvwxyz23456789]{8,16}$/;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const rate = await checkRateLimit(
    `clipboard-share-pub:${clientKey(request)}`,
    30,
    60_000,
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }

  const { id } = await context.params;
  if (!SHARE_ID_RE.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const db = adminDb();
    const shareSnap = await db.collection(CLIPBOARD_SHARES_COLLECTION).doc(id).get();
    if (!shareSnap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const share = shareSnap.data() ?? {};
    const expiresAt = typeof share.expires_at === "string" ? share.expires_at : null;
    const ownerId = typeof share.owner_id === "string" ? share.owner_id : "";

    if (!ownerId || isShareExpired(expiresAt)) {
      await shareSnap.ref.delete();
      return NextResponse.json({ error: "Link expired" }, { status: 410 });
    }

    const clipSnap = await db.collection(CLIPBOARD_COLLECTION).doc(ownerId).get();
    const text = typeof clipSnap.data()?.text === "string" ? clipSnap.data()!.text : "";

    return NextResponse.json(
      { text, share_expires_at: expiresAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("clipboard share GET", error);
    return NextResponse.json({ error: "Failed to load share" }, { status: 500 });
  }
}
