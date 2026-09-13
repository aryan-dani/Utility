import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Field({
  label,
  htmlFor,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted leading-relaxed">{hint}</p> : null}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      {eyebrow ? (
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-muted">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description ? (
        <p className="text-sm text-muted leading-relaxed">{description}</p>
      ) : null}
    </div>
  );
}

export function ListRow({
  title,
  description,
  trailing,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 min-h-11 px-3 py-2 rounded-lg",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
        {description ? (
          <p className="text-xs text-muted truncate">{description}</p>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

const widthClasses = {
  narrow: "max-w-5xl",
  wide: "max-w-7xl",
  full: "max-w-[1800px] 2xl:max-w-[2040px]",
} as const;

export type PageShellWidth = keyof typeof widthClasses;

export interface PageShellProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Content max-width. Default: wide (7xl). */
  width?: PageShellWidth;
}

/** Shared page container — gutters + vertical rhythm + max-width. */
export function PageShell({
  width = "wide",
  className,
  children,
  ...props
}: PageShellProps) {
  return (
    <div
      className={cn("page-shell", widthClasses[width], className)}
      {...props}
    >
      {children}
    </div>
  );
}
