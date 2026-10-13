import type { Metadata, MetadataRoute } from "next";
import { CANONICAL_ORIGIN } from "@/lib/siteOrigins";
import publicPagesJson from "@/lib/publicPages.json";

export const SITE_NAME = "Utility OS";
export const SITE_TITLE = "Utility OS — MIT-WPU study workspace";
/** Microsoft Store listing that already ranks for this name. */
export const MICROSOFT_STORE_URL =
  "https://apps.microsoft.com/detail/9PPFG0G5R0MG";

export const ROBOTS_DISALLOW = [
  "/admin",
  "/api/",
  "/login",
  "/signup",
  "/profile",
] as const;

/** Signed-in shells, auth screens, admin, and offline. Crawlers may fetch these so noindex can drop them. */
export const PRIVATE_ROBOTS: NonNullable<Metadata["robots"]> = {
  index: false,
  follow: false,
};

type ChangeFrequency = NonNullable<
  MetadataRoute.Sitemap[number]["changeFrequency"]
>;

export type PublicPage = {
  path: string;
  title: string;
  description: string;
  changeFrequency: ChangeFrequency;
  priority: number;
  lastModified: string;
};

export const PUBLIC_PAGES = publicPagesJson as readonly PublicPage[];
export const SITE_DESCRIPTION = publicPage("/").description;

export function absoluteUrl(path: string): string {
  if (path === "/") return CANONICAL_ORIGIN;
  return `${CANONICAL_ORIGIN}${path}`;
}

export function publicPage(path: string): PublicPage {
  const page = PUBLIC_PAGES.find((entry) => entry.path === path);
  if (!page) throw new Error(`Unknown public page: ${path}`);
  return page;
}

/** Canonical, description, and Open Graph URL for one indexable page. */
export function indexableMeta(path: string): Metadata {
  const page = publicPage(path);
  const title = path === "/" ? SITE_TITLE : `${page.title} | ${SITE_NAME}`;
  const url = absoluteUrl(path);
  return {
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      url,
      title,
      description: page.description,
    },
  };
}

export function sitemapEntries(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map((page) => ({
    url: absoluteUrl(page.path),
    lastModified: page.lastModified,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}

export function homeJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: SITE_NAME,
        alternateName: "Utility",
        url: CANONICAL_ORIGIN,
        description: SITE_DESCRIPTION,
      },
      {
        "@type": "SoftwareApplication",
        name: SITE_NAME,
        alternateName: "Utility",
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        url: CANONICAL_ORIGIN,
        sameAs: MICROSOFT_STORE_URL,
        description: SITE_DESCRIPTION,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "INR",
        },
      },
    ],
  };
}

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function llmsTxt(): string {
  const links = PUBLIC_PAGES.map(
    (page) => `- [${page.title}](${absoluteUrl(page.path)}): ${page.description}`,
  );
  return [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    "Utility OS is a student workspace for MIT-WPU branches AIDS, CSE, and ECE. It is not utility billing or operating-system utility software. The pages linked below are public.",
    "",
    "## Public pages",
    "",
    ...links,
    "",
    "## Signed-in tools",
    "",
    "The resource vault, Ask AI, syllabus tracker, study planner, GPA calculator, focus timer, flashcards, doubt board, clipboard, and community require a student account and are not public documents.",
    "",
  ].join("\n");
}

/** HTML-tag verification. Omitted until the console tokens are set. */
export function searchVerification(): Metadata["verification"] | undefined {
  const google = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();
  const bing = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION?.trim();
  if (!google && !bing) return undefined;
  return {
    ...(google ? { google } : {}),
    ...(bing ? { other: { "msvalidate.01": bing } } : {}),
  };
}
