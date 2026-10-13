import type { MetadataRoute } from "next";
import { CANONICAL_ORIGIN } from "@/lib/siteOrigins";
import { ROBOTS_DISALLOW } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...ROBOTS_DISALLOW],
      },
    ],
    sitemap: `${CANONICAL_ORIGIN}/sitemap.xml`,
  };
}
