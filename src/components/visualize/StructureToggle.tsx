"use client";

import AppLink from "@/components/ui/AppLink";
import { usePathname, useSearchParams } from "next/navigation";
import {
  structureFromParam,
  supportsStructureToggle,
} from "@/lib/visualize/structure";

export function StructureToggle({ algorithmId }: { algorithmId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const structure = structureFromParam(
    searchParams.get("structure") ?? undefined,
  );

  if (!supportsStructureToggle(algorithmId)) {
    return null;
  }

  const base = pathname;

  const segmentClass = (active: boolean) =>
    `inline-flex h-6 items-center justify-center px-2.5 text-2xs font-mono uppercase tracking-widest transition-colors ${
      active
        ? "bg-foreground text-background"
        : "text-muted hover:text-foreground"
    }`;

  return (
    <div
      className="inline-flex overflow-hidden rounded-lg border border-border bg-surface/40"
      role="group"
      aria-label="Graph or tree view"
    >
      <AppLink
        href={base}
        className={`${segmentClass(structure === "graph")} border-r border-border`}
      >
        Graph
      </AppLink>
      <AppLink
        href={`${base}?structure=tree`}
        className={segmentClass(structure === "tree")}
      >
        Tree
      </AppLink>
    </div>
  );
}
