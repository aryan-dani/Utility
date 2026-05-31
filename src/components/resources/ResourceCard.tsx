'use client';

import { useState } from 'react';
import { FileText, FileSpreadsheet, HardDrive, ExternalLink, CheckCircle2, PenTool } from 'lucide-react';
import { ResourceItem, ResourceCategory } from '@/lib/dataFetcher';

interface ResourceCardProps {
  item: ResourceItem;
  onOpenResource: (item: ResourceItem) => void;
  onSummarize: (item: ResourceItem) => void;
}

function getFileExtension(title: string, url: string) {
  if (title && title.includes('.')) {
    const ext = title.split('.').pop()?.toLowerCase();
    if (ext) return ext;
  }
  try {
    const pathname = new URL(url).pathname;
    return pathname.split('.').pop()?.toLowerCase() ?? '';
  } catch {
    return url.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() ?? '';
  }
}

const CATEGORY_CONFIG: Record<ResourceCategory, { color: string; label: string }> = {
  'notes': { color: 'var(--accent-notes)', label: 'Notes' },
  'question-bank': { color: 'var(--accent-qb)', label: 'Question Bank' },
  'solved-question-bank': { color: 'var(--accent-qb-solved)', label: 'Solved QB' },
  'ppt': { color: 'var(--accent-ppt)', label: 'Presentation' },
  'pyq': { color: 'var(--accent-pyq)', label: 'PYQ' },
  'writeup': { color: 'var(--accent-writeup)', label: 'Writeup' },
  'other': { color: 'var(--accent-other)', label: 'Other' },
};

function isNewResource(createdAt: string): boolean {
  const created = new Date(createdAt);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return created > sevenDaysAgo;
}

export default function ResourceCard({
  item,
  onOpenResource,
  onSummarize,
}: ResourceCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const extension = getFileExtension(item.title, item.file_url);
  const isDrivePreview = item.file_url.includes('drive.google.com/file/d/');
  const isPdf = extension === 'pdf' || (isDrivePreview && !extension); // Default to PDF styling for generic drive files if no ext
  const isPpt = extension === 'ppt' || extension === 'pptx';
  const isDoc = extension === 'doc' || extension === 'docx';
  const opensInViewer = isPdf || isPpt || isDrivePreview;
  const isSummarizable = isPdf || isPpt || isDoc || isDrivePreview;
  const isSolved = item.category === 'solved-question-bank';
  const isNew = isNewResource(item.created_at);
  const config = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG['other'];

  const handleOpen = () => {
    if (opensInViewer) {
      onOpenResource(item);
    } else {
      window.open(item.file_url, '_blank', 'noopener,noreferrer');
    }
  };

  const FileIcon = isPdf ? FileText 
    : isPpt ? FileSpreadsheet 
    : item.category === 'writeup' ? PenTool 
    : HardDrive;

  return (
    <div 
      onClick={handleOpen}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => setIsHovered(false)}
      className="group bg-card border rounded-xl p-4 flex flex-col gap-3 transition-all duration-200 text-left shadow-sm hover:shadow-md hover:-translate-y-[2px] active:translate-y-0 cursor-pointer relative overflow-hidden"
      style={{ 
        borderColor: isHovered ? config.color : 'var(--border)',
        boxShadow: isHovered 
          ? `0 10px 15px -3px color-mix(in srgb, ${config.color} 12%, transparent), 0 4px 6px -4px color-mix(in srgb, ${config.color} 12%, transparent)`
          : undefined,
      }}
    >
      {/* Accent top border */}
      <div 
        className="absolute top-0 left-0 right-0 h-[2px] opacity-60 group-hover:opacity-100 transition-opacity"
        style={{ background: config.color }}
      />


      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* File type icon with accent color */}
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
            style={{ 
              background: `color-mix(in srgb, ${config.color} 12%, transparent)`,
              color: config.color,
            }}
          >
            {isSolved ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <FileIcon className="w-4 h-4" />
            )}
          </div>

          <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug" title={item.title}>
            {item.title}
          </p>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isNew && (
            <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
              New
            </span>
          )}
          {isSolved && (
            <span 
              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md"
              style={{ 
                background: `color-mix(in srgb, ${config.color} 12%, transparent)`,
                color: config.color,
                border: `1px solid color-mix(in srgb, ${config.color} 25%, transparent)`,
              }}
            >
              Solved
            </span>
          )}
        </div>
      </div>


      {/* File info */}
      <p className="text-[10px] font-semibold text-muted uppercase tracking-wider mt-auto">
        {isPdf ? 'PDF' : isPpt ? 'PPT' : isDoc ? 'DOC' : extension.toUpperCase()} · {config.label}
      </p>

      {/* Actions */}
      <div className={`grid gap-2 ${isSummarizable ? 'grid-cols-2' : 'grid-cols-1'}`}>
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
