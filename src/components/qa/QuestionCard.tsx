"use client";

import {
  MessageCircle,
  CheckCircle2,
  Clock,
  User,
  Bookmark,
  BookmarkCheck,
  Image as ImageIcon,
  BookOpen,
  FileText,
  Sparkles,
  ArrowRight,
  Hash,
  Trash2,
} from "lucide-react";
import type { QAQuestion } from "@/lib/qa/types";
import { Card } from "@/components/ui";
import VoteButton from "./VoteButton";

interface QuestionCardProps {
  question: QAQuestion;
  userVote?: 1 | -1 | null;
  isSaved?: boolean;
  canDelete?: boolean;
  onVote: (value: 1 | -1) => void;
  onSave: () => void;
  onDelete?: () => void;
  onClick: () => void;
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

export default function QuestionCard({
  question,
  userVote,
  isSaved,
  canDelete,
  onVote,
  onSave,
  onDelete,
  onClick,
}: QuestionCardProps) {
  const isResolved = question.status === "resolved";
  const hasAttachments = question.attachments && question.attachments.length > 0;
  const firstAttachment = hasAttachments ? question.attachments[0] : null;

  return (
    <Card
      hover
      padding="lg"
      className="group relative bg-card/80 hover:bg-card hover:border-primary/40 cursor-pointer active:scale-[0.97] p-5 sm:p-6"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* ── Top Header Row: Author, Meta & Status/Save ── */}
      <div className="flex items-center justify-between gap-3 mb-3.5">
        {/* Author info & time */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary/80 to-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-xs shrink-0 ring-2 ring-border/50">
            {question.author_name?.[0]?.toUpperCase() || <User className="w-3.5 h-3.5" />}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs sm:text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
              {question.author_name}
            </span>
            <span className="text-muted/40 text-xs select-none">·</span>
            <span className="inline-flex items-center gap-1 text-xs text-muted font-medium shrink-0">
              <Clock className="w-3.5 h-3.5 text-muted/80" />
              {timeAgo(question.created_at)}
            </span>
          </div>
        </div>

        {/* Right Status & Save & Delete */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isResolved && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/25 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Resolved
            </span>
          )}

          {/* Bookmark Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSave();
            }}
            className="p-1.5 sm:p-2 rounded-xl text-muted hover:text-foreground hover:bg-surface border border-transparent hover:border-border/60 transition-all active:scale-95"
            title={isSaved ? "Unsave question" : "Save question"}
            aria-label={isSaved ? "Unsave question" : "Save question"}
          >
            {isSaved ? (
              <BookmarkCheck className="w-4 h-4 text-primary fill-primary/20" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
          </button>

          {/* Delete Button (Author or Admin) */}
          {canDelete && onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1.5 sm:p-2 rounded-xl text-muted/70 hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition-all active:scale-95"
              title="Delete question"
              aria-label="Delete question"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ── Badges Row: Subject, Category, Topic, Reference ── */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 mb-3.5">
        {/* Subject */}
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/25 shadow-2xs">
          <BookOpen className="w-3.5 h-3.5 shrink-0" />
          <span>{question.subject_name}</span>
        </span>

        {/* Category Pill (Doubt / General) */}
        {question.category === "doubt" ? (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shadow-2xs">
            Doubt
          </span>
        ) : (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-2xs">
            General
          </span>
        )}

        {/* Topic / Unit */}
        {question.topic_unit && (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-surface/80 text-foreground/80 border border-border/80 shadow-2xs">
            <Hash className="w-3 h-3 text-muted" />
            <span>{question.topic_unit}</span>
          </span>
        )}

        {/* Referenced Notes or PPT */}
        {question.resource_title && (
          <span
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground px-3 py-1 rounded-full bg-surface/80 border border-border/80 max-w-[260px] truncate shadow-2xs"
            title={`Referenced: ${question.resource_title}`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0 text-primary/80" />
            <span className="truncate">Ref: {question.resource_title}</span>
          </span>
        )}
      </div>

      {/* ── Question Body (Hero Content) ── */}
      <div className="mb-4">
        <p className="text-base sm:text-[17px] font-semibold text-foreground leading-relaxed tracking-tight group-hover:text-primary transition-colors line-clamp-3">
          {question.body}
        </p>
      </div>

      {/* ── Attachment Preview (if any) ── */}
      {firstAttachment && (
        <div className="flex items-center gap-3 mb-4 p-2 pr-4 rounded-2xl bg-surface/50 border border-border/80 hover:bg-surface/80 hover:border-border transition-all max-w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={firstAttachment}
            alt=""
            className="w-12 h-12 rounded-xl object-cover border border-border/80 shadow-xs shrink-0"
          />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-primary" />
              <span>
                {question.attachments.length}{" "}
                {question.attachments.length === 1 ? "attachment" : "attachments"}
              </span>
            </span>
            <span className="text-[11px] text-muted truncate">Click to view & discuss</span>
          </div>
        </div>
      )}

      {/* ── Bottom Action & Social Bar ── */}
      <div className="flex items-center justify-between gap-4 pt-3.5 border-t border-border/50 text-xs">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Upvote Button */}
          <div onClick={(e) => e.stopPropagation()}>
            <VoteButton upvotes={question.upvotes} userVote={userVote} onVote={onVote} />
          </div>

          {/* Answer Count Pill */}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface/80 border border-border/70 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-surface transition-colors">
            <MessageCircle className="w-3.5 h-3.5 text-muted" />
            <span>
              {question.answer_count} {question.answer_count === 1 ? "answer" : "answers"}
            </span>
          </span>

          {/* AI Answered Tag */}
          {question.ai_auto_answered && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-2xs font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
              <Sparkles className="w-3 h-3 text-violet-500" />
              <span className="hidden sm:inline">AI Answered</span>
            </span>
          )}
        </div>

        {/* View Discussion Affordance */}
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted group-hover:text-primary transition-colors">
          <span className="hidden sm:inline">View discussion</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
      </div>
    </Card>
  );
}
