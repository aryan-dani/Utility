import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { isAuthFailure, requireUser } from "@/lib/apiAuth";
import { enforceUserRateLimit } from "@/lib/rateLimit";
import { z } from "zod";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

export const dynamic = "force-dynamic";

const MAX_PLAN_JSON_BYTES = 400_000;

const postSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
  title: z.string().min(1).max(200),
  is_public: z.boolean().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  planId: z.string().min(1).max(128).optional(),
});

function estimateJsonBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value ?? {}), "utf8");
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

// ── GET: Pull Plan and Collaborators ──
export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (isAuthFailure(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const monthStr = searchParams.get("month");
    const yearStr = searchParams.get("year");

    if (!monthStr || !yearStr) {
      return NextResponse.json(
        { error: "Month and Year are required" },
        { status: 400 },
      );
    }

    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);
    if (!Number.isFinite(month) || !Number.isFinite(year)) {
      return NextResponse.json({ error: "Invalid month/year" }, { status: 400 });
    }

    const userId = auth.uid;
    const email = auth.email?.toLowerCase() || "";
    const db = adminDb();

    const planQuery = db
      .collection("planner_plans")
      .where("owner_id", "==", userId)
      .where("month", "==", month)
      .where("year", "==", year)
      .limit(1);

    let planSnapshot = await planQuery.get();
    let isCollaborator = false;
    let collaboratorRole: string | null = null;

    if (planSnapshot.empty && email) {
      const collabSnap = await db
        .collection("planner_collaborators")
        .where("user_email", "==", email)
        .limit(30)
        .get();

      if (!collabSnap.empty) {
        const planIds = collabSnap.docs.map((d) => d.data().plan_id).filter(Boolean);
        const roleByPlan = new Map(
          collabSnap.docs.map((d) => [d.data().plan_id as string, d.data().role as string]),
        );
        if (planIds.length > 0) {
          const matchingPlans = await db
            .collection("planner_plans")
            .where("__name__", "in", planIds.slice(0, 30))
            .where("month", "==", month)
            .where("year", "==", year)
            .limit(1)
            .get();

          if (!matchingPlans.empty) {
            planSnapshot = matchingPlans;
            isCollaborator = true;
            collaboratorRole = roleByPlan.get(matchingPlans.docs[0].id) || null;
          }
        }
      }
    }

    if (planSnapshot.empty) {
      return NextResponse.json(
        { plan: null, collaborators: [] },
        { headers: PRIVATE_NO_STORE },
      );
    }

    const docSnap = planSnapshot.docs[0];
    const data = docSnap.data();

    const collSnap = await db
      .collection("planner_collaborators")
      .where("plan_id", "==", docSnap.id)
      .get();

    const collaborators = collSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return NextResponse.json(
      {
        plan: {
          id: docSnap.id,
          ...data,
        },
        collaborators,
        isCollaborator,
        collaboratorRole,
      },
      { headers: PRIVATE_NO_STORE },
    );
  } catch (error: unknown) {
    console.error("Error fetching planner plan:", error);
    return NextResponse.json({ error: "Failed to fetch plan" }, { status: 500 });
  }
}

// ── POST: Push (Upsert) Plan — owner or editor collaborator ──
export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (isAuthFailure(auth)) return auth;

    const rate = await enforceUserRateLimit(auth.uid, "planner", 30, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const userId = auth.uid;
    const email = auth.email?.toLowerCase() || "";
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = postSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid plan payload" }, { status: 400 });
    }

    const { month, year, title, is_public, data, planId } = parsed.data;
    if (estimateJsonBytes(data) > MAX_PLAN_JSON_BYTES) {
      return NextResponse.json(
        { error: "Plan data exceeds size limit" },
        { status: 413 },
      );
    }

    const db = adminDb();
    const now = new Date().toISOString();

    // Explicit planId path: update shared plan when editor/owner
    if (planId) {
      const planRef = db.collection("planner_plans").doc(planId);
      const planSnap = await planRef.get();
      if (!planSnap.exists) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
      }
      const plan = planSnap.data()!;
      const isOwner = plan.owner_id === userId;
      let isEditor = false;
      if (!isOwner && email) {
        const collab = await db
          .collection("planner_collaborators")
          .where("plan_id", "==", planId)
          .where("user_email", "==", email)
          .limit(1)
          .get();
        isEditor =
          !collab.empty &&
          String(collab.docs[0].data().role || "").toLowerCase() === "editor";
      }
      if (!isOwner && !isEditor) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      await planRef.update({
        data: data || {},
        title,
        is_public: isOwner ? !!is_public : !!plan.is_public,
        updated_at: now,
      });
      return NextResponse.json({ success: true, id: planId });
    }

    // Owner upsert by month/year
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
        data: data || {},
        title,
        is_public: !!is_public,
        updated_at: now,
      });
    } else {
      // Collaborator with editor role updating shared month without forking
      if (email) {
        const collabSnap = await db
          .collection("planner_collaborators")
          .where("user_email", "==", email)
          .limit(30)
          .get();
        const editorPlanIds = collabSnap.docs
          .filter((d) => String(d.data().role || "").toLowerCase() === "editor")
          .map((d) => d.data().plan_id as string)
          .filter(Boolean);
        if (editorPlanIds.length > 0) {
          const shared = await db
            .collection("planner_plans")
            .where("__name__", "in", editorPlanIds.slice(0, 30))
            .where("month", "==", month)
            .where("year", "==", year)
            .limit(1)
            .get();
          if (!shared.empty) {
            docId = shared.docs[0].id;
            await db.collection("planner_plans").doc(docId).update({
              data: data || {},
              title,
              updated_at: now,
            });
            return NextResponse.json({ success: true, id: docId });
          }
        }
      }

      const newDocRef = db.collection("planner_plans").doc();
      docId = newDocRef.id;
      await newDocRef.set({
        owner_id: userId,
        owner_email: auth.email || "",
        title,
        month,
        year,
        data: data || {},
        is_public: !!is_public,
        updated_at: now,
      });
    }

    return NextResponse.json({ success: true, id: docId });
  } catch (error: unknown) {
    console.error("Error saving planner plan:", error);
    return NextResponse.json({ error: "Failed to save plan" }, { status: 500 });
  }
}
