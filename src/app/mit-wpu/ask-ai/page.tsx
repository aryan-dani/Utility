import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl, jsonLdScript, SITE_NAME } from "@/lib/seo";
import { MitWpuPage, MitWpuSignInCta } from "@/components/seo/MitWpuChrome";

export const revalidate = 86400;

const title = "AI study assistant for MIT-WPU syllabus";
const description =
  "Ask AI answers from your MIT-WPU course materials on Utility OS. Public syllabus indexes stay free to browse; chat requires a free student account.";
const path = "/mit-wpu/ask-ai";

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

export default function AskAiLandingPage() {
  return (
    <MitWpuPage
      crumbs={[
        { name: "Home", path: "/" },
        { name: "MIT-WPU", path: "/mit-wpu" },
        { name: "Ask AI", path },
      ]}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Utility OS Ask AI",
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            url: absoluteUrl(path),
            description,
            offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
          }),
        }}
      />
      <h1 className="font-display text-3xl sm:text-4xl tracking-tight text-foreground mb-3">
        AI study assistant grounded in your materials
      </h1>
      <p className="text-base text-muted leading-relaxed mb-6">
        Ask questions against the notes and syllabus indexed for your branch and
        semester. Browse public{" "}
        <Link href="/mit-wpu" className="underline-offset-2 hover:underline">
          MIT-WPU indexes
        </Link>{" "}
        without an account; chatting and file retrieval need sign-in so answers
        stay tied to materials you can access.
      </p>
      <Link
        href="/signup"
        className="inline-flex items-center rounded-xl bg-foreground text-background px-4 py-2.5 text-sm font-semibold"
      >
        Sign up to Ask AI
      </Link>
      <MitWpuSignInCta action="ask questions grounded in your vault" />
    </MitWpuPage>
  );
}
