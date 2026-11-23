import { NextResponse } from "next/server";
import { isAuthFailure, requireAdmin } from "@/lib/apiAuth";
import {
  hasWritableDriveOAuth,
  getWritableDrive,
} from "../../../../../../runtime/lib/drive.mjs";
import {
  FOLDER_MIME,
  getRootFolderId,
  listChildren,
  resolveFolderPath,
} from "../../../../../../runtime/lib/driveTree.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function normalizeRelativePath(raw: string): string {
  return String(raw || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean)
    .join("/");
}

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (isAuthFailure(auth)) return auth;

  if (!hasWritableDriveOAuth()) {
    return NextResponse.json(
      { error: "Drive upload OAuth is not configured on this host." },
      { status: 503 },
    );
  }

  try {
    const path = normalizeRelativePath(
      new URL(request.url).searchParams.get("path") ?? "",
    );
    const drive = getWritableDrive();
    const rootId = getRootFolderId();
    const folderId = path
      ? (
          await resolveFolderPath(path, {
            create: false,
            drive,
          })
        ).folderId
      : rootId;

    const children = await listChildren(folderId, {
      drive,
      fields: "id, name, mimeType, modifiedTime, size",
    });

    const items = children.map(
      (file: {
        id?: string | null;
        name?: string | null;
        mimeType?: string | null;
        modifiedTime?: string | null;
        size?: string | null;
      }) => {
        const isFolder = file.mimeType === FOLDER_MIME;
        return {
          id: file.id || "",
          name: file.name || "",
          isFolder,
          modifiedTime: file.modifiedTime || null,
          size: isFolder ? null : Number(file.size || 0) || null,
          path: path ? `${path}/${file.name}` : file.name || "",
        };
      },
    );

    return NextResponse.json(
      { path, items },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to list Drive folder";
    console.error("admin drive list failed:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
