import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  isAdminUser,
  isAuthFailure,
  requireAdmin,
} from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) return auth;

  try {
    const db = adminDb();
    const snapshot = await db.collection("users").limit(500).get();
    const users = snapshot.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          uid: d.uid || doc.id,
          email: d.email || "",
          displayName: d.displayName || "",
          provider: d.provider || "",
          branch: d.branch || "",
          semester: d.semester || null,
          lastActive: d.lastActive || d.updatedAt || "",
          photoURL: d.photoURL || "",
          resourceOpenCount: Number(d.resourceOpenCount) || 0,
          lastOpenedTitle: d.lastOpenedTitle || "",
          lastOpenedAt: d.lastOpenedAt || "",
        };
      })
      .sort((a, b) => {
        const dateA = a.lastActive ? new Date(a.lastActive).getTime() : 0;
        const dateB = b.lastActive ? new Date(b.lastActive).getTime() : 0;
        return dateB - dateA;
      });

    return NextResponse.json({ users });
  } catch (error: unknown) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
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
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const email = String(userSnap.data()?.email || "")
      .trim()
      .toLowerCase();
    if (isAdminUser({ uid, email: email || null })) {
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

    return NextResponse.json({
      success: true,
      uid,
      usageDeleted,
    });
  } catch (error: unknown) {
    console.error("Error deleting user profile:", error);
    return NextResponse.json(
      { error: "Failed to remove user profile" },
      { status: 500 },
    );
  }
}
