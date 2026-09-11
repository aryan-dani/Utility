import type { MetadataRoute } from "next";

const BASE = "https://utilityos.tech";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/resources",
    "/ask",
    "/syllabus",
    "/visualize",
    "/visualize/progress",
    "/campus",
    "/campus/directory",
    "/campus/labs",
    "/campus/seating",
    "/planner",
    "/timer",
    "/gpa",
    "/srs",
    "/community",
    "/install",
    "/support",
    "/privacy",
    "/account/delete",
  ];

  const now = new Date();
  return routes.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: path === "" || path === "/resources" ? "daily" : "weekly",
    priority: path === "" ? 1 : path === "/resources" || path === "/ask" ? 0.9 : 0.6,
  }));
}
