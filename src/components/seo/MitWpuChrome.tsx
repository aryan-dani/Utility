import Link from "next/link";
import { jsonLdScript } from "@/lib/seo";
import { breadcrumbJsonLd } from "@/lib/mitWpuCatalog";

export type Crumb = { name: string; path: string };

export function MitWpuBreadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(breadcrumbJsonLd(items)),
        }}
      />
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          {items.map((item, index) => {
            const last = index === items.length - 1;
            return (
              <li key={item.path} className="flex items-center gap-1.5">
                {index > 0 ? <span aria-hidden="true">/</span> : null}
                {last ? (
                  <span className="text-foreground font-medium">{item.name}</span>
                ) : (
                  <Link
                    href={item.path}
                    className="hover:text-foreground underline-offset-2 hover:underline"
                  >
                    {item.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

export function MitWpuSignInCta({
  action = "open course files and Ask AI",
}: {
  action?: string;
}) {
  return (
    <p className="mt-8 rounded-2xl border border-border bg-surface/60 px-4 py-3 text-sm text-muted leading-relaxed">
      Sign in free to {action}. Utility OS keeps PDFs and notebooks on Google
      Drive or the campus files host — this page only lists titles for search
      and planning.{" "}
      <Link href="/signup" className="text-foreground font-semibold underline-offset-2 hover:underline">
        Create account
      </Link>
      {" · "}
      <Link href="/login" className="text-foreground font-semibold underline-offset-2 hover:underline">
        Sign in
      </Link>
    </p>
  );
}

export function MitWpuPage({
  children,
  crumbs,
}: {
  children: React.ReactNode;
  crumbs: Crumb[];
}) {
  return (
    <div className="flex-1 w-full">
      <article className="w-full max-w-3xl mx-auto page-gutter py-10 sm:py-14">
        <MitWpuBreadcrumbs items={crumbs} />
        {children}
      </article>
    </div>
  );
}
