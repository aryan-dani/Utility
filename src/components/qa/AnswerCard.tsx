"use client";

import { useState } from "react";
import { CheckCircle2, Trash2, User, Clock, Eye, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import type { QAAnswer } from "@/lib/qa/types";
import VoteButton from "./VoteButton";
import QAImageViewer from "./QAImageViewer";

interface AnswerCardProps {
  answer: QAAnswer;
  userVote?: 1 | -1 | null;
  isQuestionAuthor: boolean;
  isOwnAnswer: boolean;
  canModerate?: boolean;
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
  canModerate = false,
  onVote,
  onAccept,
  onDelete,
}: AnswerCardProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const canDelete = (isOwnAnswer || canModerate) && Boolean(onDelete);

  return (
    <>
      <div
        className={cn(
          "p-4 sm:p-5 rounded-2xl border transition-all",
          answer.is_accepted
            ? "bg-emerald-500/[0.04] border-emerald-500/30 dark:border-emerald-500/20 shadow-xs"
            : "bg-card hover:bg-surface/30 border-border/75 shadow-2xs",
        )}
      >
        {answer.is_accepted && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-3 pb-2 border-b border-emerald-500/20">
            <CheckCircle2 className="w-4 h-4 fill-emerald-500/20" />
            <span>Verified Solution by Author</span>
            <Sparkles className="w-3.5 h-3.5 text-emerald-500 ml-auto" />
          </div>
        )}

        {/* Author Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-7 h-7 rounded-xl bg-surface border border-border/80 flex items-center justify-center text-foreground font-bold text-xs shrink-0 shadow-2xs">
              {answer.author_name?.[0]?.toUpperCase() || <User className="w-3.5 h-3.5 text-muted" />}
            </div>
            <span className="font-bold text-foreground truncate">{answer.author_name}</span>
            <span className="text-muted/40">·</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted">
              <Clock className="w-3 h-3" />
              {timeAgo(answer.created_at)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {isQuestionAuthor && !answer.is_accepted && onAccept && (
              <button
                type="button"
                onClick={onAccept}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors active:scale-95"
                title="Mark as verified solution"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Accept Solution</span>
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="p-1.5 rounded-lg text-muted hover:text-destructive hover:bg-destructive/10 transition-colors active:scale-95"
                title={canModerate && !isOwnAnswer ? "Delete as admin" : "Delete your answer"}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Answer body */}
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap pl-0.5">
          {answer.body}
        </p>

        {/* Image Attachments */}
        {answer.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2.5 mt-3.5 pt-2 border-t border-border/40">
            {answer.attachments.map((url, i) => (
              <div
                key={i}
                onClick={() => setPreviewIndex(i)}
                className="relative group w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden border border-border/80 bg-surface/50 cursor-pointer shadow-xs"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Answer attachment ${i + 1}`}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white text-xs font-semibold backdrop-blur-xs">
                  <Eye className="w-4 h-4" />
                  <span>View</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Comment Bottom Bar (Reddit Vote Pill) */}
        <div className="flex items-center justify-between gap-3 mt-3.5 pt-2.5 border-t border-border/40">
          <VoteButton
            upvotes={answer.upvotes}
            downvotes={answer.downvotes}
            userVote={userVote}
            showDownvote
            onVote={onVote}
            size="sm"
          />
        </div>
      </div>

      {/* Lightbox for answer attachments */}
      <QAImageViewer
        open={previewIndex !== null}
        images={answer.attachments}
        initialIndex={previewIndex ?? 0}
        onClose={() => setPreviewIndex(null)}
      />
    </>
  );
}
