import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import {
  isAdminUser,
  isAuthFailure,
  requireAdmin,
} from "@/lib/apiAuth";
import { callHomeInternal, proxyAdminGet } from "@/lib/homeProxy";

export const dynamic = "force-dynamic";

/** Users tab. Read from the home server's profile mirror, which carries usage counts. */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) return auth;

  const res = await proxyAdminGet(request, "/v1/admin/users");
  if (!res) {
    return NextResponse.json(
      { error: "Home server unavailable. The users list needs it." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return new NextResponse(res.body, {
    status: res.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
}

/**
 * Remove Firestore profile + resource_usage for a uid.
 * Does not delete Firebase Auth (account can sign in again).
 */
export async function DELETE(request: Request) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) return auth;

  const { searchParams } = new URL(request.url);
  const uid = String(searchParams.get("uid") || "").trim();
  if (!uid || uid.length > 128) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  if (uid === auth.uid) {
    return NextResponse.json(
      { error: "You cannot remove your own admin profile" },
      { status: 400 },
    );
  }

  try {
    const db = adminDb();
    const userRef = db.collection("users").doc(uid);
    // Auth is the source for email now; users who signed in after the move have no legacy doc.
    const [userSnap, authUser] = await Promise.all([
      userRef.get(),
      adminAuth()
        .getUser(uid)
        .catch(() => null),
    ]);
    if (!userSnap.exists && !authUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const email = String(authUser?.email || userSnap.data()?.email || "")
      .trim()
      .toLowerCase();
    if (
      isAdminUser({
        uid,
        email: email || null,
        emailVerified: authUser?.emailVerified === true,
      })
    ) {
      return NextResponse.json(
        { error: "Cannot remove an allowlisted admin account" },
        { status: 403 },
      );
    }

    let usageDeleted = 0;
    try {
      const usageSnap = await db
        .collection("resource_usage")
        .where("user_id", "==", uid)
        .limit(400)
        .get();
      if (!usageSnap.empty) {
        const batch = db.batch();
        for (const doc of usageSnap.docs) {
          batch.delete(doc.ref);
          usageDeleted += 1;
        }
        await batch.commit();
      }
    } catch (usageErr) {
      console.error("Error deleting resource_usage for user:", usageErr);
    }

    await userRef.delete();

    // Usage rows and the mirrored profile live on the home server now.
    const homeCleared = await callHomeInternal("/internal/profile-remove", { uid });

    return NextResponse.json({
      success: true,
      uid,
      usageDeleted,
      homeCleared,
    });
  } catch (error: unknown) {
    console.error("Error deleting user profile:", error);
    return NextResponse.json(
      { error: "Failed to remove user profile" },
      { status: 500 },
    );
  }
}
