import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { isAuthFailure, requireUser } from "@/lib/apiAuth";
import { getAlgorithm } from "@/lib/visualize/catalog";
import { enforceUserRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

/** Normalize tree playback ids (e.g. `bfs-tree`) onto the base algorithm. */
function normalizeAlgorithmId(raw: string): string {
  return raw.replace(/-tree$/, "");
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (isAuthFailure(auth)) return auth;

    const db = adminDb();
    const snapshot = await db
      .collection("visualize_progress")
      .where("owner_id", "==", auth.uid)
      .get();

    const progress = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        algorithmId: data.algorithmId as string,
        completed: Boolean(data.completed),
        timeSpentSeconds: Number(data.timeSpentSeconds) || 0,
        updated_at: data.updated_at?.toDate?.()?.toISOString?.() ?? null,
      };
    });

    return NextResponse.json({ progress }, { headers: PRIVATE_NO_STORE });
  } catch (error) {
    console.error("visualize progress GET", error);
    return NextResponse.json(
      { error: "Failed to load progress" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (isAuthFailure(auth)) return auth;

    const rate = await enforceUserRateLimit(
      auth.uid,
      "visualize-progress",
      60,
      60_000,
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await request.json();
    const rawId =
      typeof body.algorithmId === "string" ? body.algorithmId : "";
    const algorithmId = normalizeAlgorithmId(rawId);
    if (!getAlgorithm(algorithmId)) {
      return NextResponse.json({ error: "Unknown algorithm" }, { status: 400 });
    }

    const deltaSeconds = Math.max(
      0,
      Math.min(Number(body.timeSpentSeconds) || 0, 86_400),
    );
    const completed = Boolean(body.completed);

    const db = adminDb();
    const docId = `${auth.uid}_${algorithmId}`;
    const docRef = db.collection("visualize_progress").doc(docId);
    const existing = await docRef.get();
    const prevSeconds = Number(existing.data()?.timeSpentSeconds) || 0;
    const timeSpentSeconds = Math.min(prevSeconds + deltaSeconds, 86_400);

    await docRef.set(
      {
        owner_id: auth.uid,
        algorithmId,
        completed: completed || Boolean(existing.data()?.completed),
        timeSpentSeconds,
        updated_at: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("visualize progress POST", error);
    return NextResponse.json(
      { error: "Failed to save progress" },
      { status: 500 },
    );
  }
}
