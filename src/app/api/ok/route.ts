import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Tiny reachability probe for the campus-host fallback. JSON only. */
export async function GET() {
  return NextResponse.json(
    { ok: true },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
