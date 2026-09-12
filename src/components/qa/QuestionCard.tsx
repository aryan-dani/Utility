"use client";

import {
  MessageCircle,
  CheckCircle2,
  Clock,
  User,
  Bookmark,
  BookmarkCheck,
  Image as ImageIcon,
} from "lucide-react";
import { Badge } from "@/components/ui";
import type { QAQuestion } from "@/lib/qa/types";
import VoteButton from "./VoteButton";

interface QuestionCardProps {
  question: QAQuestion;
  userVote?: 1 | -1 | null;
  isSaved?: boolean;
  onVote: (value: 1 | -1) => void;
  onSave: () => void;
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

const CATEGORY_STYLES: Record<string, string> = {
  doubt: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  homework: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  general: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
};

const CATEGORY_LABEL: Record<string, string> = {
  doubt: "Doubt",
  homework: "Homework",
  general: "General",
};

export default function QuestionCard({
  question,
  userVote,
  isSaved,
  onVote,
  onSave,
  onClick,
}: QuestionCardProps) {
  const isResolved = question.status === "resolved";
  const hasAttachments = question.attachments.length > 0;

  return (
    <article
      className="group bg-card p-5 transition-all hover:bg-surface/60 cursor-pointer border-b border-border last:border-b-0"
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
      <div className="flex items-start gap-4">
        {/* Vote column */}
        <div className="shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
          <VoteButton upvotes={question.upvotes} userVote={userVote} onVote={onVote} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Top badges row */}
          <div className="flex items-center flex-wrap gap-2 mb-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${CATEGORY_STYLES[question.category] || ""}`}
            >
              {CATEGORY_LABEL[question.category] || question.category}
            </span>
            {question.topic_unit && (
              <Badge className="text-3xs font-mono">{question.topic_unit}</Badge>
            )}
            {isResolved && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                Resolved
              </span>
            )}
            {hasAttachments && (
              <ImageIcon className="w-3.5 h-3.5 text-muted" />
            )}
          </div>

          {/* Question body preview */}
          <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {question.body}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-4 text-xs text-muted mt-2.5">
            <span className="inline-flex items-center gap-1.5 truncate max-w-[140px]">
              <User className="w-3 h-3" />
              {question.author_name}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MessageCircle className="w-3 h-3" />
              {question.answer_count} {question.answer_count === 1 ? "answer" : "answers"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {timeAgo(question.created_at)}
            </span>
          </div>
        </div>

        {/* Save button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSave();
          }}
          className="shrink-0 p-2 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors"
          title={isSaved ? "Unsave" : "Save"}
        >
          {isSaved ? (
            <BookmarkCheck className="w-4 h-4 text-primary fill-primary/20" />
          ) : (
            <Bookmark className="w-4 h-4" />
          )}
        </button>
      </div>
    </article>
  );
}
