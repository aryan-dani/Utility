import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

async function getUserIdFromRequest(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth().verifyIdToken(token);
    return decodedToken;
  } catch (e) {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const decodedToken = await getUserIdFromRequest(request);
    if (!decodedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { planId, email, role } = body;

    if (!planId || !email || !role) {
      return NextResponse.json(
        { error: "planId, email, and role are required" },
        { status: 400 }
      );
    }

    const db = adminDb();

    // Verify current user owns this plan
    const planSnap = await db.collection("planner_plans").doc(planId).get();
    if (!planSnap.exists) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    if (planSnap.data()?.owner_id !== decodedToken.uid) {
      return NextResponse.json(
        { error: "Forbidden: You are not the owner of this plan" },
        { status: 403 }
      );
    }

    // Check if collaborator already exists
    const existingSnap = await db
      .collection("planner_collaborators")
      .where("plan_id", "==", planId)
      .where("user_email", "==", email)
      .get();

    if (!existingSnap.empty) {
      return NextResponse.json(
        { error: "Collaborator already invited" },
        { status: 400 }
      );
    }

    const newCollabRef = db.collection("planner_collaborators").doc();
    const newCollab = { plan_id: planId, user_email: email, role };
    await newCollabRef.set(newCollab);

    return NextResponse.json({
      success: true,
      collaborator: { id: newCollabRef.id, ...newCollab },
    });
  } catch (error: any) {
    console.error("Error adding collaborator:", error);
    return NextResponse.json(
      { error: error.message || "Failed to add collaborator" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const decodedToken = await getUserIdFromRequest(request);
    if (!decodedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Collaborator ID is required" },
        { status: 400 }
      );
    }

    const db = adminDb();
    const collabSnap = await db
      .collection("planner_collaborators")
      .doc(id)
      .get();

    if (!collabSnap.exists) {
      return NextResponse.json(
        { error: "Collaborator not found" },
        { status: 404 }
      );
    }

    const planId = collabSnap.data()?.plan_id;

    // Verify current user owns this plan
    const planSnap = await db.collection("planner_plans").doc(planId).get();
    if (!planSnap.exists) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    if (planSnap.data()?.owner_id !== decodedToken.uid) {
      return NextResponse.json(
        { error: "Forbidden: You are not the owner of this plan" },
        { status: 403 }
      );
    }

    await db.collection("planner_collaborators").doc(id).delete();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting collaborator:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete collaborator" },
      { status: 500 }
    );
  }
}
