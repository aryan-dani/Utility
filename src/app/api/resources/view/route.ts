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

    // 2. Fetch the file media stream from Google Drive
    const res = await drive.files.get(
      {
        fileId: fileId,
        alt: "media",
      },
      { responseType: "stream" }
    );

    // Convert node stream to readable stream for Next.js response
    const stream = res.data as any;

    const headers = new Headers();
    headers.set("Content-Type", mimeType);
    headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(fileName)}"`);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    
    if (fileMetadata.data.size) {
      headers.set("Content-Length", fileMetadata.data.size);
    }

    return new NextResponse(stream, {
      status: 200,
      headers: headers,
    });
  } catch (error: any) {
    console.error("Error streaming file from Google Drive:", error);
    return new NextResponse(error.message || "Failed to stream file", { status: 500 });
  }
}
