import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/apiAuth";
import { proxyAdminGet } from "@/lib/homeProxy";

export const dynamic = "force-dynamic";

/** Admin overview. Computed on the home server from Postgres (Firestore counters are no longer updated). */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) return auth;

  const res = await proxyAdminGet(request, "/v1/admin/stats");
  if (!res) {
    return NextResponse.json(
      { error: "Home server unavailable. Usage stats need it." },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
  return new NextResponse(res.body, {
    status: res.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  });
}
