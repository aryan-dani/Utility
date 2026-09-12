"use client";

import { ArrowBigUp, ArrowBigDown } from "lucide-react";
import { cn } from "@/lib/cn";

interface VoteButtonProps {
  upvotes: number;
  downvotes?: number;
  userVote?: 1 | -1 | null;
  /** If true, show downvote button (answers only). */
  showDownvote?: boolean;
  onVote: (value: 1 | -1) => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export default function VoteButton({
  upvotes,
  downvotes = 0,
  userVote,
  showDownvote = false,
  onVote,
  disabled,
  className,
  size = "md",
}: VoteButtonProps) {
  const score = showDownvote ? upvotes - downvotes : upvotes;

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full bg-surface/80 hover:bg-surface border border-border/75 shadow-2xs transition-colors p-0.5 select-none",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onVote(1)}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center rounded-full transition-all active:scale-90",
          size === "sm" ? "p-1" : "p-1.5",
          userVote === 1
            ? "bg-primary text-primary-foreground shadow-xs"
            : "text-muted hover:text-foreground hover:bg-surface-hover",
        )}
        title="Upvote"
        aria-label="Upvote"
      >
        <ArrowBigUp
          className={cn(
            size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4",
            userVote === 1 && "fill-current",
          )}
        />
      </button>

      <span
        className={cn(
          "font-bold tabular-nums",
          size === "sm" ? "px-1.5 text-2xs" : "px-2 text-xs",
          userVote === 1 && "text-primary font-extrabold",
          userVote === -1 && "text-destructive font-extrabold",
          !userVote && "text-foreground",
        )}
      >
        {score}
      </span>

      {showDownvote && (
        <button
          type="button"
          onClick={() => onVote(-1)}
          disabled={disabled}
          className={cn(
            "inline-flex items-center justify-center rounded-full transition-all active:scale-90",
            size === "sm" ? "p-1" : "p-1.5",
            userVote === -1
              ? "bg-destructive text-destructive-foreground shadow-xs"
              : "text-muted hover:text-foreground hover:bg-surface-hover",
          )}
          title="Downvote"
          aria-label="Downvote"
        >
          <ArrowBigDown
            className={cn(
              size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4",
              userVote === -1 && "fill-current",
            )}
          />
        </button>
      )}
    </div>
  );
}

