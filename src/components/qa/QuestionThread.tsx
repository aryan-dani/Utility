"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  RotateCcw,
  Clock,
  Bookmark,
  BookmarkCheck,
  Trash2,
  Loader2,
  Share2,
  Eye,
  Check,
  MessageSquare,
  BookOpen,
  FileText,
  ExternalLink,
  Hash,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { notify } from "@/lib/toast";
import { auth } from "@/lib/firebase";
import { useAdminStatus } from "@/lib/adminStatus";
import type {
  QAQuestionWithAnswers,
  VoteValue,
} from "@/lib/qa/types";
import VoteButton from "./VoteButton";
import AnswerCard from "./AnswerCard";
import AnswerComposer from "./AnswerComposer";
import QAImageViewer from "./QAImageViewer";

interface QuestionThreadProps {
  questionId: string;
  open: boolean;
  onClose: () => void;
  onQuestionUpdated?: () => void;
}

const CATEGORY_STYLES: Record<string, string> = {
  doubt: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  general: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
};

const CATEGORY_LABEL: Record<string, string> = {
  doubt: "Doubt",
  general: "General",
};

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

export default function QuestionThread({
  questionId,
  open,
  onClose,
  onQuestionUpdated,
}: QuestionThreadProps) {
  const [data, setData] = useState<QAQuestionWithAnswers | null>(null);
  const [loading, setLoading] = useState(true);
  const [answerVotes, setAnswerVotes] = useState<Record<string, VoteValue | null>>({});
  const [copiedLink, setCopiedLink] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);
  const [answerSort, setAnswerSort] = useState<"top" | "newest">("top");

  const currentUid = auth.currentUser?.uid;
  const { isAdmin } = useAdminStatus();
  const canModerate = Boolean(isAdmin);

  const fetchThread = useCallback(async (showLoading = false) => {
    if (!questionId) return;
    if (showLoading) setLoading(true);
    try {
      const res = await authFetch(`/api/qa/questions/${questionId}`);
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setData(json.question);
    } catch {
      notify.error("Could not load question.");
    } finally {
      setLoading(false);
    }
  }, [questionId]);

  useEffect(() => {
    if (!open || !questionId) return;
    let active = true;

    authFetch(`/api/qa/questions/${questionId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json) => {
        if (active) {
          setData(json.question);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          notify.error("Could not load question.");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [open, questionId]);

  const handleQuestionVote = async (value: VoteValue) => {
    if (!data) return;
    const oldVote = data.user_vote;
    const isToggleOff = oldVote === value;

    // Optimistic update
    setData((prev) =>
      prev
        ? {
            ...prev,
            user_vote: isToggleOff ? null : value,
            upvotes: prev.upvotes + (isToggleOff ? -1 : oldVote ? 0 : 1),
          }
        : prev,
    );

    try {
      await authFetch("/api/qa/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: "question", target_id: questionId, value }),
      });
    } catch {
      // Revert
      setData((prev) => (prev ? { ...prev, user_vote: oldVote } : prev));
      notify.error("Vote failed.");
    }
  };

  const handleAnswerVote = async (answerId: string, value: VoteValue) => {
    const oldVote = answerVotes[answerId] ?? null;
    const isToggleOff = oldVote === value;

    setAnswerVotes((prev) => ({ ...prev, [answerId]: isToggleOff ? null : value }));
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        answers: prev.answers.map((a) => {
          if (a.id !== answerId) return a;
          if (isToggleOff) {
            return value === 1
              ? { ...a, upvotes: a.upvotes - 1 }
              : { ...a, downvotes: a.downvotes - 1 };
          }
          if (oldVote === null) {
            return value === 1
              ? { ...a, upvotes: a.upvotes + 1 }
              : { ...a, downvotes: a.downvotes + 1 };
          }
          // Switched direction
          return value === 1
            ? { ...a, upvotes: a.upvotes + 1, downvotes: a.downvotes - 1 }
            : { ...a, upvotes: a.upvotes - 1, downvotes: a.downvotes + 1 };
        }),
      };
    });

    try {
      await authFetch("/api/qa/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: "answer", target_id: answerId, value }),
      });
    } catch {
      setAnswerVotes((prev) => ({ ...prev, [answerId]: oldVote }));
      notify.error("Vote failed.");
    }
  };

  const handleAccept = async (answerId: string) => {
    try {
      const res = await authFetch(`/api/qa/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted_answer_id: answerId }),
      });
      if (!res.ok) throw new Error();
      await fetchThread();
      onQuestionUpdated?.();
      notify.success("Answer accepted as verified solution!");
    } catch {
      notify.error("Could not accept answer.");
    }
  };

  const handleResolveToggle = async () => {
    if (!data) return;
    const newStatus = data.status === "open" ? "resolved" : "open";
    try {
      const res = await authFetch(`/api/qa/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      setData((prev) => (prev ? { ...prev, status: newStatus } : prev));
      onQuestionUpdated?.();
      notify.success(newStatus === "resolved" ? "Marked as resolved!" : "Reopened question.");
    } catch {
      notify.error("Could not update status.");
    }
  };

  const handleSaveToggle = async () => {
    try {
      const res = await authFetch("/api/qa/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: questionId }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData((prev) => (prev ? { ...prev, is_saved: json.saved } : prev));
      notify.success(json.saved ? "Saved to your bookmarks" : "Removed from bookmarks");
    } catch {
      notify.error("Could not toggle bookmark.");
    }
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
      notify.success("Question link copied to clipboard!");
    } catch {
      notify.error("Could not copy link.");
    }
  };

  const handleSubmitAnswer = async (body: string, attachments: string[]) => {
    try {
      const res = await authFetch(`/api/qa/questions/${questionId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, attachments }),
      });
      if (!res.ok) throw new Error();
      await fetchThread();
      onQuestionUpdated?.();
      notify.success("Answer posted!");
    } catch {
      notify.error("Could not post answer.");
    }
  };

  const handleDeleteAnswer = async (answerId: string) => {
    if (!window.confirm("Delete this answer?")) return;
    try {
      const res = await authFetch(`/api/qa/answers/${answerId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await fetchThread();
      onQuestionUpdated?.();
      notify.success("Answer deleted.");
    } catch {
      notify.error("Could not delete answer.");
    }
  };

  const handleDeleteQuestion = async () => {
    if (!window.confirm("Delete this question and all its answers? This cannot be undone.")) return;
    try {
      const res = await authFetch(`/api/qa/questions/${questionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onQuestionUpdated?.();
      onClose();
      notify.success("Question deleted.");
    } catch {
      notify.error("Could not delete question.");
    }
  };

  // Keyboard close
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && previewImageIndex === null) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, previewImageIndex]);

  if (open === false) return null;

  const isAuthor = Boolean(currentUid && data?.author_uid === currentUid);
  const canDeleteQuestion = isAuthor || canModerate;
  const isResolved = data?.status === "resolved";

  const sortedAnswers = [...(data?.answers || [])].sort((a, b) => {
    // 1. Accepted always on top
    if (a.is_accepted && !b.is_accepted) return -1;
    if (!a.is_accepted && b.is_accepted) return 1;
    if (answerSort === "top") {
      return (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in duration-150">
      {/* 1. Top Navigation Bar */}
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-border/70">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-muted hover:text-foreground bg-surface/60 hover:bg-surface border border-border/70 hover:border-border transition-all active:scale-95 shrink-0 shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Doubt Board</span>
          </button>

          {data && (
            <div className="hidden sm:flex items-center gap-2 min-w-0">
              <span className="text-muted/30 select-none">/</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary px-3 py-1 rounded-full bg-primary/10 border border-primary/20 truncate">
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{data.subject_name}</span>
              </span>
              {data.topic_unit && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted px-2.5 py-1 rounded-full bg-surface border border-border/70 truncate">
                  <Hash className="w-3 h-3 text-muted" />
                  <span className="truncate">{data.topic_unit}</span>
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSaveToggle}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95 ${
              data?.is_saved
                ? "bg-foreground text-background border-foreground shadow-xs"
                : "bg-surface/60 hover:bg-surface border-border/70 text-muted hover:text-foreground"
            }`}
            title={data?.is_saved ? "Saved" : "Save question"}
          >
            {data?.is_saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            <span className="hidden sm:inline">{data?.is_saved ? "Saved" : "Save"}</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-surface/60 hover:bg-surface border border-border/70 text-muted hover:text-foreground transition-all active:scale-95"
            title="Share question"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{copiedLink ? "Copied Link" : "Share"}</span>
          </button>

          {canDeleteQuestion && (
            <button
              type="button"
              onClick={handleDeleteQuestion}
              className="p-2 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive transition-all active:scale-95"
              title={canModerate && !isAuthor ? "Delete as admin" : "Delete question"}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content Viewport */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-28 gap-3 bg-card rounded-2xl border border-border/80">
          <Loader2 className="w-8 h-8 animate-spin text-muted" />
          <p className="text-xs text-muted font-medium">Loading discussion thread…</p>
        </div>
      ) : !data ? (
        <div className="py-24 text-center bg-card rounded-2xl border border-border/80 space-y-4">
          <p className="text-sm font-semibold text-muted">Question not found or deleted.</p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-primary-foreground"
          >
            Back to Doubt Board
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 2. Main Question Post Card (Reddit Style) */}
          <article className="bg-card rounded-2xl border border-border/80 p-6 sm:p-8 shadow-xs space-y-6">
            {/* Header: Author + Scope + Status Badge */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary/80 to-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0 shadow-xs ring-2 ring-border/50">
                  {data.author_name?.[0]?.toUpperCase() || "S"}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base text-foreground">{data.author_name}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface border border-border/70 text-muted">
                      {data.branch} · Sem {data.semester}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted mt-0.5 font-medium">
                    <Clock className="w-3.5 h-3.5 text-muted/80" />
                    <span>{timeAgo(data.created_at)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isResolved ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Resolved
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Open Doubt
                  </span>
                )}
              </div>
            </div>

            {/* Context Capsules Row: Subject, Category, Topic, Reference Notes/PPT */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/25 shadow-2xs">
                <BookOpen className="w-3.5 h-3.5" />
                <span>{data.subject_name}</span>
              </span>

              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider border shadow-2xs ${
                  CATEGORY_STYLES[data.category] || CATEGORY_STYLES.general
                }`}
              >
                {CATEGORY_LABEL[data.category] || data.category}
              </span>

              {data.topic_unit && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-surface/80 text-foreground/80 border border-border/80 shadow-2xs">
                  <Hash className="w-3 h-3 text-muted" />
                  <span>{data.topic_unit}</span>
                </span>
              )}

              {data.resource_title && (
                data.resource_url ? (
                  <a
                    href={data.resource_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-primary bg-primary/10 hover:bg-primary/15 border border-primary/25 hover:border-primary/40 transition-all group shadow-2xs"
                    title="Open referenced notes/PPT in new tab"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span className="font-semibold max-w-[280px] truncate">Ref: {data.resource_title}</span>
                    <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-muted-foreground bg-surface/80 border border-border/80 shadow-2xs">
                    <FileText className="w-3.5 h-3.5 text-primary/80" />
                    <span className="max-w-[280px] truncate">Ref: {data.resource_title}</span>
                  </span>
                )
              )}
            </div>

            {/* Question Body */}
            <div className="text-xl sm:text-2xl font-bold text-foreground leading-relaxed whitespace-pre-wrap select-text tracking-tight">
              {data.body}
            </div>

            {/* Attachments Gallery */}
            {data.attachments && data.attachments.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-bold text-foreground mb-3">
                  Attachments ({data.attachments.length})
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {data.attachments.map((url, i) => (
                    <div
                      key={i}
                      onClick={() => setPreviewImageIndex(i)}
                      className="relative group rounded-xl overflow-hidden border border-border/80 bg-surface/50 cursor-pointer shadow-xs aspect-4/3 flex items-center justify-center hover:border-primary/40 transition-all"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`Question attachment ${i + 1}`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold backdrop-blur-xs">
                        <Eye className="w-4 h-4" />
                        <span>Expand View</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reddit-Style Bottom Action Bar */}
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-border/60">
              <div className="flex items-center gap-3">
                <VoteButton
                  upvotes={data.upvotes}
                  userVote={data.user_vote}
                  onVote={handleQuestionVote}
                />

                {isAuthor && (
                  <button
                    type="button"
                    onClick={handleResolveToggle}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                      isResolved
                        ? "bg-surface hover:bg-surface-hover text-muted border border-border"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs"
                    }`}
                  >
                    {isResolved ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reopen Doubt
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark as Resolved
                      </>
                    )}
                  </button>
                )}
              </div>

              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface/80 border border-border/60">
                <MessageSquare className="w-3.5 h-3.5 text-muted" />
                <span>
                  {data.answer_count} {data.answer_count === 1 ? "answer" : "answers"}
                </span>
              </span>
            </div>
          </article>

          {/* 3. Contribute an Answer (Reddit Comment Box) */}
          <div className="bg-card rounded-2xl border border-border/80 p-6 sm:p-8 shadow-xs space-y-3">
            <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span>Contribute an Answer or Solution</span>
            </h3>
            <AnswerComposer
              onSubmit={handleSubmitAnswer}
              placeholder="Explain the solution step-by-step or attach photos of your handwritten solving steps…"
            />
          </div>

          {/* 4. Comments & Solutions Section (Reddit Comments Stream) */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>Solutions & Discussion</span>
                <span className="px-2 py-0.5 rounded-md bg-surface text-foreground font-mono text-xs">
                  {data.answers.length}
                </span>
              </h3>

              {data.answers.length > 1 && (
                <div className="flex items-center gap-1 bg-surface/50 border border-border/60 p-0.5 rounded-xl text-xs">
                  <button
                    type="button"
                    onClick={() => setAnswerSort("top")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      answerSort === "top"
                        ? "bg-card text-foreground shadow-xs font-bold"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    Top Voted
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnswerSort("newest")}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                      answerSort === "newest"
                        ? "bg-card text-foreground shadow-xs font-bold"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    Newest
                  </button>
                </div>
              )}
            </div>

            {sortedAnswers.length === 0 ? (
              <div className="p-10 text-center rounded-2xl border border-dashed border-border/80 bg-card/40">
                <MessageSquare className="w-8 h-8 text-muted/40 mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground mb-1">
                  No answers yet
                </p>
                <p className="text-xs text-muted">
                  Be the first to help your peer solve this doubt!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedAnswers.map((answer) => (
                  <AnswerCard
                    key={answer.id}
                    answer={answer}
                    userVote={answerVotes[answer.id]}
                    isQuestionAuthor={isAuthor}
                    isOwnAnswer={Boolean(currentUid && answer.author_uid === currentUid)}
                    canModerate={canModerate}
                    onVote={(val) => handleAnswerVote(answer.id, val)}
                    onAccept={() => handleAccept(answer.id)}
                    onDelete={() => handleDeleteAnswer(answer.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lightbox for question attachments */}
      <QAImageViewer
        open={previewImageIndex !== null}
        images={data?.attachments || []}
        initialIndex={previewImageIndex ?? 0}
        onClose={() => setPreviewImageIndex(null)}
      />
    </div>
  );
}
