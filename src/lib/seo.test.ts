import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PUBLIC_PAGES,
  ROBOTS_DISALLOW,
  SITE_DESCRIPTION,
  absoluteUrl,
  homeJsonLd,
  llmsTxt,
  searchVerification,
  sitemapEntries,
} from "./seo";

const SIGNED_IN = ["/resources", "/ask", "/syllabus", "/planner", "/login"];

describe("public SEO pages", () => {
  it("lists only crawlable URLs, including support", () => {
    const paths = PUBLIC_PAGES.map((page) => page.path);
    expect(paths[0]).toBe("/");
    expect(paths).toContain("/support");
    expect(paths).toContain("/campus/directory");
    for (const signedIn of SIGNED_IN) {
      expect(paths).not.toContain(signedIn);
    }
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("builds apex sitemap URLs with a fixed lastModified", () => {
    const entries = sitemapEntries();
    expect(entries.map((entry) => entry.url)).toEqual(
      PUBLIC_PAGES.map((page) => absoluteUrl(page.path)),
    );
    expect(entries[0]?.url).toBe("https://utilityos.tech");
    expect(entries.every((entry) => entry.lastModified === "2026-10-13")).toBe(
      true,
    );
  });

  it("keeps admin and auth out of the crawl disallow that would hide noindex", () => {
    expect(ROBOTS_DISALLOW).toEqual([
      "/admin",
      "/api/",
      "/login",
      "/signup",
      "/profile",
    ]);
    expect(ROBOTS_DISALLOW).not.toContain("/resources");
  });

  it("writes llms.txt with public links and a signed-in boundary", () => {
    const text = llmsTxt();
    expect(text.startsWith("# Utility OS\n")).toBe(true);
    expect(text).toContain(SITE_DESCRIPTION);
    for (const page of PUBLIC_PAGES) {
      expect(text).toContain(absoluteUrl(page.path));
    }
    expect(text).toContain("are not public documents");
    expect(text).not.toContain("/resources");
    expect(text).not.toContain("/ask");
  });

  it("describes the site in JSON-LD without ratings", () => {
    const graph = homeJsonLd()["@graph"] as { "@type": string }[];
    expect(graph.map((node) => node["@type"])).toEqual([
      "WebSite",
      "SoftwareApplication",
    ]);
    expect(JSON.stringify(graph)).not.toContain("aggregateRating");
    expect(JSON.stringify(graph)).not.toContain("reviewCount");
  });

  it("omits search verification until tokens are set", () => {
    const google = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
    const bing = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION;
    delete process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
    delete process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION;
    expect(searchVerification()).toBeUndefined();
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION = "google-token";
    process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION = "bing-token";
    expect(searchVerification()).toEqual({
      google: "google-token",
      other: { "msvalidate.01": "bing-token" },
    });
    if (google === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
    else process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION = google;
    if (bing === undefined) delete process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION;
    else process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION = bing;
  });

  it("hosts one IndexNow key file whose body matches its name", () => {
    const dir = path.join(process.cwd(), "public");
    const keys = readdirSync(dir).filter((name) =>
      /^[a-f0-9]{32}\.txt$/.test(name),
    );
    expect(keys).toEqual(["b7e4c91a2f6d4083e5c17a9d0b8f3e26.txt"]);
    const body = readFileSync(path.join(dir, keys[0]!), "utf8").trim();
    expect(body).toBe("b7e4c91a2f6d4083e5c17a9d0b8f3e26");
  });
});
