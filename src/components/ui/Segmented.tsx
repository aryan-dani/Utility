"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type SegmentedOption<T extends string | number> = {
  value: T;
  label: ReactNode;
};

export interface SegmentedProps<T extends string | number> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  "aria-label"?: string;
}

const sizeClasses = {
  sm: "h-8 px-2.5 text-2xs whitespace-nowrap",
  md: "h-9 px-3 text-xs whitespace-nowrap",
};

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  disabled = false,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: SegmentedProps<T>) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const move = (delta: number) => {
    if (disabled || options.length === 0) return;
    const next = (selectedIndex + delta + options.length) % options.length;
    onChange(options[next].value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(options[0].value);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(options[options.length - 1].value);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex overflow-hidden rounded-lg border border-border bg-surface/40",
        className,
      )}
    >
      {options.map((opt, index) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex flex-1 items-center justify-center font-mono uppercase tracking-wide transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              sizeClasses[size],
              active
                ? "bg-foreground text-background"
                : "text-muted hover:text-foreground",
              index < options.length - 1 && "border-r border-border",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
