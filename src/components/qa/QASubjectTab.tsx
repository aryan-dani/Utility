"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Loader2, MessageCircle } from "lucide-react";
import { auth } from "@/lib/firebase";
import { authFetch } from "@/lib/authFetch";
import { notify } from "@/lib/toast";
import { useAcademicStore } from "@/store/academicStore";
import { Button, EmptyState } from "@/components/ui";
import type {
  QAQuestion,
  QuestionCategory,
  QuestionStatus,
  VoteValue,
} from "@/lib/qa/types";
import { rankQuestions } from "@/lib/qa/types";
import { useAdminStatus } from "@/lib/adminStatus";
import QuestionCard from "./QuestionCard";
import QuestionComposer from "./QuestionComposer";
import QuestionThread from "./QuestionThread";
import QASearchBar from "./QASearchBar";

interface QASubjectTabProps {
  subjectName: string;
  resourceId?: string;
}

export default function QASubjectTab({ subjectName, resourceId }: QASubjectTabProps) {
  const academicYear = useAcademicStore((s) => s.academicYear);
  const branch = useAcademicStore((s) => s.branch);
  const semester = useAcademicStore((s) => s.semester);

  const [questions, setQuestions] = useState<QAQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<QuestionCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<QuestionStatus | "all">("all");

  // Track user votes and saves for optimistic UI
  const [userVotes, setUserVotes] = useState<Record<string, VoteValue | null>>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const { isAdmin } = useAdminStatus();
  const currentUid = auth.currentUser?.uid ?? null;

  const fetchQuestions = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams({
        academic_year: academicYear,
        branch,
        semester: String(semester),
        subject_name: subjectName,
      });
      if (resourceId) params.set("resource_id", resourceId);

      const res = await authFetch(`/api/qa/questions?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setQuestions(json.questions || []);
    } catch {
      notify.error("Could not load questions.");
    } finally {
      setLoading(false);
    }
  }, [academicYear, branch, semester, subjectName, resourceId]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      academic_year: academicYear,
      branch,
      semester: String(semester),
      subject_name: subjectName,
    });
    if (resourceId) params.set("resource_id", resourceId);

    authFetch(`/api/qa/questions?${params}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json) => {
        if (active) {
          setQuestions(json.questions || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          notify.error("Could not load questions.");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [academicYear, branch, semester, subjectName, resourceId]);

  const handleCreateQuestion = async (data: {
    subject_name: string;
    resource_id?: string;
    resource_title?: string;
    resource_url?: string;
    category: QuestionCategory;
    topic_unit: string;
    body: string;
    attachments: string[];
  }) => {
    const res = await authFetch("/api/qa/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        academic_year: academicYear,
        branch,
        semester,
        ...data,
        subject_name: data.subject_name || subjectName,
        resource_id: data.resource_id || resourceId,
      }),
    });
    if (!res.ok) {
      notify.error("Could not post question.");
      return;
    }
    notify.success("Question posted!");
    fetchQuestions(true);
  };

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
      notify.error("Vote failed.");
    }
  };

  const handleSave = async (questionId: string) => {
    const wasSaved = savedIds.has(questionId);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
    try {
      await authFetch("/api/qa/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_id: questionId }),
      });
    } catch {
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) {
          next.add(questionId);
        } else {
          next.delete(questionId);
        }
        return next;
      });
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

  const filtered = useMemo(() => {
    let result = questions;
    if (categoryFilter !== "all") {
      result = result.filter((q) => q.category === categoryFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter((q) => q.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.body.toLowerCase().includes(q) ||
          item.topic_unit?.toLowerCase().includes(q) ||
          item.author_name.toLowerCase().includes(q),
      );
    }
    return rankQuestions(result);
  }, [questions, categoryFilter, statusFilter, searchQuery]);

  if (activeThreadId) {
    return (
      <div className="py-2">
        <QuestionThread
          questionId={activeThreadId}
          open={true}
          onClose={() => setActiveThreadId(null)}
          onQuestionUpdated={fetchQuestions}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">
            Doubt Board · {subjectName}
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Ask questions about paper-format problems, syllabus scope, or share solutions
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            if (!auth.currentUser) {
              notify.error("Sign in to ask a question.");
              return;
            }
            setComposerOpen(true);
          }}
          className="rounded-xl shrink-0"
        >
          <Plus className="w-4 h-4" />
          Ask Question
        </Button>
      </div>

      {/* Search & filters */}
      <QASearchBar
        query={searchQuery}
        onQueryChange={setSearchQuery}
        category={categoryFilter}
        onCategoryChange={setCategoryFilter}
        status={statusFilter}
        onStatusChange={setStatusFilter}
      />

      {/* Question list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="w-10 h-10" />}
          title="No questions yet"
          description={
            searchQuery
              ? `No results for "${searchQuery}"`
              : "Be the first to ask a question about this subject!"
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              userVote={userVotes[q.id] ?? null}
              isSaved={savedIds.has(q.id)}
              canDelete={Boolean(
                isAdmin || (currentUid && q.author_uid === currentUid),
              )}
              onVote={(v) => handleVote(q.id, v)}
              onSave={() => handleSave(q.id)}
              onDelete={() => void handleDeleteQuestion(q.id)}
              onClick={() => setActiveThreadId(q.id)}
            />
          ))}
        </div>
      )}

      {/* Composer modal */}
      <QuestionComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSubmit={handleCreateQuestion}
        subjectName={subjectName}
      />

    </div>
  );
}
