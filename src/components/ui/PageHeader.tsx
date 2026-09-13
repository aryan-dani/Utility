import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Home / marketing: larger display. App pages: compact. */
  size?: "app" | "hero";
  /** Adds a bottom hairline + spacing used by app list pages. */
  divider?: boolean;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  size = "app",
  divider = false,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6",
        divider && "border-b border-border pb-6 mb-6",
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? (
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={cn(
            "font-display text-foreground tracking-tight",
            size === "hero"
              ? "text-4xl sm:text-5xl md:text-6xl"
              : "text-2xl sm:text-3xl",
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="text-sm text-muted max-w-2xl leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
      ) : null}
    </header>
  );
}
