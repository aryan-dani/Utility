import AppLink from "@/components/ui/AppLink";
import {
  CalendarCheck,
  BookOpen,
  FileText,
  ArrowRight,
  Brain,
  ShieldCheck,
  Layers,
  Building2,
  Waypoints,
} from "lucide-react";
import AuthButtons from "./AuthButtons";
import HomeHeatmap from "./HomeHeatmap";
import HomeStats from "./HomeStats";
import HomeExamCountdown from "@/components/HomeExamCountdown";
import { getResourcesFromDB, getSubjectsFromDB, getHomeStats } from "@/lib/dataFetcher";
import { BRANCHES, SEMESTERS } from "@/lib/academic/scope";
import {
  DEFAULT_ACADEMIC_YEAR,
  DEFAULT_SEMESTER,
} from "@/lib/workspace";

export const revalidate = 86400;

const FLOW = [
  { href: "/syllabus", title: "Syllabus", hint: "Units & topics" },
  { href: "/resources", title: "Vault", hint: "Notes & files" },
  { href: "/ask", title: "Ask AI", hint: "Grounded answers" },
  { href: "/planner", title: "Planner", hint: "Deadlines" },
] as const;

const FEATURES = [
  {
    href: "/planner",
    label: "Study Planner",
    number: "01",
    Icon: CalendarCheck,
    description:
      "Organize your month with natural-language prompts. Share & collaborate with peers.",
  },
  {
    href: "/ask",
    label: "Ask AI",
    number: "02",
    Icon: Brain,
    description:
      "Get instant explanations, flashcards, and study help powered by Groq.",
  },
  {
    href: "/syllabus",
    label: "Syllabus",
    number: "03",
    Icon: BookOpen,
    description:
      "Clear breakdown of every subject, unit by unit. Download full PDFs instantly.",
  },
  {
    href: "/resources",
    label: "Resources",
    number: "04",
    Icon: FileText,
    description:
      "Browse by subject → assignment folders (notebooks, datasets, writeups together). Notes are reference-only.",
  },
  {
    href: "/visualize",
    label: "Visualize",
    number: "05",
    Icon: Waypoints,
    description:
      "Watch BFS, A*, Minimax, and N-Queens decide one step at a time.",
  },
  {
    href: "/gpa",
    label: "GPA Calc",
    number: "06",
    Icon: ShieldCheck,
    description:
      "Calculate your SGPA and CGPA with auto-populated subjects from the database.",
  },
  {
    href: "/srs",
    label: "SRS Cards",
    number: "07",
    Icon: Layers,
    description:
      "Active Leitner spacing system. Review cards to lock them in long-term memory.",
  },
  {
    href: "/campus",
    label: "Campus",
    number: "08",
    Icon: Building2,
    description:
      "Faculty seating, staff directory, and lab registry. Live from campus data.",
  },
];

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
    } else {
      const year = DEFAULT_ACADEMIC_YEAR;
      const semester = DEFAULT_SEMESTER;
      const results = await Promise.all(
        BRANCHES.map(async (branch) => {
          const [subjects, resources] = await Promise.all([
            getSubjectsFromDB(year, branch, semester),
            getResourcesFromDB(year, branch, semester),
          ]);
          return {
            subjects: subjects.length,
            resources: resources.length,
          };
        }),
      );
      subjectCount = results.reduce((sum, r) => sum + r.subjects, 0);
      resourceCount = results.reduce((sum, r) => sum + r.resources, 0);
    }
  } catch (err) {
    console.error("HomeStats fetch failed:", err);
  }

  return (
    <div className="flex-1 w-full flex flex-col relative overflow-x-clip">
      {/* Hero grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(var(--foreground)/0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgb(var(--foreground)/0.06)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none -z-20" />

      {/* Hero */}
      <section className="w-full max-w-7xl mx-auto page-gutter pt-16 pb-12 sm:pt-24 sm:pb-20 md:pt-28 md:pb-24 flex flex-col items-center justify-center text-center relative md:min-h-[70vh]">
        <p className="font-display text-5xl sm:text-7xl md:text-8xl text-foreground tracking-tight mb-4 sm:mb-5">
          Utility
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

      <div className="w-full border-t border-border" />

      {/* How it connects */}
      <section className="w-full max-w-7xl mx-auto page-gutter py-8 sm:py-10">
        <p className="text-center text-xs sm:text-sm text-foreground-subtle mb-4 font-medium tracking-wide uppercase">
          How everything links
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden border border-border bg-border shadow-sm">
          {FLOW.map(({ href, title, hint }, index) => (
            <AppLink
              key={href}
              href={href}
              className="group bg-card hover:bg-surface active:bg-surface-hover p-4 sm:p-5 min-h-[5.5rem] flex flex-col justify-between gap-3 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-muted">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="text-xs text-muted mt-0.5">{hint}</p>
              </div>
            </AppLink>
          ))}
        </div>
      </section>

      {/* Feature cards */}
      <section className="w-full max-w-7xl mx-auto page-gutter pb-12 sm:pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border shadow-sm">
          {FEATURES.map(({ href, label, number, Icon, description }) => (
            <AppLink
              key={href}
              href={href}
              className="group block bg-card hover:bg-surface card-premium-hover transition-all duration-300"
            >
              <div className="p-6 sm:p-7 h-full flex flex-col gap-6 relative">
                <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r bg-primary scale-y-0 group-hover:scale-y-100 transition-transform duration-300 origin-center" />

                <div className="flex items-start justify-between">
                  <div className="w-11 h-11 rounded-xl bg-surface border border-border flex items-center justify-center group-hover:scale-105 group-hover:border-border-strong transition-all duration-300">
                    <Icon className="w-5 h-5 text-foreground" />
                  </div>
                  <span className="text-xs font-mono text-foreground-subtle group-hover:text-foreground/70 transition-colors">
                    {number}
                  </span>
                </div>

                <div className="flex-1">
                  <h2 className="text-base font-semibold text-foreground mb-2">
                    {label}
                  </h2>
                  <p className="text-sm text-foreground-subtle leading-relaxed">
                    {description}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground-subtle group-hover:text-foreground transition-colors">
                  <span className="animated-underline">Open {label}</span>
                  <ArrowRight className="w-3 h-3 translate-x-0 group-hover:translate-x-1.5 transition-transform duration-300" />
                </div>
              </div>
            </AppLink>
          ))}
        </div>
      </section>

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
