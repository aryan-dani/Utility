import { NextResponse } from "next/server";
import { adminDb, hasFirebaseCredentials } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

const RESOURCE_ID_RE =
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/i;

/** Matches runtime/lib/resourcePreview.mjs PREVIEW_MAX_BYTES — keep in sync. */
const PREVIEW_MAX_CHARS = 900 * 1024;

/**
 * Read stored source/notebook text from Firestore. Never fetches Drive.
 * Public: vault viewers are unsigned; this is JSON only under the size cap.
 */
export async function GET(request: Request) {
  if (!hasFirebaseCredentials()) {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!RESOURCE_ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
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
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      },
    );
  } catch (error) {
    console.error("resource preview read failed:", error);
    return NextResponse.json({ error: "Failed to load preview" }, { status: 500 });
  }
}
