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
import { motion } from "framer-motion";

interface ResourceViewerProps {
  resource: ResourceItem;
  onClose: () => void;
}

function getViewerUrl(resource: ResourceItem) {
  const extension = getFileExtension(resource.title, resource.file_url);
  const isDrive = resource.file_url.includes("drive.google.com");

  if (isDrive) {
    const driveId = getDriveFileId(resource.file_url);
    if (driveId) {
      // Use Google Drive's free built-in preview — renders entirely on Google's
      // infrastructure, zero Vercel compute / bandwidth cost.
      return `https://drive.google.com/file/d/${driveId}/preview`;
    }
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

function getDirectUrl(resource: ResourceItem) {
  const isDrive = resource.file_url.includes("drive.google.com");
  if (isDrive) {
    const driveId = getDriveFileId(resource.file_url);
    if (driveId) {
      // Direct Google Drive download URL — bypasses Vercel entirely
      return `https://drive.google.com/uc?export=download&id=${driveId}`;
    }
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
  const downloadUrl = useMemo(() => getDirectUrl(resource), [resource]);
  const FileIcon = isPresentation ? FileSpreadsheet : FileText;

  const containerRef = useRef<HTMLDivElement>(null);
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const externalRef = useRef<HTMLAnchorElement>(null);

  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset loading state and timeout error when the viewer URL changes
  useEffect(() => {
    setIsLoading(true);
    setLoadError(false);
  }, [viewerUrl]);

  // Loading timeout fallback (15s)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoading) {
      timer = setTimeout(() => {
        setLoadError(true);
      }, 15000);
    } else {
      setLoadError(false);
    }
    return () => clearTimeout(timer);
  }, [isLoading, viewerUrl]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      // Guard against firing shortcuts while typing in inputs
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (event.key.toLowerCase() === "f") {
        if (!document.fullscreenElement) {
          containerRef.current?.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
      if (event.key.toLowerCase() === "d") downloadRef.current?.click();
      if (event.key.toLowerCase() === "o") externalRef.current?.click();

      // Focus trapping
      if (event.key === "Tab") {
        if (!containerRef.current) return;
        const focusableElements = containerRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      }
    }

    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overscrollBehavior = "none";
    window.addEventListener("keydown", handleKeyDown);
    
    // Focus the container to ensure key events are captured immediately
    containerRef.current?.focus();

    return () => {
      document.body.style.overflow = "";
      document.body.style.overscrollBehavior = "";
      document.documentElement.style.overscrollBehavior = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const content = (
    <motion.div 
      ref={containerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="viewer-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md outline-none flex flex-col overscroll-none"
    >
      {/* Left Floating Pill */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-card border-2 border-foreground rounded-none p-2 pr-4 shadow-[4px_4px_0px_0px_rgb(var(--foreground))]"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-none border-2 border-foreground bg-surface">
          <FileIcon className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0">
          <h2 id="viewer-title" className="truncate text-sm font-bold text-foreground">
            {resource.title}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-muted">
              {isPdf ? "PDF" : isPresentation ? "Presentation" : "File"}{" "}
              viewer
            </p>
          </div>
        </div>
      </motion.div>

      {/* Right Floating Pill */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-card border-2 border-foreground rounded-none p-1.5 shadow-[4px_4px_0px_0px_rgb(var(--foreground))]"
      >
        <div className="hidden sm:flex items-center gap-2 px-3 border-r border-border/50 mr-1 text-[10px] font-bold tracking-wide text-muted uppercase">
          <span>O: Open</span>
          <span>F: Full</span>
          <span>D: DL</span>
          <span>Esc: Close</span>
        </div>
        <a
          ref={externalRef}
          href={resource.file_url}
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
          href={downloadUrl}
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
      </motion.div>

      <div className="flex-1 w-full h-full p-2 sm:p-4 pt-20 sm:pt-24 relative">
        <motion.div 
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="h-full w-full overflow-hidden rounded-none border-2 border-foreground bg-card relative"
        >
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-between justify-between p-8 bg-background z-20">
              {/* Shimmer skeleton representing a PDF document */}
              <div className="w-full flex-1 flex flex-col gap-6 animate-pulse mt-12 max-w-4xl mx-auto">
                <div className="h-8 bg-muted/40 rounded-lg w-1/3" />
                <div className="h-4 bg-muted/30 rounded-lg w-full" />
                <div className="h-4 bg-muted/30 rounded-lg w-5/6" />
                <div className="h-4 bg-muted/30 rounded-lg w-4/5" />
                <div className="flex-1 min-h-[200px] border border-border/40 rounded-xl p-6 flex flex-col gap-4">
                  <div className="h-6 bg-muted/30 rounded-lg w-1/4" />
                  <div className="h-40 bg-muted/20 rounded-lg w-full" />
                  <div className="h-4 bg-muted/30 rounded-lg w-3/4" />
                  <div className="h-4 bg-muted/30 rounded-lg w-1/2" />
                </div>
              </div>
              
              {/* Status & fallback message */}
              <div className="w-full text-center pb-8 flex flex-col items-center gap-3">
                <div className="relative flex items-center justify-center">
                  <div className="absolute h-12 w-12 rounded-full border-4 border-muted/20 border-t-foreground animate-spin" />
                  <div className="h-6 w-6 rounded-full bg-foreground/10 animate-ping" />
                </div>
                <p className="text-sm font-medium text-foreground/75 mt-4 tracking-wide">
                  Preparing document preview...
                </p>
                {loadError && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-muted flex flex-col items-center gap-1.5 mt-2"
                  >
                    <span>Having trouble loading?</span>
                    <a
                      href={resource.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground underline underline-offset-4 hover:text-muted transition-colors font-bold inline-flex items-center gap-1"
                    >
                      Open directly <ExternalLink className="h-3 w-3 inline" />
                    </a>
                  </motion.div>
                )}
              </div>
            </div>
          )}
          <iframe
            src={viewerUrl}
            title={resource.title}
            className="h-full w-full bg-background"
            loading="eager"
            allow="autoplay; encrypted-media"
            referrerPolicy="no-referrer"
            onLoad={() => setIsLoading(false)}
          />
        </motion.div>
      </div>
    </motion.div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}
