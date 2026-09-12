"use client";

import { useState, useEffect } from "react";
import { Loader2, Bookmark } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { notify } from "@/lib/toast";
import { auth } from "@/lib/firebase";
import { EmptyState } from "@/components/ui";
import { useAdminStatus } from "@/lib/adminStatus";
import type { QAQuestion, VoteValue } from "@/lib/qa/types";
import QuestionCard from "./QuestionCard";
import QuestionThread from "./QuestionThread";

interface SavedQuestionsViewProps {
  onOpenThread?: (questionId: string) => void;
}

export default function SavedQuestionsView({ onOpenThread }: SavedQuestionsViewProps = {}) {
  const [questions, setQuestions] = useState<QAQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState<Record<string, VoteValue | null>>({});
  const { isAdmin } = useAdminStatus();
  const currentUid = auth.currentUser?.uid ?? null;

  const fetchSaved = async (showLoading = false) => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }
    if (showLoading) setLoading(true);
    try {
      const res = await authFetch("/api/qa/saved");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setQuestions(json.questions || []);
    } catch {
      notify.error("Could not load saved questions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (!auth.currentUser) {
      Promise.resolve().then(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
      };
    }

    authFetch("/api/qa/saved")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json) => {
        if (active) {
          setQuestions(json.questions || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          notify.error("Could not load saved questions.");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleVote = async (questionId: string, value: VoteValue) => {
    const old = userVotes[questionId] ?? null;
    const isToggle = old === value;
    setUserVotes((prev) => ({ ...prev, [questionId]: isToggle ? null : value }));
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, upvotes: q.upvotes + (isToggle ? -1 : old ? 0 : 1) }
          : q,
      ),
    );
    try {
      await authFetch("/api/qa/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: "question", target_id: questionId, value }),
      });
    } catch {
      setUserVotes((prev) => ({ ...prev, [questionId]: old }));
    }
  };

  const handleUnsave = async (questionId: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    try {
      await authFetch("/api/qa/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: questionId }),
      });
    } catch {
      fetchSaved(); // Revert by refetching
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (
      !window.confirm(
        "Delete this question and all its answers? This cannot be undone.",
      )
    ) {
      return;
    }
    try {
      const res = await authFetch(`/api/qa/questions/${questionId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
      if (activeThreadId === questionId) setActiveThreadId(null);
      notify.success("Question deleted.");
    } catch {
      notify.error("Could not delete question.");
    }
  };

  if (!auth.currentUser) {
    return (
      <EmptyState
        icon={<Bookmark className="w-10 h-10" />}
        title="Sign in to see saved questions"
        description="Your bookmarked question threads will appear here."
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <EmptyState
        icon={<Bookmark className="w-10 h-10" />}
        title="No saved questions"
        description="Bookmark questions you want to come back to. They will show up here."
      />
    );
  }

  if (activeThreadId && !onOpenThread) {
    return (
      <QuestionThread
        questionId={activeThreadId}
        open={true}
        onClose={() => setActiveThreadId(null)}
        onQuestionUpdated={fetchSaved}
      />
    );
  }

  return (
    <div className="space-y-4">
      {questions.map((q) => (
        <QuestionCard
          key={q.id}
          question={q}
          userVote={userVotes[q.id] ?? null}
          isSaved={true}
          canDelete={Boolean(
            isAdmin || (currentUid && q.author_uid === currentUid),
          )}
          onVote={(v) => handleVote(q.id, v)}
          onSave={() => handleUnsave(q.id)}
          onDelete={() => void handleDeleteQuestion(q.id)}
          onClick={() => (onOpenThread ? onOpenThread(q.id) : setActiveThreadId(q.id))}
        />
      ))}
    </div>
  );
}
