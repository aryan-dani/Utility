import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/apiAuth";
import { parseDestinationBody, resolveUploadOrigin } from "@/lib/adminDriveServer";
import {
  getWritableDrive,
  getWritableDriveAccessToken,
  hasWritableDriveOAuth,
} from "../../../../../../runtime/lib/drive.mjs";
import {
  findChildFile,
  resolveFolderPath,
} from "../../../../../../runtime/lib/driveTree.mjs";

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

  const origin = resolveUploadOrigin(request);
  if (!origin) {
    return NextResponse.json(
      { error: "Missing or disallowed Origin for resumable upload." },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = parseDestinationBody(body);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid destination" },
      { status: 400 },
    );
  }

  try {
    const drive = getWritableDrive();
    const { folderId, path: destPath } = await resolveFolderPath(
      parsed.destPath,
      { create: true, drive },
    );

    const existing = await findChildFile(parsed.remoteName, folderId, {
      drive,
    });
    if (existing?.id && !parsed.overwrite) {
      return NextResponse.json(
        {
          error: "A file with this name already exists.",
          code: "exists",
          existingId: existing.id,
          remoteName: parsed.remoteName,
          destPath,
        },
        { status: 409 },
      );
    }

    const accessToken = await getWritableDriveAccessToken();
    const uploadUrl = existing?.id
      ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existing.id)}?uploadType=resumable&supportsAllDrives=true`
      : "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true";

    const initRes = await fetch(uploadUrl, {
      method: existing?.id ? "PATCH" : "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": parsed.mimeType,
        "X-Upload-Content-Length": String(parsed.size),
        Origin: origin,
      },
      body: existing?.id
        ? JSON.stringify({ name: parsed.remoteName })
        : JSON.stringify({
            name: parsed.remoteName,
            parents: [folderId],
          }),
    });

    if (!initRes.ok) {
      const detail = await initRes.text();
      console.error("Drive resumable init failed:", initRes.status, detail);
      return NextResponse.json(
        { error: "Failed to start Drive upload session." },
        { status: 502 },
      );
    }

    const sessionUrl = initRes.headers.get("location");
    if (!sessionUrl) {
      return NextResponse.json(
        { error: "Drive did not return an upload session URL." },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        sessionUrl,
        destPath,
        remoteName: parsed.remoteName,
        fullPath: `${destPath}/${parsed.remoteName}`,
        overwrite: Boolean(existing?.id),
        existingId: existing?.id ?? null,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error: unknown) {
    console.error("admin drive session failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create upload session",
      },
      { status: 500 },
    );
  }
}
