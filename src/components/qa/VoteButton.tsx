"use client";

import { ThumbsUp, ThumbsDown } from "lucide-react";
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
}

export default function VoteButton({
  upvotes,
  downvotes = 0,
  userVote,
  showDownvote = false,
  onVote,
  disabled,
  className,
}: VoteButtonProps) {
  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <button
        type="button"
        onClick={() => onVote(1)}
        disabled={disabled}
        className={cn(
          "inline-flex items-center gap-1 px-2.5 min-h-9 rounded-lg text-xs font-bold transition-all",
          userVote === 1
            ? "bg-primary/10 border border-primary/30 text-primary"
            : "bg-surface border border-border text-muted hover:text-foreground hover:bg-surface-hover",
        )}
        title="Upvote"
      >
        <ThumbsUp
          className={cn("w-3.5 h-3.5", userVote === 1 && "fill-current")}
        />
        {upvotes}
      </button>
      {showDownvote && (
        <button
          type="button"
          onClick={() => onVote(-1)}
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 min-h-9 rounded-lg text-xs font-bold transition-all",
            userVote === -1
              ? "bg-destructive/10 border border-destructive/30 text-destructive"
              : "bg-surface border border-border text-muted hover:text-foreground hover:bg-surface-hover",
          )}
          title="Downvote"
        >
          <ThumbsDown
            className={cn("w-3.5 h-3.5", userVote === -1 && "fill-current")}
          />
          {downvotes}
        </button>
      )}
    </div>
  );
}
