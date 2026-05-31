'use client';

import { useEffect, useMemo } from 'react';
import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  X,
} from 'lucide-react';
import { ResourceItem } from '@/lib/dataFetcher';

interface ResourceViewerProps {
  resource: ResourceItem;
  onClose: () => void;
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

function getViewerUrl(resource: ResourceItem) {
  // If it's a native Google Drive preview link, we can just use it directly
  if (resource.file_url.includes('drive.google.com/file/d/')) {
    return resource.file_url;
  }

  const extension = getFileExtension(resource.title, resource.file_url);

  if (extension === 'pdf') {
    return resource.file_url;
  }

  if (extension === 'ppt' || extension === 'pptx') {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(resource.file_url)}`;
  }

  return resource.file_url;
}

export default function ResourceViewer({ resource, onClose }: ResourceViewerProps) {
  const extension = getFileExtension(resource.title, resource.file_url);
  const isPdf = extension === 'pdf';
  const isPresentation = extension === 'ppt' || extension === 'pptx';
  const viewerUrl = useMemo(() => getViewerUrl(resource), [resource]);
  const FileIcon = isPresentation ? FileSpreadsheet : FileText;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[80] bg-background/90 backdrop-blur-sm">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface">
              <FileIcon className="h-4 w-4 text-foreground" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground">{resource.title}</h2>
              <p className="text-xs uppercase tracking-wide text-muted">
                {isPdf ? 'PDF' : isPresentation ? 'Presentation' : 'File'} viewer
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <a
              href={resource.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
              title="Open original"
              aria-label="Open original"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <a
              href={resource.file_url}
              download
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
              title="Download"
              aria-label="Download"
            >
              <Download className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-foreground"
              title="Close viewer"
              aria-label="Close viewer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 bg-background p-2 sm:p-4">
          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card shadow-card">
            <iframe
              src={viewerUrl}
              title={resource.title}
              className="h-full w-full bg-background"
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
