import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { isAuthFailure, requireUser } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

const RESOURCE_ID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/i;

/** Matches runtime/lib/resourcePreview.mjs PREVIEW_MAX_BYTES — keep in sync. */
const PREVIEW_MAX_CHARS = 64 * 1024;

/** Read stored source/notebook text from Firestore. Never fetches Drive. */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (isAuthFailure(auth)) return auth;

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!RESOURCE_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const snap = await adminDb().collection("resource_previews").doc(id).get();
  const raw = snap.exists ? snap.data()?.text : null;
  if (typeof raw !== "string" || raw.length === 0) {
    return NextResponse.json({ error: "No preview" }, { status: 404 });
  }

  const text =
    raw.length > PREVIEW_MAX_CHARS ? raw.slice(0, PREVIEW_MAX_CHARS) : raw;

  return NextResponse.json(
    { text },
    {
      headers: {
        "Cache-Control": "private, max-age=86400",
      },
    },
  );
}
