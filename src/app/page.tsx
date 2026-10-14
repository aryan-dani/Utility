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
      {/* Hero */}
      <section className="w-full max-w-7xl mx-auto page-gutter pt-16 pb-12 sm:pt-24 sm:pb-20 md:pt-28 md:pb-24 flex flex-col items-center justify-center text-center relative md:min-h-[70vh]">
        <p className="font-display text-5xl sm:text-7xl md:text-8xl text-foreground tracking-tight mb-4 sm:mb-5">
          Utility OS
        </p>
        <h1 className="text-xl sm:text-3xl md:text-4xl font-semibold tracking-tight leading-snug mb-4 sm:mb-5 text-foreground max-w-2xl mx-auto">
          Everything for your semester.{" "}
          <span className="text-foreground-subtle font-medium">One place.</span>
        </h1>
        <p className="text-sm sm:text-base md:text-lg text-foreground-subtle mb-8 sm:mb-10 max-w-xl mx-auto leading-relaxed">
          A structured workspace for syllabi, course materials, planning, and AI
          study help. Built for MIT-WPU branches.
        </p>
        <div className="flex flex-col items-center gap-4">
          <div className="flex justify-center">
            <AuthButtons />
          </div>
          <HomeExamCountdown />
        </div>
      </section>

      <HomeCockpit />

      {/* Full-width heatmap */}
      <section className="w-full max-w-7xl mx-auto page-gutter py-4 sm:py-10 min-w-0">
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
