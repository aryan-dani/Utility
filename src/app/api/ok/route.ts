import { NextResponse } from "next/server";

/**
 * Legacy probe kept for old cached clients. Prefer static /ok.txt (no Function).
 * Short CDN cache so this is cheap if anything still calls it.
 */
export async function GET() {
  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
