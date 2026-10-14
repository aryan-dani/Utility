"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ExternalLink } from "lucide-react";
import type { RetrievalSource } from "@/lib/rag/types";

export interface SourceCardProps {
  source: RetrievalSource;
  onCitationClick?: (marker: string) => void;
}

export function SourceCard({
  source,
  onCitationClick,
}: SourceCardProps) {
  return (
    <Card
      id={`source-${source.marker}`}
      hover
      className="p-3 space-y-2 scroll-mt-24 cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={() => onCitationClick?.(source.marker)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCitationClick?.(source.marker);
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="active">[{source.marker}]</Badge>
            <span className="text-xs font-mono text-muted truncate">
              {source.section_label}
            </span>
          </div>
          <p className="text-sm font-medium text-foreground mt-1 truncate">
            {source.title}
          </p>
          <p className="text-xs text-muted">{source.subject_name}</p>
        </div>
        {source.file_url && (
          <a
            href={source.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 p-1.5 rounded-md border border-border text-muted hover:text-foreground"
            aria-label={`Open ${source.title}`}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
      <p className="text-xs text-foreground-subtle line-clamp-3 leading-relaxed">
        {source.snippet}
      </p>
    </Card>
  );
}

export function SourceCardList({
  sources,
  widened,
  branch,
  semester,
  onCitationClick,
}: {
  sources: RetrievalSource[];
  widened?: boolean;
  branch?: string;
  semester?: number;
  onCitationClick?: (marker: string) => void;
}) {
  if (sources.length === 0) return null;

  return (
    <div className="space-y-2 mt-4">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs font-mono uppercase tracking-widest text-muted">
          Sources
        </p>
        {branch && semester != null && (
          <Badge variant="outline">
            {branch} · Sem {semester}
          </Badge>
        )}
        {widened && (
          <Badge variant="outline" className="text-destructive border-destructive/30">
            Widened search
          </Badge>
        )}
      </div>
      <div className="grid gap-2">
        {sources.map((s) => (
          <SourceCard key={s.id} source={s} onCitationClick={onCitationClick} />
        ))}
      </div>
    </div>
  );
}

/** Render assistant text with clickable [S1] citation chips. */
export function renderWithCitations(
  text: string,
  onCitationClick?: (marker: string) => void,
  sources?: RetrievalSource[],
): ReactNode[] {
  const parts = text.split(/(\[S\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[S(\d+)\]$/);
    if (match) {
      const marker = `S${match[1]}`;
      const source = sources?.find((item) => item.marker === marker);
      const label = source
        ? [source.subject_name, source.title, source.section_label].filter(Boolean).join(" · ")
        : marker;
      return (
        <button
          key={`${marker}-${i}`}
          type="button"
          onClick={() => onCitationClick?.(marker)}
          className="group/cite relative inline-flex items-center max-w-full px-1.5 py-0.5 mx-0.5 text-2xs font-mono rounded border border-border bg-surface hover:bg-card text-foreground align-baseline"
        >
          <span className="truncate">{label}</span>
          {source?.snippet && (
            <span className="hidden group-hover/cite:block absolute left-0 bottom-full z-30 mb-1 w-64 max-w-[70vw] rounded-lg border border-border bg-card p-2 text-left text-xs font-sans text-foreground shadow-popover">
              {source.snippet}
            </span>
          )}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
