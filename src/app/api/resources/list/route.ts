import { NextResponse } from "next/server";
import { getWorkspaceList } from "@/lib/dataFetcher";
import { resolveWorkspace } from "@/lib/workspace";

/**
 * Shared catalog for a year/branch/semester — identical for every student.
 * Public + CDN-cached; AuthGate still requires sign-in for the Resources UI.
 */
export const dynamic = "force-dynamic";

const PUBLIC_CATALOG_CACHE =
  "public, s-maxage=86400, stale-while-revalidate=86400";

function isQuotaExhausted(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: number | string; details?: string; message?: string };
  const code = err.code;
  if (code === 8 || code === "8" || code === "resource-exhausted") return true;
  const text = `${err.details ?? ""} ${err.message ?? ""}`;
  return /RESOURCE_EXHAUSTED|Quota exceeded/i.test(text);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { academicYear, branch, semester } = resolveWorkspace({
      year: searchParams.get("year"),
      branch: searchParams.get("branch"),
      semester: searchParams.get("semester"),
    });

    const { resources, syllabusUrl } = await getWorkspaceList(
      academicYear,
      branch,
      semester,
    );

    return NextResponse.json(
      { resources, syllabusUrl },
      {
        headers: {
          "Cache-Control": PUBLIC_CATALOG_CACHE,
        },
      },
    );
  } catch (error: unknown) {
    console.error("Error fetching resources:", error);
    if (isQuotaExhausted(error)) {
      return NextResponse.json(
        {
          error:
            "Resources are temporarily unavailable (database quota). Try again later.",
        },
        {
          status: 503,
          headers: {
            "Retry-After": "300",
            "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30",
          },
        },
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch resources" },
      { status: 500 },
    );
  }
}
