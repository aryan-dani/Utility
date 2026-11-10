import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BRANCHES, SEMESTERS } from "@/lib/academic/scope";
import {
  branchLabel,
  branchSlug,
  loadSemesterCatalog,
  MIT_WPU_YEAR,
  officialAidsSubjects,
  parseBranchParam,
  parseSemesterParam,
  slugifySubject,
} from "@/lib/mitWpuCatalog";
import { absoluteUrl, jsonLdScript, SITE_NAME } from "@/lib/seo";
import { MitWpuPage, MitWpuSignInCta } from "@/components/seo/MitWpuChrome";

export const revalidate = 86400;
export const dynamicParams = false;

export function generateStaticParams() {
  return BRANCHES.flatMap((branch) =>
    SEMESTERS.map((n) => ({
      branch: branchSlug(branch),
      n: String(n),
    })),
  );
}

type Props = { params: Promise<{ branch: string; n: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { branch: rawBranch, n: rawN } = await params;
  const branch = parseBranchParam(rawBranch);
  const semester = parseSemesterParam(rawN);
  if (!branch || !semester) return {};
  const title = `MIT-WPU ${branch} Semester ${semester} syllabus and resources`;
  const description = `Subject list and study resource titles for MIT-WPU ${branchLabel(branch)}, Semester ${semester} (${MIT_WPU_YEAR}) on Utility OS.`;
  const path = `/mit-wpu/${branchSlug(branch)}/semester/${semester}`;
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

export default async function MitWpuSemesterPage({ params }: Props) {
  const { branch: rawBranch, n: rawN } = await params;
  const branch = parseBranchParam(rawBranch);
  const semester = parseSemesterParam(rawN);
  if (!branch || !semester) notFound();

  const { subjects, resourceCount } = await loadSemesterCatalog(
    branch,
    semester,
  );
  const official = officialAidsSubjects(semester);
  const path = `/mit-wpu/${branchSlug(branch)}/semester/${semester}`;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "MIT-WPU", path: "/mit-wpu" },
    { name: branch, path: `/mit-wpu/${branchSlug(branch)}` },
    { name: `Sem ${semester}`, path },
  ];

  const subjectLinks =
    subjects.length > 0
      ? subjects
      : official.map((subject) => ({
          id: subject.id,
          name: subject.name,
          branch,
          semester,
        }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `MIT-WPU ${branch} Semester ${semester}`,
    numberOfItems: subjectLinks.length,
    itemListElement: subjectLinks.map((subject, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: subject.name,
      url: absoluteUrl(
        `/mit-wpu/${branchSlug(branch)}/semester/${semester}/${slugifySubject(subject.name)}`,
      ),
    })),
  };

  return (
    <MitWpuPage crumbs={crumbs}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
        {MIT_WPU_YEAR} · {branch} · Semester {semester}
      </p>
      <h1 className="font-display text-3xl sm:text-4xl tracking-tight text-foreground mb-3">
        {branch} Semester {semester}
      </h1>
      <p className="text-base text-muted leading-relaxed mb-6">
        {subjectLinks.length} subjects
        {resourceCount > 0 ? ` · ${resourceCount} indexed resource titles` : ""}.
        {official.length > 0
          ? " Unit outlines are available for AIDS subjects on this semester."
          : " Subject pages list catalog titles; detailed unit outlines are published for AIDS Semesters 3–5 only."}
      </p>

      {subjectLinks.length === 0 ? (
        <p className="text-sm text-muted border border-border rounded-2xl px-4 py-6">
          No subjects are indexed for this semester yet. Check another semester
          or sign in after Drive sync finishes.
        </p>
      ) : (
        <ul className="divide-y divide-border border border-border rounded-2xl overflow-hidden bg-card">
          {subjectLinks.map((subject) => (
            <li key={subject.id || subject.name}>
              <Link
                href={`/mit-wpu/${branchSlug(branch)}/semester/${semester}/${slugifySubject(subject.name)}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface transition-colors"
              >
                <span className="font-medium text-foreground">
                  {subject.name}
                </span>
                <span className="text-muted shrink-0">Open →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <MitWpuSignInCta />
    </MitWpuPage>
  );
}
