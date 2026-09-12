"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Code2,
  X,
  Maximize,
  Table2,
  Play,
  ImageIcon,
} from "lucide-react";
import { ResourceItem } from "@/lib/dataFetcher";
import {
  getFileExtension,
  getDriveFileId,
  getDriveEmbedUrl,
  isCodeExtension,
  isNotebookExtension,
  isCsvExtension,
  isImageExtension,
} from "@/lib/fileUtils";
import { motion, useReducedMotion } from "framer-motion";
import { cleanResourceTitle, shortCodeLabel } from "@/lib/titleUtils";
import dynamic from "next/dynamic";
import type { PdfPreviewHandle } from "@/components/PdfPreview";
import { folderIdForResource, folderLabelFromId, getResourceFileRole } from "@/lib/resourceGroups";
import { getDirectDownloadUrl, matchCachedDriveFile } from "@/lib/driveFileCache";
import { useIsClient } from "@/lib/clientHooks";
import { WindowChrome, IconButton } from "@/components/ui";

const PdfPreview = dynamic(() => import("@/components/PdfPreview"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center">
      <span className="loading-orb" aria-hidden />
    </div>
  ),
});
const NotebookViewer = dynamic(() => import("@/components/NotebookViewer"), {
  ssr: false,
});
const CsvPreview = dynamic(() => import("@/components/CsvPreview"), {
  ssr: false,
});

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

interface ResourceViewerProps {
  resource: ResourceItem;
  onClose: () => void;
  /** @deprecated Prefer assignmentSiblings */
  relatedCodes?: ResourceItem[];
  /** @deprecated Prefer assignmentSiblings */
  relatedWriteups?: ResourceItem[];
  /** @deprecated Prefer assignmentSiblings */
  relatedDatasets?: ResourceItem[];
  /** All files in the same assignment (writeup, codes, datasets) */
  assignmentSiblings?: ResourceItem[];
  onOpenRelated?: (item: ResourceItem) => void;
  /** Jump to this PDF page once the viewer is ready */
  initialPage?: number | null;
}

function getViewerUrl(resource: ResourceItem) {
  const extension = getFileExtension(resource.title, resource.file_url);
  const driveId = getDriveFileId(resource.file_url);

  if (driveId) {
    return getDriveEmbedUrl(driveId);
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
  const driveId = getDriveFileId(resource.file_url);
  if (driveId) {
    return getDirectDownloadUrl(driveId);
  }
  return resource.file_url;
}

export default function ResourceViewer({
  resource,
  onClose,
  relatedCodes = [],
  relatedWriteups = [],
  relatedDatasets = [],
  assignmentSiblings = [],
  onOpenRelated,
  initialPage = null,
}: ResourceViewerProps) {
  const reduceMotion = useReducedMotion();
  const extension = getFileExtension(resource.title, resource.file_url);
  const isDrive = resource.file_url.includes("drive.google.com");
  const isPdf = extension === "pdf";
  const isPresentation = extension === "ppt" || extension === "pptx";
  const isNotebook = isNotebookExtension(extension);
  const isCsv = isCsvExtension(extension);
  const isImage = isImageExtension(extension);
  const isCode =
    !isCsv &&
    !isImage &&
    (isCodeExtension(extension) || resource.category === "codes");
  const isTextFetch = isCode || isCsv || isNotebook;
  const embedUrl = useMemo(() => getViewerUrl(resource), [resource]);
  const downloadUrl = useMemo(() => getDirectUrl(resource), [resource]);
  const driveId = useMemo(
    () => getDriveFileId(resource.file_url),
    [resource.file_url],
  );
  const driveViewUrl = driveId
    ? `https://drive.google.com/file/d/${driveId}/view`
    : resource.file_url;

  const colabUrl = driveId
    ? `https://colab.research.google.com/drive/${driveId}`
    : null;
  const imageUrl = driveId
    ? `https://drive.google.com/uc?export=view&id=${driveId}`
    : resource.file_url;

  const FileIcon = isImage
    ? ImageIcon
    : isCsv
      ? Table2
      : isCode
        ? Code2
        : isPresentation
          ? FileSpreadsheet
          : FileText;

  const siblings = useMemo(() => {
    if (assignmentSiblings.length > 0) return assignmentSiblings;
    // Fallback: merge legacy related props
    const seen = new Set<string>();
    const merged: ResourceItem[] = [];
    for (const item of [
      ...relatedWriteups,
      ...relatedCodes,
      ...relatedDatasets,
    ]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
    return merged;
  }, [assignmentSiblings, relatedCodes, relatedWriteups, relatedDatasets]);

  const hasRelatedBar = siblings.length > 0 && !!onOpenRelated;

  const folderLabel = folderLabelFromId(folderIdForResource(resource));
  const trailParts = [
    resource.subject_name,
    folderLabel,
    cleanResourceTitle(resource.title),
  ].filter(Boolean) as string[];

  const containerRef = useRef<HTMLDivElement>(null);
  const downloadRef = useRef<HTMLAnchorElement>(null);
  const externalRef = useRef<HTMLAnchorElement>(null);
  const pdfRef = useRef<PdfPreviewHandle>(null);

  const mounted = useIsClient();
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [codeContent, setCodeContent] = useState<string | null>(null);
  const [pdfDirectFailed, setPdfDirectFailed] = useState(false);
  const [hasCachedPdf, setHasCachedPdf] = useState(false);
  const usePdfJs = isPdf && !!driveId && hasCachedPdf && !pdfDirectFailed;
  const usesIframePreview =
    !isTextFetch && !isNotebook && !isImage && !usePdfJs && !!embedUrl;
  const activeIframeSrc = embedUrl;

  const resourcePreviewKey = `${resource.id}:${embedUrl}:${resource.file_url}`;
  const [prevResourcePreviewKey, setPrevResourcePreviewKey] =
    useState(resourcePreviewKey);
  if (prevResourcePreviewKey !== resourcePreviewKey) {
    setPrevResourcePreviewKey(resourcePreviewKey);
    setIsLoading(!(isPdf && getDriveFileId(resource.file_url)));
    setLoadError(false);
    setCodeContent(null);
    setPdfDirectFailed(false);
    setHasCachedPdf(false);
  }

  useEffect(() => {
    if (!isPdf || !driveId) return;
    let cancelled = false;
    matchCachedDriveFile(driveId)
      .then((blob) => {
        if (!cancelled) setHasCachedPdf(!!blob);
      })
      .catch(() => {
        if (!cancelled) setHasCachedPdf(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isPdf, driveId, resource.id]);

  useEffect(() => {
    if (!isTextFetch) return;

    let cancelled = false;
    const abort = new AbortController();

    async function loadText() {
      setIsLoading(true);
      setLoadError(false);
      try {
        if (driveId) {
          const cached = await matchCachedDriveFile(driveId);
          if (!cached) throw new Error("not cached");
          const text = await cached.text();
          if (!cancelled) {
            setCodeContent(text);
            setIsLoading(false);
          }
          return;
        }
        const res = await fetch(resource.file_url, {
          signal: abort.signal,
          credentials: "omit",
          redirect: "follow",
        });
        if (!res.ok) throw new Error("Failed to load file");

        const contentType = (res.headers.get("content-type") || "").toLowerCase();
        if (contentType.includes("text/html")) {
          throw new Error("drive interstitial");
        }

        const totalHeader = res.headers.get("content-length");
        const total = totalHeader ? Number(totalHeader) : null;
        const MAX_TEXT_BYTES = 8 * 1024 * 1024;
        if (total !== null && Number.isFinite(total) && total > MAX_TEXT_BYTES) {
          throw new Error("File too large to preview in-app");
        }

        const text = await res.text();
        if (new TextEncoder().encode(text).length > MAX_TEXT_BYTES) {
          throw new Error("File too large to preview in-app");
        }
        if (!cancelled) {
          setCodeContent(text);
          setIsLoading(false);
        }
      } catch (err) {
        if (abort.signal.aborted || cancelled) return;
        if (!cancelled) {
          setLoadError(true);
          setIsLoading(false);
        }
        void err;
      }
    }

    loadText();
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [isTextFetch, resource.file_url, driveId]);

  useEffect(() => {
    if (!usesIframePreview || !isLoading) return;
    const timer = setTimeout(() => {
      setLoadError(true);
      setIsLoading(false);
    }, 20000);
    return () => clearTimeout(timer);
  }, [usesIframePreview, isLoading, activeIframeSrc]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;

    function handleKeyDown(event: KeyboardEvent) {
      const isMod = event.ctrlKey || event.metaKey || event.altKey;

      if (event.key === "Escape") {
        if (pdfRef.current?.closeFind()) {
          event.preventDefault();
          return;
        }
        if (document.fullscreenElement) {
          event.preventDefault();
          document.exitFullscreen().catch(() => {});
          return;
        }
        onClose();
        return;
      }

      if (isMod && event.key.toLowerCase() === "f" && usePdfJs) {
        event.preventDefault();
        pdfRef.current?.openFind();
        return;
      }

      if (event.key === "Tab") {
        if (!containerRef.current) return;
        const nodes = Array.from(
          containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
        ).filter(
          (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
        );
        if (nodes.length === 0) return;
        const firstElement = nodes[0];
        const lastElement = nodes[nodes.length - 1];

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
        return;
      }

      if (isMod) return;

      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        if (!document.fullscreenElement) {
          containerRef.current?.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
      if (event.key.toLowerCase() === "d") {
        event.preventDefault();
        downloadRef.current?.click();
      }
      if (event.key.toLowerCase() === "o") {
        event.preventDefault();
        externalRef.current?.click();
      }
    }

    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overscrollBehavior = "none";
    window.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => {
      containerRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose, usePdfJs]);

  const viewerKindLabel = isNotebook
    ? "Notebook"
    : isImage
      ? "Image"
      : isCsv
        ? "Dataset"
        : isCode
          ? `${extension.toUpperCase() || "CODE"} source`
          : isPdf
            ? "PDF"
            : isPresentation
              ? "Presentation"
              : "File";

  const content = (
    <motion.div
      ref={containerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby="viewer-title"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-modal bg-background outline-none flex flex-col overscroll-none p-2 sm:p-3"
    >
      <div
        className={`os-window flex flex-col flex-1 min-h-0 relative shadow-window ${
          hasRelatedBar ? "pb-16 sm:pb-20" : ""
        }`}
      >
        <WindowChrome
          titleId="viewer-title"
          icon={<FileIcon className="h-4 w-4" />}
          title={
            <span
              title={
                resource.category === "notes" || /notes?/i.test(resource.title)
                  ? `${resource.title} (Reference only. Not a guarantee of exam content.)`
                  : resource.title
              }
            >
              {cleanResourceTitle(resource.title)}
            </span>
          }
          meta={
            <span title={trailParts.join(" / ")}>
              {trailParts.slice(0, -1).join(" / ") || viewerKindLabel}
              {trailParts.length > 1 ? (
                <span className="ml-1.5 uppercase tracking-wide">
                  · {viewerKindLabel}
                </span>
              ) : null}
            </span>
          }
          hints={["O", "F", "D", "Esc"]}
          actions={
            <>
              {isNotebook && colabUrl ? (
                <a
                  href={colabUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:inline-flex items-center justify-center gap-1.5 h-8 px-3 text-xs font-medium rounded-lg bg-surface border border-border text-foreground hover:bg-surface-hover"
                  title="Open in Google Colab"
                >
                  <Play className="h-3.5 w-3.5" />
                  Colab
                </a>
              ) : null}
              <a
                ref={externalRef}
                href={isDrive ? driveViewUrl : resource.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center justify-center rounded-lg transition-colors text-muted hover:text-foreground hover:bg-surface/80 min-h-11 min-w-11 h-11 w-11 sm:min-h-9 sm:min-w-9 sm:h-9 sm:w-9"
                title="Open in new tab (O)"
                aria-label="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <IconButton
                label="Fullscreen"
                title="Fullscreen (F)"
                className="hidden sm:inline-flex"
                onClick={() => {
                  if (!document.fullscreenElement) {
                    containerRef.current?.requestFullscreen().catch(() => {});
                  } else {
                    document.exitFullscreen().catch(() => {});
                  }
                }}
              >
                <Maximize className="h-4 w-4" />
              </IconButton>
              <a
                ref={downloadRef}
                href={downloadUrl}
                download
                className="inline-flex shrink-0 items-center justify-center rounded-lg transition-colors text-muted hover:text-foreground hover:bg-surface/80 min-h-11 min-w-11 h-11 w-11 sm:min-h-9 sm:min-w-9 sm:h-9 sm:w-9"
                title="Download (D)"
                aria-label="Download"
              >
                <Download className="h-4 w-4" />
              </a>
              <IconButton
                label="Close viewer"
                title="Close viewer (Esc)"
                variant="destructive"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </IconButton>
            </>
          }
        />

        <div className="relative flex-1 min-h-0 overflow-hidden bg-card">
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-between justify-between p-8 bg-background z-20">
              <div className="w-full flex-1 flex flex-col gap-6 mt-12 max-w-4xl mx-auto">
                <div className="skeleton h-8 rounded-lg w-1/3" />
                <div className="skeleton h-4 rounded-lg w-full" />
                <div className="skeleton h-4 rounded-lg w-5/6" />
                <div className="skeleton h-4 rounded-lg w-4/5" />
                <div className="flex-1 min-h-[200px] border border-border/40 rounded-xl p-6 flex flex-col gap-4">
                  <div className="skeleton h-6 rounded-lg w-1/4" />
                  <div className="skeleton h-40 rounded-lg w-full" />
                  <div className="skeleton h-4 rounded-lg w-3/4" />
                  <div className="skeleton h-4 rounded-lg w-1/2" />
                </div>
              </div>

              <div className="w-full text-center pb-8 flex flex-col items-center gap-3">
                <span className="loading-orb" aria-hidden />
                <p className="text-sm font-medium text-foreground/75 mt-2 tracking-wide">
                  {isNotebook
                    ? "Loading notebook..."
                    : isImage
                      ? "Loading image..."
                      : isCsv
                        ? "Loading dataset..."
                        : isCode
                          ? "Loading source..."
                          : "Preparing document preview..."}
                </p>
                {loadError && (
                  <motion.div
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
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

          {isNotebook ? (
            <div className="h-full w-full">
              {codeContent !== null && <NotebookViewer content={codeContent} />}
              {!isLoading && loadError && codeContent === null && (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center text-muted">
                  <p className="text-sm">Could not load notebook in-app.</p>
                  <a
                    href={resource.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground underline underline-offset-4 text-sm"
                  >
                    Open on Drive
                  </a>
                </div>
              )}
            </div>
          ) : isImage ? (
            <div className="h-full w-full overflow-auto bg-background flex items-center justify-center p-4 sm:p-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={cleanResourceTitle(resource.title)}
                className="max-w-full max-h-full object-contain rounded-xl border border-border shadow-sm bg-card"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setLoadError(true);
                  setIsLoading(false);
                }}
              />
              {!isLoading && loadError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-muted bg-background/80">
                  <p className="text-sm">Could not preview image in-app.</p>
                  <a
                    href={downloadUrl}
                    className="text-foreground underline underline-offset-4 text-sm"
                  >
                    Download image
                  </a>
                </div>
              )}
            </div>
          ) : isCsv ? (
            <div className="h-full w-full">
              {codeContent !== null && <CsvPreview content={codeContent} />}
              {!isLoading && loadError && codeContent === null && (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center text-muted">
                  <p className="text-sm">Could not load dataset in-app.</p>
                  <a
                    href={downloadUrl}
                    className="text-foreground underline underline-offset-4 text-sm"
                  >
                    Download CSV
                  </a>
                </div>
              )}
            </div>
          ) : isCode ? (
            <div className="h-full w-full overflow-auto bg-background p-4 sm:p-6">
              {codeContent !== null && (
                <pre className="text-xs sm:text-sm leading-relaxed font-mono text-foreground whitespace-pre tab-size-4">
                  <code>{codeContent}</code>
                </pre>
              )}
              {!isLoading && loadError && codeContent === null && (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center text-muted">
                  <p className="text-sm">Could not load source in-app.</p>
                  <a
                    href={resource.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground underline underline-offset-4 text-sm"
                  >
                    Open on Drive
                  </a>
                </div>
              )}
            </div>
          ) : usePdfJs && driveId ? (
            <PdfPreview
              ref={pdfRef}
              driveId={driveId}
              ext={extension || "pdf"}
              title={cleanResourceTitle(resource.title)}
              fallbackUrl={driveViewUrl}
              resourceId={resource.id}
              onReady={() => {
                setIsLoading(false);
                setLoadError(false);
                if (initialPage && initialPage > 0) {
                  requestAnimationFrame(() => {
                    pdfRef.current?.scrollToPage(initialPage);
                  });
                }
              }}
              onFail={() => {
                setPdfDirectFailed(true);
                setIsLoading(true);
                setLoadError(false);
              }}
            />
          ) : usesIframePreview && activeIframeSrc ? (
            <>
              <iframe
                src={activeIframeSrc}
                title={resource.title}
                className="h-full w-full bg-background"
                loading="eager"
                allow="autoplay; encrypted-media"
                referrerPolicy="no-referrer-when-downgrade"
                onLoad={() => {
                  setIsLoading(false);
                  setLoadError(false);
                }}
              />
              {!isLoading && loadError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-muted bg-background/90 z-10 p-6">
                  <p className="text-sm">Preview is taking longer than usual.</p>
                  <a
                    href={isDrive ? driveViewUrl : resource.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground underline underline-offset-4 text-sm inline-flex items-center gap-1"
                  >
                    Open file <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </>
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-center text-muted">
              <p className="text-sm">Preview not available in-app.</p>
              <a
                href={isDrive ? driveViewUrl : resource.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-4 text-sm inline-flex items-center gap-1"
              >
                Open file <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </div>

      {hasRelatedBar && (
        <motion.div
          initial={reduceMotion ? false : { y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.2 }}
          className="absolute bottom-4 inset-x-0 z-10 flex justify-center px-4 pointer-events-none"
        >
          <div className="pointer-events-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-card/95 backdrop-blur-md border border-border rounded-2xl pl-3 pr-1.5 py-1.5 shadow-popover max-w-[min(96vw,48rem)]">
            <RelatedChipRow
              label={folderLabel ? `This assignment` : "Related files"}
              icon={<Code2 className="h-3.5 w-3.5 text-muted" />}
              items={siblings}
              onOpenRelated={onOpenRelated}
            />
          </div>
        </motion.div>
      )}
    </motion.div>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}

function siblingIcon(item: ResourceItem) {
  const role = getResourceFileRole(item);
  if (role === "dataset") return <Table2 className="h-3.5 w-3.5 text-muted shrink-0" />;
  if (role === "writeup") return <FileText className="h-3.5 w-3.5 text-muted shrink-0" />;
  if (role === "notebook" || role === "code")
    return <Code2 className="h-3.5 w-3.5 text-muted shrink-0" />;
  return <FileText className="h-3.5 w-3.5 text-muted shrink-0" />;
}

function siblingLabel(item: ResourceItem): string {
  const role = getResourceFileRole(item);
  if (role === "dataset" || role === "notebook" || role === "code") {
    return shortCodeLabel(item.title);
  }
  return cleanResourceTitle(item.title);
}

function RelatedChipRow({
  label,
  icon,
  items,
  onOpenRelated,
}: {
  label: string;
  icon: ReactNode;
  items: ResourceItem[];
  onOpenRelated?: (item: ResourceItem) => void;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex items-center gap-1.5 h-8 shrink-0">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted whitespace-nowrap leading-none">
          {label}
        </span>
      </div>
      <div className="w-px h-4 bg-border shrink-0" />
      <div className="flex items-center flex-wrap gap-1.5 min-w-0">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpenRelated?.(item)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-surface hover:bg-surface-hover border border-border text-xs font-medium text-foreground transition-colors max-w-full leading-none"
            title={item.title}
          >
            {siblingIcon(item)}
            <span className="truncate">{siblingLabel(item)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
