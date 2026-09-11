import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { isAuthFailure, requireUser } from "@/lib/apiAuth";
import { enforceUserRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (isAuthFailure(auth)) return auth;

    const rate = await enforceUserRateLimit(auth.uid, "support", 10, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await request.json();
    const kind = body.kind === "ai-report" ? "ai-report" : "support";
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    const email = typeof body.email === "string" ? body.email.trim().slice(0, 200) : "";
    const txnId = typeof body.txnId === "string" ? body.txnId.trim().slice(0, 120) : "";
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 2000) : "";
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";

    const db = adminDb();

    if (kind === "ai-report") {
      if (!reason || !message) {
        return NextResponse.json(
          { error: "Reason and message required" },
          { status: 400 },
        );
      }
      await db.collection("support_messages").add({
        kind: "ai-report",
        userId: auth.uid,
        name: name || "Anonymous",
        email: email || auth.email || "no-email@shared.com",
        reason,
        message,
        status: "open",
        createdAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ success: true });
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return NextResponse.json({ error: "Valid amount required" }, { status: 400 });
    }

    await db.collection("support_messages").add({
      kind: "support",
      userId: auth.uid,
      name: name || "Anonymous",
      email: email || auth.email || "no-email@shared.com",
      txnId,
      message,
      amount,
      status: "pending_verification",
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("support POST", error);
    return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
  }
}
