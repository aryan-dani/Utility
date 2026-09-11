import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebaseAdmin";
import { isAuthFailure, requireUser } from "@/lib/apiAuth";
import { SavedGridData } from "@/lib/visualize/grid";
import { enforceUserRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

const MAX_ROWS = 40;
const MAX_COLS = 40;
const MAX_WALLS = 800;

function isSavedGridData(value: unknown): value is SavedGridData {
  if (!value || typeof value !== "object") return false;
  const data = value as SavedGridData;
  if (
    typeof data.rows !== "number" ||
    typeof data.cols !== "number" ||
    data.startPos == null ||
    data.goalPos == null ||
    !Array.isArray(data.walls)
  ) {
    return false;
  }
  if (
    !Number.isInteger(data.rows) ||
    !Number.isInteger(data.cols) ||
    data.rows < 2 ||
    data.cols < 2 ||
    data.rows > MAX_ROWS ||
    data.cols > MAX_COLS ||
    data.walls.length > MAX_WALLS
  ) {
    return false;
  }
  const inBounds = (r: number, c: number) =>
    Number.isInteger(r) &&
    Number.isInteger(c) &&
    r >= 0 &&
    c >= 0 &&
    r < data.rows &&
    c < data.cols;
  if (!inBounds(data.startPos.row, data.startPos.col)) return false;
  if (!inBounds(data.goalPos.row, data.goalPos.col)) return false;
  for (const w of data.walls) {
    if (!w || !inBounds(w.row, w.col)) return false;
  }
  return true;
}

export async function GET(request: Request) {
  try {
    const auth = await requireUser(request);
    if (isAuthFailure(auth)) return auth;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const db = adminDb();

    if (id) {
      const snap = await db.collection("visualize_grids").doc(id).get();
      if (!snap.exists) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const data = snap.data()!;
      if (data.owner_id !== auth.uid) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json(
        {
          grid: {
            id: snap.id,
            name: data.name,
            gridData: data.gridData,
            created_at: data.created_at?.toDate?.()?.toISOString?.() ?? null,
          },
        },
        { headers: PRIVATE_NO_STORE },
      );
    }

    const snapshot = await db
      .collection("visualize_grids")
      .where("owner_id", "==", auth.uid)
      .limit(100)
      .get();

    const grids = snapshot.docs
      .map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name as string,
          gridData: data.gridData as SavedGridData,
          created_at: data.created_at?.toDate?.()?.toISOString?.() ?? null,
        };
      })
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

    return NextResponse.json({ grids }, { headers: PRIVATE_NO_STORE });
  } catch (error) {
    console.error("visualize grids GET", error);
    return NextResponse.json({ error: "Failed to load mazes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (isAuthFailure(auth)) return auth;

    const rate = await enforceUserRateLimit(auth.uid, "visualize-grids", 30, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const body = await request.json();
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim().slice(0, 80)
        : "Custom maze";
    if (!isSavedGridData(body.gridData)) {
      return NextResponse.json({ error: "Invalid grid data" }, { status: 400 });
    }

    const db = adminDb();
    const ref = db.collection("visualize_grids").doc();
    await ref.set({
      owner_id: auth.uid,
      name,
      gridData: body.gridData,
      created_at: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ id: ref.id });
  } catch (error) {
    console.error("visualize grids POST", error);
    return NextResponse.json({ error: "Failed to save maze" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireUser(request);
    if (isAuthFailure(auth)) return auth;

    const rate = await enforceUserRateLimit(auth.uid, "visualize-grids", 30, 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const db = adminDb();
    const ref = db.collection("visualize_grids").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (snap.data()?.owner_id !== auth.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("visualize grids DELETE", error);
    return NextResponse.json({ error: "Failed to delete maze" }, { status: 500 });
  }
}
