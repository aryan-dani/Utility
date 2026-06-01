import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth().verifyIdToken(token);
    } catch (e) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = decodedToken.uid;
    const db = adminDb();

    const snapshot = await db
      .collection("activity_logs")
      .where("user_id", "==", userId)
      .get();

    const logs = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        logged_date: d.logged_date,
        count: d.count,
        action_type: d.action_type,
      };
    });

    return NextResponse.json({ logs });
  } catch (error: any) {
    console.error("Error fetching activity logs:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch activity logs" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth().verifyIdToken(token);
    } catch (e) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = decodedToken.uid;
    const body = await request.json();
    const { actionType, count } = body;

    if (!actionType || typeof count !== "number") {
      return NextResponse.json(
        { error: "actionType and count are required" },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const docId = `${userId}_${actionType}_${today}`;
    const db = adminDb();
    const logRef = db.collection("activity_logs").doc(docId);

    const docSnap = await logRef.get();

    if (docSnap.exists) {
      const existingCount = docSnap.data()?.count || 0;
      await logRef.update({ count: existingCount + count });
    } else {
      await logRef.set({
        user_id: userId,
        action_type: actionType,
        count: count,
        logged_date: today,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error logging activity:", error);
    return NextResponse.json(
      { error: error.message || "Failed to log activity" },
      { status: 500 }
    );
  }
}
