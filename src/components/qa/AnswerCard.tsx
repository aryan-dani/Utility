"use client";

import { CheckCircle2, Trash2, User, Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import type { QAAnswer } from "@/lib/qa/types";
import VoteButton from "./VoteButton";

interface AnswerCardProps {
  answer: QAAnswer;
  userVote?: 1 | -1 | null;
  isQuestionAuthor: boolean;
  isOwnAnswer: boolean;
  onVote: (value: 1 | -1) => void;
  onAccept?: () => void;
  onDelete?: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

export default function AnswerCard({
  answer,
  userVote,
  isQuestionAuthor,
  isOwnAnswer,
  onVote,
  onAccept,
  onDelete,
}: AnswerCardProps) {
  return (
    <div
      className={cn(
        "p-4 border-b border-border last:border-b-0",
        answer.is_accepted && "bg-emerald-500/5 border-l-2 border-l-emerald-500",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Vote column */}
        <div className="shrink-0 flex flex-col items-center gap-1.5 pt-0.5">
          <VoteButton
            upvotes={answer.upvotes}
            downvotes={answer.downvotes}
            userVote={userVote}
            showDownvote
            onVote={onVote}
          />
          {answer.is_accepted && (
            <span className="text-emerald-600 dark:text-emerald-400" title="Accepted answer">
              <CheckCircle2 className="w-5 h-5 fill-emerald-500/20" />
            </span>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {answer.body}
          </p>

          {/* Attachments */}
          {answer.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {answer.attachments.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Attachment ${i + 1}`}
                    className="max-w-[200px] max-h-[160px] rounded-lg border border-border object-cover hover:opacity-80 transition-opacity"
                  />
                </a>
              ))}
            </div>
          )}

          {/* Meta row */}
          <div className="flex items-center justify-between gap-4 mt-3 pt-2 border-t border-border/50">
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5 truncate max-w-[140px]">
                <User className="w-3 h-3" />
                {answer.author_name}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {timeAgo(answer.created_at)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isQuestionAuthor && !answer.is_accepted && onAccept && (
                <button
                  type="button"
                  onClick={onAccept}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                  title="Accept this answer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Accept
                </button>
              )}
              {isOwnAnswer && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-muted hover:text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete your answer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
