"use client";

import { Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { useIsStandalone } from "@/lib/pwa/displayMode";

const MICROSOFT_STORE_URL = "https://apps.microsoft.com/detail/9PPFG0G5R0MG";

export default function InstallPage() {
  const standalone = useIsStandalone();

  return (
    <div className="page-shell max-w-xl flex flex-col items-center text-center">
      <PageHeader
        className="mb-10 sm:flex-col sm:items-center [&_p]:mx-auto"
        size="hero"
        eyebrow="Utility"
        title={standalone ? "You are using the installed app" : "Install the app"}
        description={
          standalone
            ? "This window runs Utility OS from the live site. Website deploys land automatically on the next open — no Store recertify for normal updates."
            : "Add Utility to your home screen, desktop, or install from the Microsoft Store for an app-like window."
        }
      />

      {standalone ? (
        <div className="w-full space-y-4 text-left">
          <div className="border border-border bg-card rounded-xl px-6 py-5 text-sm text-muted leading-relaxed">
            Voice input, Drive previews, and sign-in all use this same site. If a
            new version ships while you are already using Utility, you may see an
            Apply update prompt; otherwise the next open loads the latest build.
          </div>
          <a
            href={MICROSOFT_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 border border-border bg-card rounded-xl px-5 py-4 text-sm font-medium text-foreground hover:bg-surface transition-colors"
          >
            <span>Microsoft Store listing</span>
            <ExternalLink className="w-4 h-4 text-muted shrink-0" />
          </a>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px w-full mb-6 rounded-xl overflow-hidden border border-border bg-border shadow-sm text-left">
            <div className="bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1">Phone</h3>
              <p className="text-sm text-muted leading-relaxed">
                Chrome on Android shows an install banner. On iPhone, open the Share sheet and tap Add to Home Screen.
              </p>
            </div>
            <div className="bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1">Desktop</h3>
              <p className="text-sm text-muted leading-relaxed">
                In Chrome or Edge, use the install icon in the address bar, or Install App in the browser menu.
              </p>
            </div>
          </div>

          <a
            href={MICROSOFT_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full mb-6 flex items-center justify-between gap-3 border border-border bg-card rounded-xl px-5 py-4 text-left hover:bg-surface transition-colors"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">Microsoft Store</p>
              <p className="text-xs text-muted mt-0.5 leading-relaxed">
                Install Utility OS on Windows. Updates follow the live site on the next open.
              </p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted shrink-0" />
          </a>

          <div className="w-full border border-border bg-card rounded-xl px-6 py-5 text-sm text-muted leading-relaxed flex items-start gap-3 text-left">
            <Download className="w-4 h-4 shrink-0 mt-0.5 text-foreground" />
            <span>
              Already installed, or use the browser’s install control above. This page does not block Chrome’s native install banner.
            </span>
          </div>
        </>
      )}

      <Link
        href="/"
        className="mt-10 text-sm text-muted hover:text-foreground underline underline-offset-4 font-medium"
      >
        Back home
      </Link>
    </div>
  );
}
