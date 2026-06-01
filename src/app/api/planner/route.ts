import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

// ── Helpers ──
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

// ── GET: Pull Plan and Collaborators ──
export async function GET(request: Request) {
  try {
    const decodedToken = await getUserIdFromRequest(request);
    if (!decodedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const monthStr = searchParams.get("month");
    const yearStr = searchParams.get("year");

    if (!monthStr || !yearStr) {
      return NextResponse.json(
        { error: "Month and Year are required" },
        { status: 400 }
      );
    }

    const month = parseInt(monthStr);
    const year = parseInt(yearStr);
    const userId = decodedToken.uid;
    const db = adminDb();

    // Find if user is owner of the plan
    let planQuery = db
      .collection("planner_plans")
      .where("owner_id", "==", userId)
      .where("month", "==", month)
      .where("year", "==", year)
      .limit(1);

    let planSnapshot = await planQuery.get();
    let isCollaborator = false;

    // If not found, check if they are a collaborator
    if (planSnapshot.empty && decodedToken.email) {
      const collabSnap = await db
        .collection("planner_collaborators")
        .where("user_email", "==", decodedToken.email)
        .get();

      if (!collabSnap.empty) {
        const planIds = collabSnap.docs.map((d) => d.data().plan_id);
        if (planIds.length > 0) {
          const matchingPlans = await db
            .collection("planner_plans")
            .where("__name__", "in", planIds)
            .where("month", "==", month)
            .where("year", "==", year)
            .limit(1)
            .get();

          if (!matchingPlans.empty) {
            planSnapshot = matchingPlans;
            isCollaborator = true;
          }
        }
      }
    }

    if (planSnapshot.empty) {
      return NextResponse.json({ plan: null, collaborators: [] });
    }

    const docSnap = planSnapshot.docs[0];
    const data = docSnap.data();

    // Load all collaborators for this plan
    const collSnap = await db
      .collection("planner_collaborators")
      .where("plan_id", "==", docSnap.id)
      .get();

    const collaborators = collSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json({
      plan: {
        id: docSnap.id,
        ...data,
      },
      collaborators,
      isCollaborator,
    });
  } catch (error: any) {
    console.error("Error fetching planner plan:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch plan" },
      { status: 500 }
    );
  }
}

// ── POST: Push (Upsert) Plan ──
export async function POST(request: Request) {
  try {
    const decodedToken = await getUserIdFromRequest(request);
    if (!decodedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = decodedToken.uid;
    const body = await request.json();
    const { month, year, data, title, is_public } = body;

    if (!month || !year || !title) {
      return NextResponse.json(
        { error: "Month, Year, and Title are required" },
        { status: 400 }
      );
    }

    const db = adminDb();

    // Check if the plan already exists for this owner/month/year
    const planQuery = db
      .collection("planner_plans")
      .where("owner_id", "==", userId)
      .where("month", "==", month)
      .where("year", "==", year)
      .limit(1);

    const snapshot = await planQuery.get();
    let docId = "";

    if (!snapshot.empty) {
      docId = snapshot.docs[0].id;
      await db.collection("planner_plans").doc(docId).update({
        data,
        title,
        is_public: !!is_public,
        updated_at: new Date().toISOString(),
      });
    } else {
      const newDocRef = db.collection("planner_plans").doc();
      docId = newDocRef.id;
      await newDocRef.set({
        owner_id: userId,
        owner_email: decodedToken.email || "",
        title,
        month: parseInt(month),
        year: parseInt(year),
        data: data || {},
        is_public: !!is_public,
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, id: docId });
  } catch (error: any) {
    console.error("Error saving planner plan:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save plan" },
      { status: 500 }
    );
  }
}
