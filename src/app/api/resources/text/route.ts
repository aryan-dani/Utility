import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { isAuthFailure, requireUser } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

const RESOURCE_ID_RE = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/i;

/** Read stored source/notebook text from Firestore. Never fetches Drive. */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (isAuthFailure(auth)) return auth;

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!RESOURCE_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const snap = await adminDb().collection("resource_previews").doc(id).get();
  const text = snap.exists ? snap.data()?.text : null;
  if (typeof text !== "string" || text.length === 0) {
    return NextResponse.json({ error: "No preview" }, { status: 404 });
  }

  return NextResponse.json(
    { text },
    {
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    },
  );
}
