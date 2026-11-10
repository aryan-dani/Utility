import type { Metadata } from "next";
import { indexableMeta, jsonLdScript, absoluteUrl, SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  ...indexableMeta("/gpa"),
  title: {
    absolute: "MIT-WPU GPA / SGPA / CGPA calculator | Utility OS",
  },
};

export default function GpaLayout({ children }: { children: React.ReactNode }) {
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How is MIT-WPU SGPA calculated?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "SGPA is the credit-weighted average of grade points in a semester: sum(credits × grade points) ÷ sum(credits), on MIT-WPU’s 10-point scale.",
        },
      },
      {
        "@type": "Question",
        name: "How is MIT-WPU CGPA calculated?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "CGPA is the credit-weighted average of semester SGPAs across all completed semesters, following the university’s examination ordinance.",
        },
      },
      {
        "@type": "Question",
        name: "Do I need to sign in to use the Utility OS GPA calculator?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No. The calculator works in the browser without an account. Sign in only if you want the rest of the Utility OS study workspace.",
        },
      },
    ],
  };

  const app = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "MIT-WPU GPA Calculator",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    url: absoluteUrl("/gpa"),
    isAccessibleForFree: true,
    provider: { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/") },
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(app) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(faq) }}
      />
      {children}
      <section className="w-full max-w-3xl mx-auto page-gutter pb-12">
        <h2 className="text-lg font-semibold text-foreground mb-3">
          MIT-WPU GPA FAQ
        </h2>
        <dl className="space-y-4 text-sm text-muted">
          <div>
            <dt className="font-medium text-foreground">How is SGPA calculated?</dt>
            <dd className="mt-1 leading-relaxed">
              SGPA = Σ(credits × grade points) ÷ Σ(credits) for one semester on
              the 10-point scale used in MIT-WPU examination ordinances.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">How is CGPA calculated?</dt>
            <dd className="mt-1 leading-relaxed">
              CGPA is the credit-weighted average of your semester SGPAs across
              completed terms. Many forms also use percentage ≈ CGPA × 10 —
              confirm with the latest university circular when you apply.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Is sign-in required?</dt>
            <dd className="mt-1 leading-relaxed">
              No. This calculator is public. Create a free Utility OS account
              only if you want syllabus indexes, the vault, or Ask AI.
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
}
