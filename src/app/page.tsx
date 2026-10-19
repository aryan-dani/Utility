import type { Metadata } from "next";
import AuthButtons from "./AuthButtons";
import HomeHeatmap from "./HomeHeatmap";
import HomeStats from "./HomeStats";
import HomeExamCountdown from "@/components/HomeExamCountdown";
import { HomeCockpit } from "@/components/home/HomeCockpit";
import { getHomeStats } from "@/lib/dataFetcher";
import { BRANCHES, SEMESTERS } from "@/lib/academic/scope";
import { homeJsonLd, indexableMeta, jsonLdScript } from "@/lib/seo";

export const revalidate = 86400;
export const metadata: Metadata = indexableMeta("/");

export default async function Home() {
  let subjectCount = 0;
  let resourceCount = 0;
  let branchCount: number = BRANCHES.length;
  let semesterCount: number = SEMESTERS.length;
  try {
    const globalStats = await getHomeStats();
    if (globalStats) {
      subjectCount = globalStats.subjects;
      resourceCount = globalStats.resources;
      branchCount = globalStats.branches || BRANCHES.length;
      semesterCount = globalStats.semesters || SEMESTERS.length;
    }
  } catch (err) {
    console.error("HomeStats fetch failed:", err);
  }

  return (
    <div className="flex-1 w-full flex flex-col relative overflow-x-clip">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(homeJsonLd()) }}
      />
      {/* Hero — compact so the cockpit reads as the workspace, not a second landing */}
      <section className="w-full max-w-7xl mx-auto page-gutter pt-10 pb-6 sm:pt-14 sm:pb-8 flex flex-col items-center text-center">
        <p className="font-display text-4xl sm:text-5xl md:text-6xl text-foreground tracking-tight mb-3">
          Utility OS
        </p>
        <h1 className="text-base sm:text-lg md:text-xl font-medium tracking-tight leading-snug mb-5 text-foreground-subtle max-w-xl mx-auto">
          Everything for your semester. One place.
        </h1>
        <div className="flex flex-col items-center gap-3">
          <AuthButtons />
          <HomeExamCountdown />
        </div>
      </section>

      <HomeCockpit />

      <section className="w-full max-w-7xl mx-auto page-gutter pb-8 sm:pb-12 min-w-0">
        <HomeHeatmap />
      </section>

      <HomeStats
        subjects={subjectCount}
        resources={resourceCount}
        semesters={semesterCount}
        branches={branchCount}
      />
    </div>
  );
}
