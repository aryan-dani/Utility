"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Copy,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";
import { useIsClient } from "@/lib/clientHooks";
import { notify } from "@/lib/toast";

interface QAImageViewerProps {
  images: string[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

export default function QAImageViewer({
  images,
  initialIndex = 0,
  open,
  onClose,
}: QAImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [copied, setCopied] = useState(false);
  const mounted = useIsClient();
  const containerRef = useRef<HTMLDivElement>(null);

  const [prevOpen, setPrevOpen] = useState(open);
  const [prevInitialIndex, setPrevInitialIndex] = useState(initialIndex);

  if (open !== prevOpen || initialIndex !== prevInitialIndex) {
    setPrevOpen(open);
    setPrevInitialIndex(initialIndex);
    if (open) {
      setCurrentIndex(initialIndex);
      setScale(1);
    }
  }

  const handleNext = useCallback(() => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setScale(1);
    }
  }, [currentIndex, images.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setScale(1);
    }
  }, [currentIndex]);

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.3, 3.5));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.3, 0.6));
  };

  const handleResetZoom = () => {
    setScale(1);
  };

  const handleDownload = () => {
    const src = images[currentIndex];
    if (!src) return;
    const a = document.createElement("a");
    a.href = src;
    a.download = `doubt-attachment-${currentIndex + 1}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopy = async () => {
    const src = images[currentIndex];
    if (!src) return;
    try {
      if (src.startsWith("http")) {
        await navigator.clipboard.writeText(src);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        notify.success("Image URL copied!");
      } else {
        // Data URL - fetch blob and write to clipboard
        const res = await fetch(src);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        notify.success("Image copied to clipboard!");
      }
    } catch {
      notify.error("Could not copy image.");
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowRight") {
        handleNext();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn();
      } else if (e.key === "-") {
        handleZoomOut();
      } else if (e.key === "0") {
        handleResetZoom();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, handleNext, handlePrev]);

  if (!mounted || !open || images.length === 0) return null;

  const currentImage = images[currentIndex];

  return createPortal(
    <AnimatePresence>
      <div
        ref={containerRef}
        className="fixed inset-0 z-[10000] flex flex-col bg-black/95 backdrop-blur-2xl select-none"
        role="dialog"
        aria-modal="true"
      >
        {/* Top bar controls */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/10 bg-black/40 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-white/70 tracking-wide font-mono">
              {currentIndex + 1} / {images.length}
            </span>
            {scale !== 1 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/80">
                {Math.round(scale * 100)}%
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleZoomOut}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
              title="Zoom out (-)"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
              title="Reset zoom (0)"
              aria-label="Reset zoom"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomIn}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
              title="Zoom in (+)"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-white/15 mx-1" />

            <button
              onClick={handleCopy}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
              title="Copy image or URL"
              aria-label="Copy image"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleDownload}
              className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
              title="Download image"
              aria-label="Download image"
            >
              <Download className="w-4 h-4" />
            </button>

            <div className="w-px h-5 bg-white/15 mx-1" />

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white active:scale-95 transition-all"
              title="Close (Esc)"
              aria-label="Close image viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center viewport */}
        <div
          className="flex-1 relative flex items-center justify-center overflow-hidden p-4 sm:p-8 cursor-grab active:cursor-grabbing"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {/* Previous image arrow */}
          {images.length > 1 && currentIndex > 0 && (
            <button
              onClick={handlePrev}
              className="absolute left-4 z-20 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white backdrop-blur-md transition-all shadow-lg hover:scale-105 active:scale-95"
              title="Previous image (←)"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Next image arrow */}
          {images.length > 1 && currentIndex < images.length - 1 && (
            <button
              onClick={handleNext}
              className="absolute right-4 z-20 p-3 rounded-full bg-white/10 hover:bg-white/25 text-white backdrop-blur-md transition-all shadow-lg hover:scale-105 active:scale-95"
              title="Next image (→)"
              aria-label="Next image"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* Main draggable / zoomable image */}
          <motion.div
            key={currentIndex}
            drag={scale > 1}
            dragConstraints={containerRef}
            dragElastic={0.1}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex items-center justify-center max-w-full max-h-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentImage}
              alt={`Attachment ${currentIndex + 1}`}
              className="max-h-[82vh] max-w-[90vw] object-contain rounded-xl shadow-2xl pointer-events-none select-none"
              draggable={false}
            />
          </motion.div>
        </div>

        {/* Bottom thumbnail strip if multi-image */}
        {images.length > 1 && (
          <div className="flex items-center justify-center gap-2 p-3 bg-black/40 border-t border-white/10 backdrop-blur-md shrink-0">
            {images.map((src, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setCurrentIndex(idx);
                  setScale(1);
                }}
                className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                  idx === currentIndex
                    ? "border-white scale-105 shadow-md"
                    : "border-white/20 opacity-50 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </AnimatePresence>,
    document.body,
  );
}
