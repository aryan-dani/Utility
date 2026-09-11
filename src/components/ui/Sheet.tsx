"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { useMotionSafe } from "@/lib/motion";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const motionSafe = useMotionSafe();

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    });
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-modal md:hidden" role="dialog" aria-modal="true">
          <motion.button
            type="button"
            aria-label="Close sheet"
            {...motionSafe.fade}
            transition={{ duration: motionSafe.duration }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80"
          />
          <motion.div
            ref={panelRef}
            {...motionSafe.sheet}
            transition={{ duration: motionSafe.duration, ease: motionSafe.ease }}
            className={cn(
              "absolute inset-x-0 bottom-0 max-h-[min(88vh,720px)] flex flex-col",
              "rounded-t-2xl border border-border bg-card shadow-lg",
              "pb-[env(safe-area-inset-bottom)]",
              className,
            )}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border" aria-hidden />
            <div className="flex items-center justify-between gap-3 px-4 py-3 shrink-0">
              {title ? (
                <h2 className="text-sm font-semibold text-foreground truncate">{title}</h2>
              ) : (
                <span />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                aria-label="Close"
                className="tap-target shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="overflow-y-auto flex-1 px-3 pb-4">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
