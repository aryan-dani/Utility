"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useIsClient } from "@/lib/clientHooks";

interface DockTooltipProps {
  label: string;
  badge?: string;
  shortcut?: string;
  disabled?: boolean;
  children: (props: {
    ref: React.RefObject<HTMLElement | null>;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: () => void;
    onBlur: () => void;
  }) => React.ReactNode;
}

export function DockTooltip({
  label,
  badge,
  shortcut,
  disabled = false,
  children,
}: DockTooltipProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const mounted = useIsClient();
  const triggerRef = useRef<HTMLElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const showTooltip = () => {
    if (disabled) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + rect.height / 2,
        left: rect.right + 12,
      });
      setOpen(true);
    }
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 50);
  };

  return (
    <>
      {children({
        ref: triggerRef,
        onMouseEnter: showTooltip,
        onMouseLeave: hideTooltip,
        onFocus: showTooltip,
        onBlur: hideTooltip,
      })}

      {mounted &&
        open &&
        coords &&
        !disabled &&
        createPortal(
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, scale: 0.92, x: -6, y: "-50%" }}
              animate={{ opacity: 1, scale: 1, x: 0, y: "-50%" }}
              exit={{ opacity: 0, scale: 0.92, x: -4, y: "-50%" }}
              transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "fixed",
                top: coords.top,
                left: coords.left,
                zIndex: 9999,
                pointerEvents: "none",
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-foreground text-background text-xs font-semibold shadow-2xl border border-background/20 backdrop-blur-md whitespace-nowrap"
            >
              <span>{label}</span>
              {badge && (
                <span className="px-1.5 py-0.5 rounded-md bg-background/20 text-background text-[9px] font-bold uppercase tracking-wider">
                  {badge}
                </span>
              )}
              {shortcut && (
                <kbd className="px-1.5 py-0.5 rounded-md bg-background/20 text-background text-[10px] font-mono font-medium">
                  {shortcut}
                </kbd>
              )}
            </motion.div>
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
