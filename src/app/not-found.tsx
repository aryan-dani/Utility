import Link from "next/link";
import { PageHeader } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center min-h-[70vh] px-6 py-16 relative overflow-hidden">
      <p className="font-display text-2xl text-foreground tracking-tight mb-6">
        Utility
      </p>
      <p className="text-6xl md:text-7xl font-display tracking-tight text-foreground mb-3">
        404
      </p>
      <PageHeader
        className="mb-2 sm:flex-col sm:items-center [&_p]:mx-auto"
        title="Page not found"
        description="That route does not exist, or the resource moved."
      />
      <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 shadow-sm"
        >
          Home
        </Link>
        <Link
          href="/resources"
          className="px-5 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-semibold hover:bg-surface shadow-xs"
        >
          Resources
        </Link>
      </div>
    </div>
  );
}
