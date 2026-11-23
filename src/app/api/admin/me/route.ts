import { NextResponse } from "next/server";
import { isAdminUser, isAuthFailure, requireUser } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (isAuthFailure(auth)) return auth;

  return NextResponse.json(
    { isAdmin: isAdminUser(auth), email: auth.email },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
