import { NextResponse } from "next/server";
import { getAdminEmails, isAuthFailure, requireUser } from "@/lib/apiAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (isAuthFailure(auth)) return auth;

  const email = auth.email?.toLowerCase() ?? "";
  const isAdmin = !!email && getAdminEmails().includes(email);

  return NextResponse.json(
    { isAdmin, email: auth.email },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
