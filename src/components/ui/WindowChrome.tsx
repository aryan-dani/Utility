import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { KbdHints } from "@/components/ui/Kbd";

export interface WindowChromeProps {
  icon?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  hints?: string[];
  actions?: ReactNode;
  className?: string;
  titleId?: string;
  variant?: "default" | "island";
}

/** OS-style in-flow window title bar (icon + title + optional kbd hints + actions). */
export function WindowChrome({
  icon,
  title,
  meta,
  hints,
  actions,
  className,
  titleId,
  variant = "default",
}: WindowChromeProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b shrink-0 min-w-0 px-2.5 py-2",
        variant === "island"
          ? "border-border/60 bg-card/60"
          : "border-border bg-card/90",
        className,
      )}
    >
      {icon ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-foreground">
          {icon}
        </div>
      ) : null}
      <div className="min-w-0 flex-1 leading-tight">
        <h2
          id={titleId}
          className="truncate text-sm font-semibold text-foreground"
        >
          {title}
        </h2>
        {meta ? (
          <p className="truncate text-2xs text-muted mt-0.5">{meta}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-0.5 shrink-0 min-w-0">
        {hints && hints.length > 0 ? <KbdHints keys={hints} /> : null}
        {actions}
      </div>
    </div>
  );
}
