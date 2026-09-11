import type { Metadata } from "next";
import AppLink from "@/components/ui/AppLink";
import { PageHeader } from "@/components/ui";
import {
  ACCOUNT_DELETE_PATH,
  APP_LEGAL_NAME,
  CONTACT_EMAIL,
  CONTACT_MAILTO,
  PRIVACY_PATH,
  SITE_ORIGIN,
} from "@/lib/legal";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Delete your account",
  description: `How to delete your ${APP_LEGAL_NAME} account and associated data.`,
  robots: { index: true, follow: true },
};

const MAIL_SUBJECT = encodeURIComponent(`${APP_LEGAL_NAME} account deletion request`);
const MAIL_BODY = encodeURIComponent(
  `Please delete my ${APP_LEGAL_NAME} account.\n\nAccount email:\n\nI confirm I want all associated study data removed.`,
);

export default function AccountDeletePage() {
  return (
    <article className="flex-1 w-full max-w-3xl mx-auto page-gutter py-12 sm:py-16 page-fade-in">
      <PageHeader
        eyebrow="Account"
        title={`Delete your ${APP_LEGAL_NAME} account`}
        description="This page does not require you to be signed in. Use it to remove your Utility account and the study data stored with it."
      />

      <div className="mt-10 space-y-8 text-sm text-foreground-subtle leading-relaxed">
        <section className="space-y-3">
          <h2 className="font-display text-xl text-foreground tracking-tight">
            In the app
          </h2>
          <ol className="list-decimal pl-5 space-y-2">
            <li>
              Sign in at{" "}
              <AppLink href="/login" className="text-foreground underline underline-offset-4">
                {SITE_ORIGIN}/login
              </AppLink>
              .
            </li>
            <li>
              Open{" "}
              <AppLink href="/profile" className="text-foreground underline underline-offset-4">
                Profile
              </AppLink>
              .
            </li>
            <li>
              In Danger zone, choose Delete account, type DELETE, and confirm
              with a recent sign-in.
            </li>
          </ol>
          <p>
            That removes your Firebase login, Firestore prefs, planner plans you
            own, SRS data, visualize progress, activity logs, support messages,
            published community decks, and related rows. It cannot un-send Ask
            AI prompts already processed by Groq.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl text-foreground tracking-tight">
            If you cannot sign in
          </h2>
          <p>
            Email{" "}
            <a
              className="text-foreground underline underline-offset-4"
              href={`${CONTACT_MAILTO}?subject=${MAIL_SUBJECT}&body=${MAIL_BODY}`}
            >
              {CONTACT_EMAIL}
            </a>{" "}
            from the address on the account. Include that you want the{" "}
            {APP_LEGAL_NAME} account deleted. We will verify ownership before
            removing it.
          </p>
        </section>

        <p>
          Privacy details:{" "}
          <AppLink href={PRIVACY_PATH} className="text-foreground underline underline-offset-4">
            {`${SITE_ORIGIN}${PRIVACY_PATH}`}
          </AppLink>
          . This page: {`${SITE_ORIGIN}${ACCOUNT_DELETE_PATH}`}.
        </p>
      </div>
    </article>
  );
}
