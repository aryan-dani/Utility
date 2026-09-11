import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { isAuthFailure, requireRecentUser } from "@/lib/apiAuth";
import { deleteUserFirestoreData } from "@/lib/accountDeletion";
import { enforceUserRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  try {
    const user = await requireRecentUser(request);
    if (isAuthFailure(user)) return user;

    const rate = await enforceUserRateLimit(user.uid, "account-delete", 3, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const db = adminDb();
    await deleteUserFirestoreData(db, user.uid, user.email);
    await adminAuth().deleteUser(user.uid);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("account DELETE", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 },
    );
  }
}
