import { NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebaseAdmin";
import { isAuthFailure, requireUser } from "@/lib/apiAuth";
import { enforceUserRateLimit } from "@/lib/rateLimit";
import {
  CLIPBOARD_COLLECTION,
  CLIPBOARD_MAX_CHARS,
  clipTextLengthOk,
  isShareExpired,
} from "@/lib/clipboard";

export const dynamic = "force-dynamic";

const putSchema = z.object({
  text: z.string().max(CLIPBOARD_MAX_CHARS),
});

function rateLimited(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Rate limit exceeded" },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (isAuthFailure(auth)) return auth;

  const rate = await enforceUserRateLimit(auth.uid, "clipboard-get", 60, 60_000);
  if (!rate.allowed) return rateLimited(rate.retryAfterSec);

  try {
    const snap = await adminDb().collection(CLIPBOARD_COLLECTION).doc(auth.uid).get();
    if (!snap.exists) {
      return NextResponse.json({
        text: "",
        updated_at: null,
        share_id: null,
        share_expires_at: null,
      });
    }

    const data = snap.data() ?? {};
    const shareExpires = typeof data.share_expires_at === "string" ? data.share_expires_at : null;
    const shareId = typeof data.share_id === "string" ? data.share_id : null;
    const expired = isShareExpired(shareExpires);

    return NextResponse.json({
      text: typeof data.text === "string" ? data.text : "",
      updated_at: typeof data.updated_at === "string" ? data.updated_at : null,
      share_id: expired ? null : shareId,
      share_expires_at: expired ? null : shareExpires,
    });
  } catch (error) {
    console.error("clipboard GET", error);
    return NextResponse.json({ error: "Failed to load clipboard" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireUser(request);
  if (isAuthFailure(auth)) return auth;

  const rate = await enforceUserRateLimit(auth.uid, "clipboard-put", 20, 60_000);
  if (!rate.allowed) return rateLimited(rate.retryAfterSec);

  try {
    const body = await request.json();
    const parsed = putSchema.safeParse(body);
    if (!parsed.success || !clipTextLengthOk(parsed.data.text)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const updatedAt = new Date().toISOString();
    const ref = adminDb().collection(CLIPBOARD_COLLECTION).doc(auth.uid);
    const existing = await ref.get();
    const prev = existing.data() ?? {};

    await ref.set(
      {
        text: parsed.data.text,
        updated_at: updatedAt,
        owner_id: auth.uid,
        share_id: typeof prev.share_id === "string" ? prev.share_id : null,
        share_expires_at:
          typeof prev.share_expires_at === "string" ? prev.share_expires_at : null,
      },
      { merge: true },
    );

    const shareExpires =
      typeof prev.share_expires_at === "string" ? prev.share_expires_at : null;
    const expired = isShareExpired(shareExpires);

    return NextResponse.json({
      ok: true,
      updated_at: updatedAt,
      share_id: expired ? null : (prev.share_id ?? null),
      share_expires_at: expired ? null : shareExpires,
    });
  } catch (error) {
    console.error("clipboard PUT", error);
    return NextResponse.json({ error: "Failed to save clipboard" }, { status: 500 });
  }
}
