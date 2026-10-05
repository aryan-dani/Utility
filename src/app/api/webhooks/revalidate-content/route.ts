import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { safeEqualSecret } from "@/lib/safeEqual";

export const dynamic = "force-dynamic";

async function isAuthorized(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  const bearer =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && bearer && safeEqualSecret(bearer, cronSecret)) return true;
  // Local next dev only: allow missing CRON_SECRET when not on Vercel
  if (!cronSecret && !process.env.VERCEL) return true;
  return false;
}

/** Called by GitHub Actions after Drive sync + indexing to refresh cached pages. */
export async function POST(request: Request) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  revalidateTag("subjects", "max");
  revalidateTag("resources", "max");
  revalidateTag("syllabus", "max");
  // Bust the public CDN-cached catalog route (year/branch/semester query variants).
  revalidatePath("/api/resources/list");

  return NextResponse.json({
    success: true,
    revalidated: ["subjects", "resources", "syllabus", "/api/resources/list"],
  });
}
