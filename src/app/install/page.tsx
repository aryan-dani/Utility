"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { useIsStandalone } from "@/lib/pwa/displayMode";

export default function InstallPage() {
  const standalone = useIsStandalone();

  return (
    <div className="flex-1 flex flex-col items-center max-w-xl mx-auto page-gutter py-20 page-fade-in text-center">
      <PageHeader
        className="mb-10 sm:flex-col sm:items-center [&_p]:mx-auto"
        size="hero"
        eyebrow="Utility"
        title={standalone ? "You are using the installed app" : "Install the app"}
        description={
          standalone
            ? "This window is already running as Utility. Store listings for Play and Microsoft will appear here after they go live."
            : "Add Utility to your home screen or desktop for faster access and an app-like window."
        }
      />

      {standalone ? (
        <div className="w-full border border-border bg-card rounded-xl px-6 py-5 text-sm text-muted leading-relaxed text-left">
          Voice input, Drive previews, and sign-in all use this same site. You
          can keep using Utility here; there is nothing else to install.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px w-full mb-10 rounded-xl overflow-hidden border border-border bg-border shadow-sm text-left">
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
