import { NextResponse } from "next/server";
import { webAppOriginAssociation } from "@/lib/siteOrigins";

export const dynamic = "force-static";

/** Two-way handshake for PWA `scope_extensions` (apex ↔ www ↔ campus host). */
export function GET() {
  return NextResponse.json(webAppOriginAssociation(), {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=86400",
    },
  });
}
