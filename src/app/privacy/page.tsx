import type { Metadata } from "next";
import AppLink from "@/components/ui/AppLink";
import { PageHeader } from "@/components/ui";
import {
  ACCOUNT_DELETE_PATH,
  APP_LEGAL_NAME,
  CONTACT_EMAIL,
  CONTACT_MAILTO,
  SITE_ORIGIN,
} from "@/lib/legal";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: `How ${APP_LEGAL_NAME} collects, uses, and deletes your data.`,
};

export default function PrivacyPage() {
  return (
    <article className="flex-1 w-full max-w-3xl mx-auto page-gutter py-12 sm:py-16 page-fade-in">
      <PageHeader
        eyebrow="Legal"
        title={`${APP_LEGAL_NAME} privacy policy`}
        description="This policy describes what Utility collects, who processes it, how long it is kept, and how you can delete it."
      />

      <p className="text-xs text-muted mt-4">Last updated 11 September 2026</p>

      <div className="mt-10 space-y-10 text-sm text-foreground-subtle leading-relaxed">
        <section className="space-y-3">
          <h2 className="font-display text-xl text-foreground tracking-tight">
            Who we are
          </h2>
          <p>
            {APP_LEGAL_NAME} ({SITE_ORIGIN}) is an academic workspace for
            syllabus, resources, Ask AI, planner, and related study tools. The
            service is operated by Aryan Dani. Contact:{" "}
            <a className="text-foreground underline underline-offset-4" href={CONTACT_MAILTO}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-foreground tracking-tight">
            What we collect
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              <span className="text-foreground font-medium">Firebase account:</span>{" "}
              display name, email address, avatar URL, and sign-in provider
              (Google, GitHub, or email/password).
            </li>
            <li>
              <span className="text-foreground font-medium">Workspace prefs:</span>{" "}
              academic year, branch, and semester stored in Firestore under your
              user profile.
            </li>
            <li>
              <span className="text-foreground font-medium">Planner:</span> plans
              you own and collaborator invitations you send or receive.
            </li>
            <li>
              <span className="text-foreground font-medium">SRS flashcards:</span>{" "}
              decks and cards synced to your account.
            </li>
            <li>
              <span className="text-foreground font-medium">Visualize:</span>{" "}
              algorithm progress, saved grids, and opt-in telemetry events.
            </li>
            <li>
              <span className="text-foreground font-medium">Activity:</span>{" "}
              coarse resource-open counts and similar usage logs used for your
              heatmap and vault ranking.
            </li>
            <li>
              <span className="text-foreground font-medium">Support and reports:</span>{" "}
              optional contribution messages and Ask AI report submissions.
            </li>
            <li>
              <span className="text-foreground font-medium">Community decks:</span>{" "}
              flashcard decks you publish and upvotes you cast.
            </li>
          </ul>
          <p>
            Course PDFs and other vault files live on Google Drive. The browser
            fetches them directly from Drive; Utility&apos;s servers do not proxy
            file bytes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-foreground tracking-tight">
            Processors
          </h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>Firebase (Google): authentication and Firestore.</li>
            <li>Google Drive: file host; fetched by your browser.</li>
            <li>Groq: processes Ask AI prompts and retrieved snippets.</li>
            <li>Vercel: hosting, Analytics, and Speed Insights (sampled).</li>
            <li>Upstash: rate limiting for API routes.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-foreground tracking-tight">
            Retention
          </h2>
          <p>
            Account data is kept while your account exists. Rate-limit keys in
            Upstash expire on their window. Analytics events follow Vercel&apos;s
            retention. After you delete your account, Firestore rows we can
            attribute to you and the Firebase Auth user are removed. Aggregated
            vault totals that do not identify you may remain.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-foreground tracking-tight">
            Deletion
          </h2>
          <p>
            Signed-in users can delete their {APP_LEGAL_NAME} account from
            Profile. Anyone can follow the steps on{" "}
            <AppLink
              href={ACCOUNT_DELETE_PATH}
              className="text-foreground underline underline-offset-4"
            >
              the account deletion page
            </AppLink>
            , including a mailto fallback if they cannot sign in.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-foreground tracking-tight">
            Children
          </h2>
          <p>
            {APP_LEGAL_NAME} is intended for university students 18 and older. We
            do not knowingly collect data from children.
          </p>
        </section>
      </div>
    </article>
  );
}
