import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, jsonLdScript, SITE_NAME } from "@/lib/seo";
import { MitWpuPage, MitWpuSignInCta } from "@/components/seo/MitWpuChrome";

export const revalidate = 86400;

const title = "Semester study planner for college students";
const description =
  "Plan MIT-WPU weeks with tasks tied to your syllabus. Utility OS planner is free after sign-in — not a campus ERP.";
const path = "/mit-wpu/study-planner";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl(path) },
  openGraph: {
    title: `${title} | ${SITE_NAME}`,
    description,
    url: absoluteUrl(path),
  },
};

export default function StudyPlannerLandingPage() {
  return (
    <MitWpuPage
      crumbs={[
        { name: "Home", path: "/" },
        { name: "MIT-WPU", path: "/mit-wpu" },
        { name: "Study planner", path },
      ]}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Utility OS Study Planner",
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            url: absoluteUrl(path),
            description,
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          }),
        }}
      />
      <h1 className="font-display text-3xl sm:text-4xl tracking-tight text-foreground mb-3">
        Study planner for your semester
      </h1>
      <p className="text-base text-muted leading-relaxed mb-6">
        Map exams, assignments, and focus blocks against the same MIT-WPU
        branch and semester you use in the vault. Utility OS is a student study
        workspace — it does not replace official attendance, fees, or ERP tools.
      </p>
      <ul className="list-disc pl-5 text-sm text-muted space-y-2 mb-8">
        <li>Weekly tasks with live home-desk progress when you are signed in</li>
        <li>Links into syllabus and resources for the subjects you are tracking</li>
        <li>Optional share links for public plans you choose to publish</li>
      </ul>
      <Link
        href="/signup"
        className="inline-flex items-center rounded-xl bg-foreground text-background px-4 py-2.5 text-sm font-semibold"
      >
        Sign up to open the planner
      </Link>
      <MitWpuSignInCta action="save planner tasks and see them on the home desk" />
    </MitWpuPage>
  );
}
