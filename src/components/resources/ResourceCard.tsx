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

  const handleOpen = () => {
    if (opensInViewer) {
      onOpenResource(item);
    } else {
      window.open(item.file_url, '_blank', 'noopener,noreferrer');
    }
  };

  const handlePrefetch = () => {
    if (isPdf) {
      // Pre-warm the browser cache for this PDF so the iframe loads instantly
      fetch(item.file_url, { cache: 'force-cache', mode: 'no-cors' }).catch(() => {});
    }
  };

  return (
    <div 
      className="bg-card border border-border hover:border-border-strong p-5 rounded-xl flex flex-col gap-4 transition-colors text-left shadow-sm"
      onMouseEnter={handlePrefetch}
      onTouchStart={handlePrefetch}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-9 h-9 rounded-lg bg-surface border border-border flex items-center justify-center flex-shrink-0 text-foreground">
          {isPdf ? (
            <FileText className="w-4 h-4" />
          ) : isPpt ? (
            <FileSpreadsheet className="w-4 h-4" />
          ) : (
            <HardDrive className="w-4 h-4" />
          )}
        </div>
        {isSolved && (
          <span className="text-[10px] font-semibold uppercase tracking-wider bg-surface border border-border text-foreground px-2 py-0.5 rounded-md">
            Solved
          </span>
        )}
      </div>

      <p
        className="text-sm font-medium text-foreground line-clamp-2 leading-snug"
        title={item.title}
      >
        {item.title}
      </p>

      <p className="text-[11px] font-medium text-muted mt-auto flex items-center gap-1.5">
        {isPdf ? 'PDF Document' : isPpt ? 'Presentation Slides' : isDoc ? 'Word Document' : 'Resource File'}
      </p>

      <div className={`grid gap-2 mt-2 ${isSummarizable ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleOpen();
          }}
          className="flex items-center justify-center gap-1.5 w-full py-2 bg-surface hover:bg-surface-hover border border-border rounded-lg text-xs font-medium text-foreground transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5 text-muted" />
          Open
        </button>
        {isSummarizable && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSummarize(item);
            }}
            className="flex items-center justify-center gap-1.5 w-full py-2 bg-foreground text-background hover:opacity-90 rounded-lg text-xs font-medium transition-opacity"
          >
            Summarize
          </button>
        )}
      </div>
    </div>
  );
}
