import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isAuthFailure, requireAdmin } from "@/lib/apiAuth";
import {
  assertCanonicalDestPath,
  buildAdminDestPath,
  type AdminUploadCategory,
  type AdminUploadDestination,
} from "@/lib/adminDriveUpload";
import { hasWritableDriveOAuth } from "../../../../../../runtime/lib/drive.mjs";
import { upsertResources } from "../../../../../../runtime/lib/driveCatalog.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) return auth;

  if (!hasWritableDriveOAuth()) {
    return NextResponse.json(
      { error: "Drive upload OAuth is not configured on this host." },
      { status: 503 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fileId = String(body.fileId ?? "").trim();
  const remoteName = String(body.remoteName ?? "").trim();
  const updatedAt =
    String(body.updatedAt ?? "").trim() || new Date().toISOString();

  const dest: AdminUploadDestination = {
    year: String(body.year ?? "").trim(),
    branch: String(body.branch ?? "").trim(),
    semester: Number(body.semester),
    subject: String(body.subject ?? "").trim(),
    category: String(body.category ?? "").trim() as AdminUploadCategory,
  };

  if (!fileId || !remoteName) {
    return NextResponse.json(
      { error: "fileId and remoteName are required" },
      { status: 400 },
    );
  }

  let destPath: string;
  try {
    destPath = buildAdminDestPath(dest);
    if (body.destPath != null && String(body.destPath).trim()) {
      assertCanonicalDestPath(String(body.destPath).trim(), dest);
    }
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid destination" },
      { status: 400 },
    );
  }

  try {
    const fullPath = `${destPath}/${remoteName}`;
    const result = await upsertResources(
      [
        {
          id: fileId,
          name: remoteName,
          path: fullPath,
          updatedAt,
        },
      ],
      {
        dryRun: false,
        prune: false,
        updateStats: "bump",
        previews: false,
        verbose: false,
      },
    );

    revalidateTag("resources", "max");
    revalidateTag("subjects", "max");
    revalidateTag("syllabus", "max");
    revalidateTag("drive-allowlist", "max");

    return NextResponse.json(
      {
        success: true,
        destPath,
        fullPath,
        resourceIds: result.resourceIds,
        written: result.stats.resourcesWritten,
        skipped: result.stats.resourcesSkipped,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error: unknown) {
    console.error("admin drive commit failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to catalog upload",
      },
      { status: 500 },
    );
  }
}
