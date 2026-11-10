import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, jsonLdScript, SITE_NAME } from "@/lib/seo";
import { MitWpuPage, MitWpuSignInCta } from "@/components/seo/MitWpuChrome";

export const revalidate = 86400;

const title = "Focus timer for study sessions";
const description =
  "Pomodoro-style focus timer inside Utility OS, next to MIT-WPU syllabus, planner, and flashcards.";
const path = "/mit-wpu/focus-timer";

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

export default function FocusTimerLandingPage() {
  return (
    <MitWpuPage
      crumbs={[
        { name: "Home", path: "/" },
        { name: "MIT-WPU", path: "/mit-wpu" },
        { name: "Focus timer", path },
      ]}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Utility OS Focus Timer",
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            url: absoluteUrl(path),
            description,
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          }),
        }}
      />
      <h1 className="font-display text-3xl sm:text-4xl tracking-tight text-foreground mb-3">
        Focus timer for deep work blocks
      </h1>
      <p className="text-base text-muted leading-relaxed mb-6">
        Start a timed study block without leaving the same workspace as your
        MIT-WPU syllabus and planner. Sign in to keep sessions with the rest of
        your study streak.
      </p>
      <Link
        href="/signup"
        className="inline-flex items-center rounded-xl bg-foreground text-background px-4 py-2.5 text-sm font-semibold"
      >
        Sign up to use the timer
      </Link>
      <MitWpuSignInCta action="run focus sessions from the home desk" />
    </MitWpuPage>
  );
}
