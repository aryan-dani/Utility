"use client";

import type { ReactNode } from "react";
import {
  AlertCircle,
  Check,
  Info,
  Loader2,
  RefreshCw,
  Star,
  StarOff,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

export type AppToastKind =
  | "success"
  | "error"
  | "info"
  | "star"
  | "unstar"
  | "loading"
  | "update";

export interface AppToastProps {
  kind?: AppToastKind;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  icon?: ReactNode;
  onDismiss?: () => void;
  showClose?: boolean;
}

const kindIcon: Record<AppToastKind, ReactNode> = {
  success: <Check className="w-3.5 h-3.5" strokeWidth={2.5} />,
  error: <AlertCircle className="w-3.5 h-3.5" strokeWidth={2.25} />,
  info: <Info className="w-3.5 h-3.5" strokeWidth={2.25} />,
  star: <Star className="w-3.5 h-3.5 fill-current" strokeWidth={2} />,
  unstar: <StarOff className="w-3.5 h-3.5" strokeWidth={2.25} />,
  loading: <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.25} />,
  update: <RefreshCw className="w-3.5 h-3.5" strokeWidth={2.25} />,
};

const kindMeta: Record<AppToastKind, string> = {
  success: "Success",
  error: "Error",
  info: "Notice",
  star: "Favorites",
  unstar: "Favorites",
  loading: "Working",
  update: "System",
};

export function AppToast({
  kind = "info",
  title,
  description,
  action,
  icon,
  onDismiss,
  showClose = false,
}: AppToastProps) {
  const isError = kind === "error";
  const isEmphasis = kind === "star" || kind === "update";

  return (
    <div
      className={cn(
        "pointer-events-auto w-[min(100vw-2rem,22rem)] overflow-hidden rounded-[var(--radius-2xl)] border bg-card shadow-window",
        isError ? "border-destructive/45" : "border-border",
      )}
      role="status"
      style={{ boxShadow: "var(--elev-3)" }}
    >
      {/* Title bar - matches WindowChrome */}
      <div
        className={cn(
          "flex items-center gap-2 border-b px-3 py-2",
          isError
            ? "border-destructive/25 bg-destructive/5"
            : "border-border bg-surface/80",
        )}
      >
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
            isError
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : isEmphasis
                ? "border-foreground/20 bg-foreground text-background"
                : "border-border bg-card text-foreground",
          )}
        >
          {icon ?? kindIcon[kind]}
        </div>
        <p
          className={cn(
            "min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[0.14em]",
            isError ? "text-destructive" : "text-muted",
          )}
        >
          {kindMeta[kind]}
        </p>
        {showClose && onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        ) : null}
      </div>

      <div className="px-3.5 py-3">
        <p className="text-sm font-semibold tracking-tight text-foreground">
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-xs leading-relaxed text-muted">{description}</p>
        ) : null}

        {action ? (
          <div className="mt-3 flex justify-end border-t border-border/70 pt-3">
            <Button
              size="sm"
              variant={isError ? "destructive" : "primary"}
              onClick={action.onClick}
              className="min-h-8 rounded-lg px-3.5"
            >
              {action.label}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
