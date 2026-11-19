import type { MetadataRoute } from "next";
import { BRANCHES } from "@/lib/academic/scope";
import {
  branchSlug,
  mitWpuSemesterPaths,
  mitWpuSubjectPaths,
} from "@/lib/mitWpuCatalog";
import { absoluteUrl, sitemapEntries } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const today = "2026-11-19";
  const base = sitemapEntries();

  const branchPages: MetadataRoute.Sitemap = BRANCHES.map((branch) => ({
    url: absoluteUrl(`/mit-wpu/${branchSlug(branch)}`),
    lastModified: today,
    changeFrequency: "weekly" as const,
    priority: 0.85,
  }));

  let semesters: MetadataRoute.Sitemap = [];
  try {
    const params = await mitWpuSemesterPaths();
    semesters = params.map((entry) => ({
      url: absoluteUrl(`/mit-wpu/${entry.branch}/semester/${entry.n}`),
      lastModified: today,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    semesters = [];
  }

  let subjects: MetadataRoute.Sitemap = [];
  try {
    const params = await mitWpuSubjectPaths();
    subjects = params.map((entry) => ({
      url: absoluteUrl(
        `/mit-wpu/${entry.branch}/semester/${entry.semester}/${entry.subject}`,
      ),
      lastModified: today,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    subjects = [];
  }

  const visualizeAlgos = [
    "bfs",
    "dfs",
    "ucs",
    "greedy-bfs",
    "a-star",
    "hill-climbing",
    "genetic-algorithm",
    "minimax",
    "alpha-beta",
    "n-queens",
  ].map((id) => ({
    url: absoluteUrl(`/visualize/${id}`),
    lastModified: today,
    changeFrequency: "monthly" as const,
    priority: 0.65,
  }));

  const seen = new Set<string>();
  return [
    ...base,
    ...branchPages,
    ...semesters,
    ...subjects,
    ...visualizeAlgos,
  ].filter((entry) => {
    if (seen.has(entry.url)) return false;
    seen.add(entry.url);
    return true;
  });
}
