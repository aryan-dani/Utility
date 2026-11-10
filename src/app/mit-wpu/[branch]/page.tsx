import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BRANCHES, SEMESTERS } from "@/lib/academic/scope";
import {
  branchLabel,
  branchSlug,
  MIT_WPU_YEAR,
  parseBranchParam,
} from "@/lib/mitWpuCatalog";
import { absoluteUrl, jsonLdScript, SITE_NAME } from "@/lib/seo";
import { MitWpuPage, MitWpuSignInCta } from "@/components/seo/MitWpuChrome";

export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return BRANCHES.map((branch) => ({ branch: branchSlug(branch) }));
}

type Props = { params: Promise<{ branch: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { branch: raw } = await params;
  const branch = parseBranchParam(raw);
  if (!branch) return {};
  const title = `MIT-WPU ${branch} syllabus and study resources`;
  const description = `Semester indexes for MIT-WPU ${branchLabel(branch)} (${branch}): subject lists, resource titles, and links to GPA and study tools on Utility OS.`;
  const path = `/mit-wpu/${branchSlug(branch)}`;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(path) },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      url: absoluteUrl(path),
    },
  };
}

export default async function MitWpuBranchPage({ params }: Props) {
  const { branch: raw } = await params;
  const branch = parseBranchParam(raw);
  if (!branch) notFound();

  const path = `/mit-wpu/${branchSlug(branch)}`;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "MIT-WPU", path: "/mit-wpu" },
    { name: branch, path },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `MIT-WPU ${branch}`,
    description: `Study indexes for ${branchLabel(branch)} at MIT World Peace University.`,
    url: absoluteUrl(path),
  };

  return (
    <MitWpuPage crumbs={crumbs}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
        {MIT_WPU_YEAR} · {branch}
      </p>
      <h1 className="font-display text-3xl sm:text-4xl tracking-tight text-foreground mb-3">
        {branchLabel(branch)}
      </h1>
      <p className="text-base text-muted leading-relaxed mb-8">
        Public semester indexes for MIT-WPU {branch}. Open a semester for
        subject names and resource titles. Sign in on Utility OS to open vault
        files or ask the AI about your materials.
      </p>

      <ul className="grid gap-2 sm:grid-cols-2">
        {SEMESTERS.map((semester) => (
          <li key={semester}>
            <Link
              href={`/mit-wpu/${branchSlug(branch)}/semester/${semester}`}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium hover:bg-surface transition-colors"
            >
              <span>Semester {semester}</span>
              <span className="text-muted">View →</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap gap-4 text-sm">
        <Link href="/gpa" className="underline-offset-2 hover:underline">
          GPA calculator
        </Link>
        <Link href="/mit-wpu" className="underline-offset-2 hover:underline">
          All branches
        </Link>
      </div>

      <MitWpuSignInCta />
    </MitWpuPage>
  );
}
