'use client';

import { FileText, FileSpreadsheet, HardDrive, ExternalLink } from 'lucide-react';
import { ResourceItem } from '@/lib/dataFetcher';

interface ResourceCardProps {
  item: ResourceItem;
  onOpenResource: (item: ResourceItem) => void;
  onSummarize: (item: ResourceItem) => void;
}

function getFileExtension(url: string) {
  try {
    const pathname = new URL(url).pathname;
    return pathname.split('.').pop()?.toLowerCase() ?? '';
  } catch {
    return url.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() ?? '';
  }
}

export default function ResourceCard({
  item,
  onOpenResource,
  onSummarize,
}: ResourceCardProps) {
  const extension = getFileExtension(item.file_url);
  const isPdf = extension === 'pdf';
  const isPpt = extension === 'ppt' || extension === 'pptx';
  const isDoc = extension === 'doc' || extension === 'docx';
  const opensInViewer = isPdf || isPpt;
  const isSummarizable = isPdf || isPpt || isDoc;
  const isSolved = item.title.toLowerCase().includes('(solved)');

  const handleCardClick = () => {
    if (opensInViewer) {
      onOpenResource(item);
    } else {
      window.open(item.file_url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Open ${item.title}`}
      className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 hover:bg-surface hover:border-border-strong transition-all shadow-card h-full text-left cursor-pointer group outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center flex-shrink-0 group-hover:bg-surface-hover transition-colors">
          {isPdf ? (
            <FileText className="w-4 h-4 text-foreground" />
          ) : isPpt ? (
            <FileSpreadsheet className="w-4 h-4 text-foreground" />
          ) : (
            <HardDrive className="w-4 h-4 text-foreground" />
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isSolved && (
            <span className="text-[10px] font-semibold uppercase tracking-wide bg-surface border border-border text-muted px-1.5 py-0.5 rounded-full">
              Solved
            </span>
          )}
          <ExternalLink className="w-3 h-3 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <p
        className="text-sm font-medium text-foreground line-clamp-2 leading-tight"
        title={item.title}
      >
        {item.title}
      </p>

      <p className="text-[10px] uppercase font-medium text-muted tracking-wider mt-auto">
        {isPdf ? 'PDF' : isPpt ? 'Presentation' : isDoc ? 'Document' : 'File'}
      </p>

      {isSummarizable && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSummarize(item);
          }}
          className="flex items-center justify-center gap-1.5 w-full mt-2 py-1.5 bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-lg text-[11px] font-bold text-primary transition-all group/btn"
        >
          Summarize
        </button>
      )}
    </div>
  );
}
