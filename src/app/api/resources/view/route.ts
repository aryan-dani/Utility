import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get("id");

  if (!fileId) {
    return new NextResponse("Missing file id", { status: 400 });
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    return new NextResponse("Missing environment variables", { status: 500 });
  }

  // Clean private key formatting
  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, '\n');

  try {
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    const drive = google.drive({ version: "v3", auth });

    // 1. Retrieve file metadata to determine MIME type and size
    const fileMetadata = await drive.files.get({
      fileId: fileId,
      fields: "name, mimeType, size",
    });

    const mimeType = fileMetadata.data.mimeType || "application/octet-stream";
    const fileName = fileMetadata.data.name || "file";

    const clientRange = request.headers.get("range");
    const driveOptions: any = { responseType: "stream" };
    if (clientRange) {
      driveOptions.headers = { Range: clientRange };
    }

    // 2. Fetch the file media stream from Google Drive
    const res = await drive.files.get(
      {
        fileId: fileId,
        alt: "media",
      },
      driveOptions
    );

    // Convert node stream to readable stream for Next.js response
    const stream = res.data as any;

    const headers = new Headers();
    headers.set("Content-Type", mimeType);
    headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(fileName)}"`);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("Accept-Ranges", "bytes");
    
    // Forward progressive range headers from Drive API response if present
    if (res.headers["content-range"]) {
      headers.set("Content-Range", res.headers["content-range"]);
    }
    if (res.headers["content-length"]) {
      headers.set("Content-Length", res.headers["content-length"]);
    } else if (fileMetadata.data.size && !clientRange) {
      headers.set("Content-Length", fileMetadata.data.size);
    }

    const status = res.status || (clientRange ? 206 : 200);

    return new NextResponse(stream, {
      status,
      headers,
    });
  } catch (error: any) {
    console.error("Error streaming file from Google Drive:", error);
    return new NextResponse(error.message || "Failed to stream file", { status: 500 });
  }
}
