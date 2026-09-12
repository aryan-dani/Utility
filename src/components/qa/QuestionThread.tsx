"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  RotateCcw,
  User,
  Clock,
  Bookmark,
  BookmarkCheck,
  Trash2,
  Loader2,
} from "lucide-react";
import { Badge, Modal } from "@/components/ui";
import { authFetch } from "@/lib/authFetch";
import { notify } from "@/lib/toast";
import { auth } from "@/lib/firebase";
import type {
  QAQuestionWithAnswers,
  VoteValue,
} from "@/lib/qa/types";
import VoteButton from "./VoteButton";
import AnswerCard from "./AnswerCard";
import AnswerComposer from "./AnswerComposer";

interface QuestionThreadProps {
  questionId: string;
  open: boolean;
  onClose: () => void;
  onQuestionUpdated?: () => void;
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
  const currentUid = auth.currentUser?.uid;

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
      notify.success("Answer accepted!");
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
    } catch {
      notify.error("Could not toggle bookmark.");
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

  const isAuthor = currentUid && data?.author_uid === currentUid;
  const isResolved = data?.status === "resolved";

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to questions
        </button>
      }
      className="max-h-[85vh] overflow-y-auto"
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted" />
        </div>
      ) : !data ? (
        <p className="text-sm text-muted text-center py-8">Question not found.</p>
      ) : (
        <div className="-mt-2">
          {/* Question header */}
          <div className="flex items-start gap-3 mb-4">
            <VoteButton
              upvotes={data.upvotes}
              userVote={data.user_vote}
              onVote={handleQuestionVote}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center flex-wrap gap-2 mb-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${CATEGORY_STYLES[data.category] || ""}`}
                >
                  {CATEGORY_LABEL[data.category] || data.category}
                </span>
                {data.topic_unit && (
                  <Badge className="text-3xs font-mono">{data.topic_unit}</Badge>
                )}
                {isResolved && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    Resolved
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Question body */}
          <div className="mb-4">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {data.body}
            </p>
            {data.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {data.attachments.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Attachment ${i + 1}`}
                      className="max-w-[240px] max-h-[200px] rounded-lg border border-border object-cover hover:opacity-80 transition-opacity"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Question meta + actions */}
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-border">
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <User className="w-3 h-3" />
                {data.author_name}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {timeAgo(data.created_at)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveToggle}
                className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface transition-colors"
                title={data.is_saved ? "Unsave" : "Save"}
              >
                {data.is_saved ? (
                  <BookmarkCheck className="w-4 h-4 text-primary fill-primary/20" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
              </button>
              {isAuthor && (
                <>
                  <button
                    type="button"
                    onClick={handleResolveToggle}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      isResolved
                        ? "text-amber-600 hover:bg-amber-500/10"
                        : "text-emerald-600 hover:bg-emerald-500/10"
                    }`}
                  >
                    {isResolved ? (
                      <><RotateCcw className="w-3.5 h-3.5" /> Reopen</>
                    ) : (
                      <><CheckCircle2 className="w-3.5 h-3.5" /> Resolve</>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteQuestion}
                    className="p-1.5 rounded-lg text-muted hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete question"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Answers section */}
          <div className="mt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
              {data.answers.length} {data.answers.length === 1 ? "Answer" : "Answers"}
            </h3>

            {data.answers.length === 0 ? (
              <p className="text-sm text-muted text-center py-6 border border-dashed border-border rounded-xl">
                No answers yet. Be the first to help!
              </p>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden">
                {data.answers.map((answer) => (
                  <AnswerCard
                    key={answer.id}
                    answer={answer}
                    userVote={answerVotes[answer.id] ?? null}
                    isQuestionAuthor={!!isAuthor}
                    isOwnAnswer={currentUid === answer.author_uid}
                    onVote={(v) => handleAnswerVote(answer.id, v)}
                    onAccept={() => handleAccept(answer.id)}
                    onDelete={() => handleDeleteAnswer(answer.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Answer composer */}
          <div className="mt-4 border border-border rounded-xl overflow-hidden">
            <AnswerComposer onSubmit={handleSubmitAnswer} />
          </div>
        </div>
      )}
    </Modal>
  );
}
