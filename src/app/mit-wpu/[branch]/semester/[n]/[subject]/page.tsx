import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  findOfficialSubject,
  loadSemesterCatalog,
  matchSubjectResources,
  MIT_WPU_YEAR,
  mitWpuSubjectPaths,
  parseBranchParam,
  parseSemesterParam,
  resolveSubjectName,
  branchSlug,
  branchLabel,
} from "@/lib/mitWpuCatalog";
import { absoluteUrl, jsonLdScript, SITE_NAME } from "@/lib/seo";
import { MitWpuPage, MitWpuSignInCta } from "@/components/seo/MitWpuChrome";

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  return mitWpuSubjectPaths();
}

type Props = {
  params: Promise<{ branch: string; n: string; subject: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { branch: rawBranch, n: rawN, subject: subjectSlug } = await params;
  const branch = parseBranchParam(rawBranch);
  const semester = parseSemesterParam(rawN);
  if (!branch || !semester) return {};
  const official = findOfficialSubject(branch, semester, subjectSlug);
  const name = official?.name ?? subjectSlug.replace(/-/g, " ");
  const title = `${name} — MIT-WPU ${branch} Sem ${semester}`;
  const description = official
    ? `Unit outline and study resource titles for ${name} (${official.code}) in MIT-WPU ${branch} Semester ${semester}.`
    : `Study resource titles for ${name} in MIT-WPU ${branchLabel(branch)}, Semester ${semester}.`;
  const path = `/mit-wpu/${branchSlug(branch)}/semester/${semester}/${subjectSlug}`;
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

export default async function MitWpuSubjectPage({ params }: Props) {
  const { branch: rawBranch, n: rawN, subject: subjectSlug } = await params;
  const branch = parseBranchParam(rawBranch);
  const semester = parseSemesterParam(rawN);
  if (!branch || !semester) notFound();

  const official = findOfficialSubject(branch, semester, subjectSlug);
  const { subjects, resources } = await loadSemesterCatalog(branch, semester);
  const subjectName = resolveSubjectName(subjects, subjectSlug, official);
  if (!subjectName) notFound();

  const subjectResources = matchSubjectResources(resources, subjectName);
  const path = `/mit-wpu/${branchSlug(branch)}/semester/${semester}/${subjectSlug}`;
  const crumbs = [
    { name: "Home", path: "/" },
    { name: "MIT-WPU", path: "/mit-wpu" },
    { name: branch, path: `/mit-wpu/${branchSlug(branch)}` },
    {
      name: `Sem ${semester}`,
      path: `/mit-wpu/${branchSlug(branch)}/semester/${semester}`,
    },
    { name: subjectName, path },
  ];

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: subjectName,
    description: `MIT-WPU ${branch} Semester ${semester} subject index on Utility OS.`,
    url: absoluteUrl(path),
    educationalLevel: `Semester ${semester}`,
    learningResourceType: "Course syllabus index",
    isAccessibleForFree: true,
    provider: {
      "@type": "Organization",
      name: SITE_NAME,
      url: absoluteUrl("/"),
    },
  };
  if (official?.code) {
    jsonLd.courseCode = official.code;
  }

  return (
    <MitWpuPage crumbs={crumbs}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
        {MIT_WPU_YEAR} · {branch} · Sem {semester}
        {official?.code ? ` · ${official.code}` : ""}
      </p>
      <h1 className="font-display text-3xl sm:text-4xl tracking-tight text-foreground mb-3">
        {subjectName}
      </h1>
      <p className="text-base text-muted leading-relaxed mb-8">
        {official
          ? `${official.type} · ${official.credits} credits. Unit outline below; open files after sign-in.`
          : "Resource titles from the Utility catalog. Sign in to open PDFs and notebooks from Drive."}
      </p>

      {official && official.modules.length > 0 ? (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-foreground mb-3">
            Units and topics
          </h2>
          <ol className="space-y-4">
            {official.modules.map((mod) => (
              <li
                key={mod.title}
                className="rounded-2xl border border-border bg-card px-4 py-3"
              >
                <h3 className="font-medium text-foreground text-sm mb-1">
                  {mod.title}
                </h3>
                <p className="text-sm text-muted leading-relaxed">{mod.desc}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Indexed resource titles
        </h2>
        {subjectResources.length === 0 ? (
          <p className="text-sm text-muted border border-border rounded-2xl px-4 py-6">
            No resource titles indexed for this subject yet.
          </p>
        ) : (
          <ul className="divide-y divide-border border border-border rounded-2xl overflow-hidden bg-card">
            {subjectResources.map((resource) => (
              <li
                key={`${resource.category}-${resource.title}`}
                className="px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
              >
                <span className="text-foreground">{resource.title}</span>
                <span className="text-xs uppercase tracking-wide text-muted">
                  {resource.category}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 text-sm text-muted">
        Related:{" "}
        <Link href="/gpa" className="underline-offset-2 hover:underline">
          GPA calculator
        </Link>
        {" · "}
        <Link
          href="/mit-wpu/ask-ai"
          className="underline-offset-2 hover:underline"
        >
          Ask AI
        </Link>
        {" · "}
        <Link
          href={`/mit-wpu/${branchSlug(branch)}/semester/${semester}`}
          className="underline-offset-2 hover:underline"
        >
          Semester {semester}
        </Link>
      </p>

      <MitWpuSignInCta action="open these files in the vault or Ask AI about this subject" />
    </MitWpuPage>
  );
}
