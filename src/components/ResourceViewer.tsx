"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  X,
  Maximize,
} from "lucide-react";
import { ResourceItem } from "@/lib/dataFetcher";
import { getFileExtension, getDriveFileId } from "@/lib/fileUtils";

interface ResourceViewerProps {
  resource: ResourceItem;
  onClose: () => void;
}

function getViewerUrl(resource: ResourceItem) {
  const extension = getFileExtension(resource.title, resource.file_url);
  const isDrive = resource.file_url.includes("drive.google.com");

  if (isDrive) {
    return resource.file_url;
  }

  if (extension === "pdf") {
    return resource.file_url;
  }

  if (extension === "ppt" || extension === "pptx") {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(resource.file_url)}`;
  }

  return resource.file_url;
}

export default function ResourceViewer({
  resource,
  onClose,
}: ResourceViewerProps) {
  const extension = getFileExtension(resource.title, resource.file_url);
  const isPdf = extension === "pdf";
  const isPresentation = extension === "ppt" || extension === "pptx";
  const viewerUrl = useMemo(() => getViewerUrl(resource), [resource]);
  const FileIcon = isPresentation ? FileSpreadsheet : FileText;

  const containerRef = useRef<HTMLDivElement>(null);
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const externalRef = useRef<HTMLAnchorElement>(null);

  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset loading state when the viewer URL changes
  useEffect(() => {
    setIsLoading(true);
  }, [viewerUrl]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key.toLowerCase() === "f") {
        if (!document.fullscreenElement) {
          containerRef.current?.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
      if (event.key.toLowerCase() === "d") downloadRef.current?.click();
      if (event.key.toLowerCase() === "o") externalRef.current?.click();
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    
    // Focus the container to ensure key events are captured immediately
    containerRef.current?.focus();

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const content = (
    <div 
      ref={containerRef}
      tabIndex={-1}
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md outline-none flex flex-col"
    >
      {/* Left Floating Pill */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-card/80 backdrop-blur-md border border-border/60 rounded-2xl p-2 pr-4 shadow-lg">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-surface">
          <FileIcon className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-foreground">
            {resource.title}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted">
              {isPdf ? "PDF" : isPresentation ? "Presentation" : "File"}{" "}
              viewer
            </p>
          </div>
        </div>
      </div>

      {/* Right Floating Pill */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-card/80 backdrop-blur-md border border-border/60 rounded-2xl p-1.5 shadow-lg">
        <div className="hidden sm:flex items-center gap-2 px-3 border-r border-border/50 mr-1 text-[10px] font-bold tracking-wide text-muted uppercase">
          <span>O: Open</span>
          <span>F: Full</span>
          <span>D: DL</span>
          <span>Esc: Close</span>
        </div>
        <a
          ref={externalRef}
          href={viewerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface hover:text-foreground"
          title="Open in new tab (O)"
          aria-label="Open in new tab"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        <button
          onClick={() => {
            if (!document.fullscreenElement) {
              containerRef.current?.requestFullscreen().catch(() => {});
            } else {
              document.exitFullscreen().catch(() => {});
            }
          }}
          className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface hover:text-foreground"
          title="Fullscreen (F)"
          aria-label="Fullscreen"
        >
          <Maximize className="h-4 w-4" />
        </button>
        <a
          ref={downloadRef}
          href={resource.file_url}
          download
          className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-surface hover:text-foreground"
          title="Download (D)"
          aria-label="Download"
        >
          <Download className="h-4 w-4" />
        </a>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface/50 text-foreground transition-colors hover:bg-destructive/10 hover:text-destructive border border-transparent hover:border-destructive/20 ml-1"
          title="Close viewer (Esc)"
          aria-label="Close viewer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 w-full h-full p-2 sm:p-4 pt-20 sm:pt-24 relative">
        <div className="h-full w-full overflow-hidden rounded-2xl border border-border bg-card shadow-card relative">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/50 backdrop-blur-sm z-20 transition-all duration-300">
              <div className="relative flex items-center justify-center">
                <div className="absolute h-12 w-12 rounded-full border-4 border-muted/20 border-t-foreground animate-spin" />
                <div className="h-6 w-6 rounded-full bg-foreground/10 animate-ping" />
              </div>
              <p className="text-sm font-medium text-foreground/75 mt-6 tracking-wide animate-pulse">
                Preparing preview...
              </p>
            </div>
          )}
          <iframe
            src={viewerUrl}
            title={resource.title}
            className="h-full w-full bg-background"
            loading="eager"
            onLoad={() => setIsLoading(false)}
          />
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}

