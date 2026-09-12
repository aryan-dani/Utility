"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { matchCachedDriveFile, type DriveFetchProgress } from "@/lib/driveFileCache";
import { setReadingProgress } from "@/lib/readingProgress";
import { cn } from "@/lib/cn";
import { IconButton, Input, Kbd, Toolbar, ToolbarGroup } from "@/components/ui";

export type PdfPreviewHandle = {
  /** Returns true if find UI was open and is now closed. */
  closeFind: () => boolean;
  openFind: () => void;
  scrollToPage: (page: number) => void;
};

interface PdfPreviewProps {
  driveId: string;
  ext?: string;
  title: string;
  fallbackUrl: string;
  /** When set, page changes are persisted to localStorage for resume. */
  resourceId?: string;
  onReady?: () => void;
  onFail?: () => void;
}

type PdfModule = typeof import("pdfjs-dist");
type PdfDocument = Awaited<ReturnType<PdfModule["getDocument"]>["promise"]>;

type FindHit = { page: number; snippet: string; occurrence: number };

const BUFFER_PAGES = 2;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function PdfPage({
  pdf,
  pdfjs,
  pageNumber,
  scale,
  findQuery,
  activeOccurrence,
  onHeight,
}: {
  pdf: PdfDocument;
  pdfjs: PdfModule;
  pageNumber: number;
  scale: number;
  findQuery: string;
  /** Which match index on this page is active (-1 = none). */
  activeOccurrence: number;
  onHeight: (page: number, height: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let layer: InstanceType<PdfModule["TextLayer"]> | null = null;
    let renderTask: { cancel: () => void } | null = null;

    async function paint() {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const textEl = textRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !textEl || !wrap) return;

      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      wrap.style.width = `${viewport.width}px`;
      wrap.style.height = `${viewport.height}px`;
      onHeight(pageNumber, viewport.height);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const transform =
        outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
      const task = page.render({ canvasContext: ctx, viewport, canvas, transform });
      renderTask = task;
      await task.promise;
      if (cancelled) return;

      textEl.replaceChildren();
      const textContent = await page.getTextContent();
      if (cancelled) return;
      layer = new pdfjs.TextLayer({
        textContentSource: textContent,
        container: textEl,
        viewport,
      });
      await layer.render();
      if (cancelled) return;

      const q = findQuery.trim().toLowerCase();
      if (!q) return;
      const divs = layer.textDivs;
      let occurrence = 0;
      for (const el of divs) {
        const t = (el.textContent || "").toLowerCase();
        // A single text span may contain multiple hits - count each.
        let from = 0;
        let hitCountInDiv = 0;
        while (from <= t.length) {
          const at = t.indexOf(q, from);
          if (at < 0) break;
          hitCountInDiv += 1;
          from = at + q.length;
        }
        if (hitCountInDiv === 0) continue;
        el.classList.add("pdf-find-hit");
        // Activate if any occurrence inside this div is the active one.
        for (let i = 0; i < hitCountInDiv; i++) {
          if (occurrence + i === activeOccurrence) {
            el.classList.add("pdf-find-hit-active");
          }
        }
        occurrence += hitCountInDiv;
      }
    }

    void paint().catch(() => {});
    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {
        /* ignore */
      }
      layer?.cancel();
    };
  }, [pdf, pdfjs, pageNumber, scale, findQuery, activeOccurrence, onHeight]);

  return (
    <div
      ref={wrapRef}
      data-pdf-page={pageNumber}
      className="relative mx-auto mb-4 bg-white shadow-sm border border-border rounded-lg overflow-hidden"
    >
      <canvas ref={canvasRef} className="block max-w-full" />
      <div ref={textRef} className="pdf-text-layer" />
    </div>
  );
}

const PdfPreview = forwardRef<PdfPreviewHandle, PdfPreviewProps>(
  function PdfPreview(
    { driveId, ext = "pdf", title, fallbackUrl, resourceId, onReady, onFail },
    ref,
  ) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const findInputRef = useRef<HTMLInputElement>(null);
    const genRef = useRef(0);
    const docRef = useRef<PdfDocument | null>(null);
    const onReadyRef = useRef(onReady);
    const onFailRef = useRef(onFail);
    useEffect(() => {
      onReadyRef.current = onReady;
      onFailRef.current = onFail;
    }, [onReady, onFail]);

    const [pdfjs, setPdfjs] = useState<PdfModule | null>(null);
    const [pdf, setPdf] = useState<PdfDocument | null>(null);
    const [pageCount, setPageCount] = useState(0);
    const [page, setPage] = useState(1);
    const [scale, setScale] = useState(1.15);
    const [failed, setFailed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [downloadProgress, setDownloadProgress] =
      useState<DriveFetchProgress | null>(null);
    const [textReady, setTextReady] = useState(false);
    const [heights, setHeights] = useState<Record<number, number>>({});
    const [visible, setVisible] = useState<Set<number>>(new Set([1, 2, 3]));
    const [findOpen, setFindOpen] = useState(false);
    const [findQuery, setFindQuery] = useState("");
    const [hitIndex, setHitIndex] = useState(0);
    const [jumpValue, setJumpValue] = useState("1");
    const [pageTexts, setPageTexts] = useState<string[]>([]);

    const [prevDriveId, setPrevDriveId] = useState(driveId);
    if (prevDriveId !== driveId) {
      setPrevDriveId(driveId);
      setLoading(true);
      setFailed(false);
      setDownloadProgress(null);
      setTextReady(false);
      setPdf(null);
      setPdfjs(null);
      setPageCount(0);
      setPage(1);
      setJumpValue("1");
      setVisible(new Set([1, 2, 3]));
      setHitIndex(0);
      setPageTexts([]);
    }

    useLayoutEffect(() => {
      if (docRef.current) {
        void docRef.current.destroy().catch(() => {});
        docRef.current = null;
      }
    }, [driveId]);

    const hits = useMemo(() => {
      if (!textReady) return [] as FindHit[];
      const q = findQuery.trim().toLowerCase();
      if (!q) return [] as FindHit[];
      const found: FindHit[] = [];
      pageTexts.forEach((text, pageNum) => {
        if (!text) return;
        const lower = text.toLowerCase();
        let from = 0;
        let occurrence = 0;
        while (found.length < 200) {
          const at = lower.indexOf(q, from);
          if (at < 0) break;
          found.push({
            page: pageNum,
            snippet: text.slice(Math.max(0, at - 24), at + q.length + 24),
            occurrence,
          });
          occurrence += 1;
          from = at + q.length;
        }
      });
      return found;
    }, [findQuery, textReady, pageTexts]);

    const findKey = `${findQuery}:${textReady}`;
    const [prevFindKey, setPrevFindKey] = useState(findKey);
    if (prevFindKey !== findKey) {
      setPrevFindKey(findKey);
      setHitIndex(0);
    }

    const activeHit = hits[hitIndex] ?? null;

    const activeOccurrenceOnPage = useMemo(() => {
      if (!activeHit) return -1;
      return activeHit.occurrence;
    }, [activeHit]);

    useEffect(() => {
      const gen = ++genRef.current;
      let cancelled = false;

      (async () => {
        try {
          const mod = await import("pdfjs-dist");
          mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
          // Only render with pdf.js when bytes are already in the Cache API.
          // Cross-origin fetch to drive.usercontent.google.com is 403/CORS.
          const blob = await matchCachedDriveFile(driveId);
          if (!blob) throw new Error("not cached");
          if (cancelled || gen !== genRef.current) return;
          const data = await blob.arrayBuffer();
          if (cancelled || gen !== genRef.current) return;
          const doc = await mod.getDocument({ data }).promise;
          if (cancelled || gen !== genRef.current) {
            void doc.destroy().catch(() => {});
            return;
          }
          docRef.current = doc;
          setPdfjs(mod);
          setPdf(doc);
          setPageCount(doc.numPages);
          setPage(1);
          setJumpValue("1");
          setVisible(new Set([1, 2, Math.min(3, doc.numPages)]));
          setLoading(false);
          setDownloadProgress(null);

          const texts: string[] = [];
          for (let i = 1; i <= doc.numPages; i++) {
            if (cancelled || gen !== genRef.current) return;
            const p = await doc.getPage(i);
            const tc = await p.getTextContent();
            texts[i] = tc.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(" ");
          }
          if (cancelled || gen !== genRef.current) return;
          setPageTexts(texts);
          setTextReady(true);
          onReadyRef.current?.();
        } catch (err) {
          if (cancelled) return;
          if (gen === genRef.current) {
            setFailed(true);
            setLoading(false);
            setDownloadProgress(null);
            onFailRef.current?.();
          }
          void err;
        }
      })();

      return () => {
        cancelled = true;
        if (docRef.current) {
          void docRef.current.destroy().catch(() => {});
          docRef.current = null;
        }
      };
    }, [driveId, ext]);

    const onHeight = useCallback((pageNum: number, height: number) => {
      setHeights((prev) =>
        prev[pageNum] === height ? prev : { ...prev, [pageNum]: height },
      );
    }, [setHeights]);

    const estimatedHeight = useMemo(() => {
      const vals = Object.values(heights);
      if (vals.length === 0) return 900;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    }, [heights]);

    const scrollToPage = useCallback((n: number) => {
      const el = scrollRef.current?.querySelector(`[data-pdf-page="${n}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
      setPage(n);
      setJumpValue(String(n));
    }, [setPage, setJumpValue]);

    useEffect(() => {
      if (!hits[0]) return;
      const el = scrollRef.current?.querySelector(`[data-pdf-page="${hits[0].page}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [hits]);

    useImperativeHandle(
      ref,
      () => ({
        closeFind: () => {
          if (!findOpen) return false;
          setFindOpen(false);
          return true;
        },
        openFind: () => {
          if (!textReady) return;
          setFindOpen(true);
          requestAnimationFrame(() => findInputRef.current?.focus());
        },
        scrollToPage,
      }),
      [findOpen, textReady, scrollToPage],
    );

    useEffect(() => {
      const root = scrollRef.current;
      if (!root || pageCount === 0) return;

      const observer = new IntersectionObserver(
        (entries) => {
          const nextVisible = new Set<number>();
          let currentPage: number | null = null;
          for (const e of entries) {
            const num = Number((e.target as HTMLElement).dataset.pdfPage);
            if (!num) continue;
            if (e.isIntersecting) {
              for (let i = num - BUFFER_PAGES; i <= num + BUFFER_PAGES; i++) {
                if (i >= 1 && i <= pageCount) nextVisible.add(i);
              }
              if (e.intersectionRatio > 0.4) {
                currentPage = num;
              }
            }
          }
          setVisible((prev) => {
            const merged = new Set(prev);
            for (const n of nextVisible) merged.add(n);
            return merged;
          });
          if (currentPage != null) {
            setPage(currentPage);
            setJumpValue(String(currentPage));
          }
        },
        { root, threshold: [0.05, 0.4] },
      );

      const nodes = root.querySelectorAll("[data-pdf-slot]");
      nodes.forEach((n) => observer.observe(n));
      return () => observer.disconnect();
    }, [pageCount, pdf, scale]);

    // Debounced reading progress
    useEffect(() => {
      if (!resourceId || page < 1) return;
      const timer = window.setTimeout(() => {
        setReadingProgress(resourceId, page);
      }, 400);
      return () => window.clearTimeout(timer);
    }, [resourceId, page]);

    const goHit = (dir: number) => {
      if (hits.length === 0) return;
      const next = (hitIndex + dir + hits.length) % hits.length;
      setHitIndex(next);
      scrollToPage(hits[next].page);
    };

    useEffect(() => {
      function onKey(e: KeyboardEvent) {
        const mod = e.ctrlKey || e.metaKey;
        if (mod && e.key.toLowerCase() === "f") {
          e.preventDefault();
          e.stopPropagation();
          if (!textReady) return;
          setFindOpen(true);
          requestAnimationFrame(() => findInputRef.current?.focus());
        }
      }
      window.addEventListener("keydown", onKey, true);
      return () => window.removeEventListener("keydown", onKey, true);
    }, [textReady]);

    return (
      <div className="relative h-full w-full flex flex-col bg-background">
        <Toolbar className="shrink-0">
          <ToolbarGroup>
            <IconButton
              size="sm"
              label="Previous page"
              onClick={() => scrollToPage(Math.max(1, page - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </IconButton>
            <input
              value={jumpValue}
              onChange={(e) => setJumpValue(e.target.value.replace(/[^\d]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const n = Math.min(
                    pageCount,
                    Math.max(1, Number(jumpValue) || 1),
                  );
                  scrollToPage(n);
                }
              }}
              className="w-10 bg-transparent text-center text-xs font-semibold text-foreground outline-none"
              aria-label="Page number"
            />
            <span className="text-muted tabular-nums pr-1 text-xs">/ {pageCount || "-"}</span>
            <IconButton
              size="sm"
              label="Next page"
              onClick={() => scrollToPage(Math.min(pageCount, page + 1))}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </IconButton>
          </ToolbarGroup>

          <ToolbarGroup>
            <IconButton
              size="sm"
              label="Zoom out"
              onClick={() => setScale((s) => Math.max(0.7, +(s - 0.15).toFixed(2)))}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </IconButton>
            <span className="w-10 text-center text-xs font-semibold tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <IconButton
              size="sm"
              label="Zoom in"
              onClick={() => setScale((s) => Math.min(2.4, +(s + 0.15).toFixed(2)))}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </IconButton>
            <button
              type="button"
              onClick={() => setScale(1)}
              className="px-1.5 min-h-8 rounded-md text-2xs font-bold uppercase tracking-wide text-muted hover:text-foreground"
            >
              Fit
            </button>
          </ToolbarGroup>

          <button
            type="button"
            disabled={!textReady}
            onClick={() => {
              if (!textReady) return;
              setFindOpen(true);
              requestAnimationFrame(() => findInputRef.current?.focus());
            }}
            className={cn(
              "inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-semibold",
              textReady
                ? "text-muted hover:text-foreground"
                : "text-muted/50 cursor-not-allowed",
            )}
          >
            <Search className="h-3.5 w-3.5" />
            {textReady ? (
              <>
                Find
                <Kbd className="hidden sm:inline-flex ml-0.5">Ctrl F</Kbd>
              </>
            ) : (
              "Indexing…"
            )}
          </button>

          <span className="ml-auto truncate text-muted text-xs hidden md:inline">{title}</span>
        </Toolbar>

        {findOpen && (
          <div className="shrink-0 border-b border-border bg-card px-3 py-2 flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted shrink-0" />
            <Input
              ref={findInputRef}
              inputSize="sm"
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  goHit(e.shiftKey ? -1 : 1);
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setFindOpen(false);
                }
              }}
              placeholder="Find in document"
              className="flex-1 min-w-0 border-0 bg-transparent shadow-none px-0"
              autoFocus
            />
            <span className="text-2xs font-semibold tabular-nums text-muted shrink-0">
              {hits.length === 0
                ? findQuery.trim()
                  ? "0 matches"
                  : ""
                : `${hitIndex + 1} / ${hits.length}`}
            </span>
            <IconButton size="sm" label="Previous match" onClick={() => goHit(-1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton size="sm" label="Next match" onClick={() => goHit(1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton size="sm" label="Close find" onClick={() => setFindOpen(false)}>
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-auto pdf-scroll p-4 sm:p-6">
          {loading && !failed && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted w-full max-w-sm mx-auto px-4">
              <span className="loading-orb" aria-hidden />
              <p className="text-sm font-medium">
                {downloadProgress
                  ? downloadProgress.total
                    ? `Downloading ${formatBytes(downloadProgress.loaded)} / ${formatBytes(downloadProgress.total)}`
                    : `Downloading ${formatBytes(downloadProgress.loaded)}…`
                  : "Loading PDF…"}
              </p>
              {downloadProgress && downloadProgress.total && downloadProgress.total > 0 && (
                <div
                  className="h-1.5 w-full rounded-full bg-surface overflow-hidden border border-border"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(
                    100,
                    Math.round(
                      (downloadProgress.loaded / downloadProgress.total) * 100,
                    ),
                  )}
                >
                  <div
                    className="h-full bg-foreground transition-[width] duration-150 ease-out"
                    style={{
                      width: `${Math.min(
                        100,
                        (downloadProgress.loaded / downloadProgress.total) * 100,
                      )}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {failed && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted">
              <p className="text-sm">Could not render this PDF in-app.</p>
              <a
                href={fallbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-4 text-sm inline-flex items-center gap-1 font-semibold"
              >
                Open on Drive <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {pdf && pdfjs &&
            Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => {
              const h = heights[n] ?? estimatedHeight;
              const shouldPaint = visible.has(n);
              return (
                <div
                  key={`${n}-${scale}`}
                  data-pdf-slot={n}
                  data-pdf-page={n}
                  style={{ minHeight: shouldPaint ? undefined : h }}
                >
                  {shouldPaint ? (
                    <PdfPage
                      pdf={pdf}
                      pdfjs={pdfjs}
                      pageNumber={n}
                      scale={scale}
                      findQuery={findQuery}
                      activeOccurrence={
                        activeHit?.page === n ? activeOccurrenceOnPage : -1
                      }
                      onHeight={onHeight}
                    />
                  ) : (
                    <div
                      className="mx-auto mb-4 rounded-lg border border-border bg-surface/40"
                      style={{ height: h }}
                    />
                  )}
                </div>
              );
            })}
        </div>
      </div>
    );
  },
);

export default PdfPreview;
