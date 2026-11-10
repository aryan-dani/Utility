import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, jsonLdScript, SITE_NAME } from "@/lib/seo";
import { MitWpuPage, MitWpuSignInCta } from "@/components/seo/MitWpuChrome";

export const revalidate = 86400;

const title = "SRS flashcards for MIT-WPU subjects";
const description =
  "Spaced-repetition flashcards for college subjects on Utility OS. Sign in to review decks and nightly study packs.";
const path = "/mit-wpu/flashcards";

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

export default function FlashcardsLandingPage() {
  return (
    <MitWpuPage
      crumbs={[
        { name: "Home", path: "/" },
        { name: "MIT-WPU", path: "/mit-wpu" },
        { name: "Flashcards", path },
      ]}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Utility OS SRS Flashcards",
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            url: absoluteUrl(path),
            description,
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          }),
        }}
      />
      <h1 className="font-display text-3xl sm:text-4xl tracking-tight text-foreground mb-3">
        Flashcards with spaced repetition
      </h1>
      <p className="text-base text-muted leading-relaxed mb-6">
        Build decks for MIT-WPU subjects and review them with SRS scheduling.
        Nightly study packs can suggest cards from your semester materials after
        you sign in.
      </p>
      <Link
        href="/signup"
        className="inline-flex items-center rounded-xl bg-foreground text-background px-4 py-2.5 text-sm font-semibold"
      >
        Sign up for flashcards
      </Link>
      <MitWpuSignInCta action="create decks and run SRS reviews" />
    </MitWpuPage>
  );
}
