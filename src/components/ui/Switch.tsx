"use client";

import { cn } from "@/lib/cn";

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  label,
  className,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full border border-border transition-colors",
        checked ? "bg-foreground" : "bg-surface",
        disabled && "opacity-40 cursor-not-allowed",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4.5 w-4.5 rounded-full bg-background border border-border transition-transform",
          checked ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}
