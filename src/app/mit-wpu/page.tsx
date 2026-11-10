import type { Metadata } from "next";
import Link from "next/link";
import { BRANCHES, SEMESTERS } from "@/lib/academic/scope";
import {
  branchLabel,
  branchSlug,
  MIT_WPU_YEAR,
} from "@/lib/mitWpuCatalog";
import { absoluteUrl, jsonLdScript, SITE_NAME } from "@/lib/seo";
import { MitWpuPage, MitWpuSignInCta } from "@/components/seo/MitWpuChrome";

export const revalidate = 86400;

const title = "MIT-WPU study workspace — syllabus, notes, GPA";
const description =
  "Browse MIT-WPU AIDS, CSE, and ECE syllabus indexes and study resource titles by semester. Free GPA calculator, algorithm visualizer, and signed-in planner and Ask AI.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl("/mit-wpu") },
  openGraph: {
    title: `${title} | ${SITE_NAME}`,
    description,
    url: absoluteUrl("/mit-wpu"),
  },
};

export default function MitWpuHubPage() {
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "MIT-WPU", path: "/mit-wpu" },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: absoluteUrl("/mit-wpu"),
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl("/") },
  };

  return (
    <MitWpuPage crumbs={crumbs}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
        MIT World Peace University · {MIT_WPU_YEAR}
      </p>
      <h1 className="font-display text-3xl sm:text-4xl tracking-tight text-foreground mb-3">
        MIT-WPU study workspace
      </h1>
      <p className="text-base text-muted leading-relaxed mb-8 max-w-2xl">
        Utility OS is a free academic workspace for MIT-WPU students — not the
        official ERP or ILIP attendance app. Use these public indexes to find
        syllabus topics and resource titles, then sign in to open files, Ask AI
        grounded in your materials, and plan the week.
      </p>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Browse by branch
        </h2>
        <ul className="grid gap-3 sm:grid-cols-3">
          {BRANCHES.map((branch) => (
            <li key={branch}>
              <Link
                href={`/mit-wpu/${branchSlug(branch)}`}
                className="block rounded-2xl border border-border bg-card px-4 py-4 hover:bg-surface transition-colors"
              >
                <span className="font-semibold text-foreground">{branch}</span>
                <span className="block text-sm text-muted mt-1">
                  {branchLabel(branch)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Public tools
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2 text-sm">
          <li>
            <Link className="underline-offset-2 hover:underline font-medium" href="/gpa">
              MIT-WPU GPA / SGPA / CGPA calculator
            </Link>
          </li>
          <li>
            <Link className="underline-offset-2 hover:underline font-medium" href="/visualize">
              Algorithm visualizer
            </Link>
          </li>
          <li>
            <Link className="underline-offset-2 hover:underline font-medium" href="/mit-wpu/study-planner">
              Study planner
            </Link>
          </li>
          <li>
            <Link className="underline-offset-2 hover:underline font-medium" href="/mit-wpu/ask-ai">
              Ask AI for syllabus
            </Link>
          </li>
          <li>
            <Link className="underline-offset-2 hover:underline font-medium" href="/mit-wpu/flashcards">
              SRS flashcards
            </Link>
          </li>
          <li>
            <Link className="underline-offset-2 hover:underline font-medium" href="/mit-wpu/focus-timer">
              Focus timer
            </Link>
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Semesters covered
        </h2>
        <p className="text-sm text-muted mb-3">
          Each branch lists semesters {SEMESTERS[0]}–{SEMESTERS[SEMESTERS.length - 1]}.
          AIDS Semesters 3–5 include unit-level outlines written for Utility;
          other pages list catalog subjects and resource titles only.
        </p>
      </section>

      <MitWpuSignInCta />
    </MitWpuPage>
  );
}
