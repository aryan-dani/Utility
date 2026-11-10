import type { MetadataRoute } from "next";
import { BRANCHES, SEMESTERS } from "@/lib/academic/scope";
import {
  branchSlug,
  mitWpuSubjectPaths,
} from "@/lib/mitWpuCatalog";
import { absoluteUrl, sitemapEntries } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const today = "2026-11-10";
  const base = sitemapEntries();

  const branchSemester: MetadataRoute.Sitemap = [];
  for (const branch of BRANCHES) {
    const b = branchSlug(branch);
    branchSemester.push({
      url: absoluteUrl(`/mit-wpu/${b}`),
      lastModified: today,
      changeFrequency: "weekly",
      priority: 0.85,
    });
    for (const semester of SEMESTERS) {
      branchSemester.push({
        url: absoluteUrl(`/mit-wpu/${b}/semester/${semester}`),
        lastModified: today,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
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
  return [...base, ...branchSemester, ...subjects, ...visualizeAlgos].filter(
    (entry) => {
      if (seen.has(entry.url)) return false;
      seen.add(entry.url);
      return true;
    },
  );
}
