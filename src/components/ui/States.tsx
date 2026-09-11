import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-border bg-surface px-6 py-12",
        className,
      )}
    >
      {icon ? <div className="mb-3 text-muted">{icon}</div> : null}
      <p className="text-base font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="text-sm text-muted mt-1 max-w-md leading-relaxed">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = "Retry",
  className,
}: {
  title: string;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-dashed border-destructive/30 bg-surface px-4 py-4",
        className,
      )}
    >
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="text-xs text-muted mt-0.5 leading-relaxed">{description}</p>
        ) : null}
      </div>
      {onRetry ? (
        <Button type="button" size="sm" onClick={onRetry} className="shrink-0">
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
