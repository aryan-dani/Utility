"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Loader2,
  MessageCircle,
  Bookmark,
  HelpCircle,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { authFetch } from "@/lib/authFetch";
import { notify } from "@/lib/toast";
import { useAcademicStore } from "@/store/academicStore";
import {
  Button,
  PageHeader,
  Segmented,
  EmptyState,
} from "@/components/ui";
import type {
  QAQuestion,
  QuestionCategory,
  QuestionStatus,
  VoteValue,
} from "@/lib/qa/types";
import { rankQuestions } from "@/lib/qa/types";
import QuestionCard from "./QuestionCard";
import QuestionComposer from "./QuestionComposer";
import QuestionThread from "./QuestionThread";
import QASearchBar from "./QASearchBar";
import SavedQuestionsView from "./SavedQuestionsView";

type BoardTab = "board" | "saved";

export default function QABoardView() {
  const academicYear = useAcademicStore((s) => s.academicYear);
  const branch = useAcademicStore((s) => s.branch);
  const semester = useAcademicStore((s) => s.semester);

  const [questions, setQuestions] = useState<QAQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [tab, setTab] = useState<BoardTab>("board");
  const [currentUid, setCurrentUid] = useState<string | null>(null);

  // Board filters
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<QuestionCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<QuestionStatus | "all">("all");

  // Track user votes and saves
  const [userVotes, setUserVotes] = useState<Record<string, VoteValue | null>>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUid(user?.uid ?? null);
    });
    return () => unsub();
  }, []);

  const fetchQuestions = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams({
        academic_year: academicYear,
        branch,
        semester: String(semester),
        limit: "100",
      });

      const res = await authFetch(`/api/qa/questions?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setQuestions(json.questions || []);
    } catch {
      notify.error("Could not load questions.");
    } finally {
      setLoading(false);
    }
  }, [academicYear, branch, semester]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      academic_year: academicYear,
      branch,
      semester: String(semester),
      limit: "100",
    });

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
  }, [academicYear, branch, semester]);

  // Derive subject list from loaded questions
  const subjects = useMemo(() => {
    const set = new Set(questions.map((q) => q.subject_name));
    return Array.from(set).sort();
  }, [questions]);

  const composerSubject =
    subjectFilter !== "all" ? subjectFilter : subjects[0] || "General";

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

  const handleCreateQuestion = async (data: {
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
        subject_name: composerSubject,
        ...data,
      }),
    });
    if (!res.ok) {
      notify.error("Could not post question.");
      return;
    }
    notify.success("Question posted!");
    fetchQuestions();
  };

  const filtered = useMemo(() => {
    let result = questions;
    if (subjectFilter !== "all") {
      result = result.filter((q) => q.subject_name === subjectFilter);
    }
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
          item.subject_name.toLowerCase().includes(q) ||
          item.topic_unit?.toLowerCase().includes(q) ||
          item.author_name.toLowerCase().includes(q),
      );
    }
    return rankQuestions(result);
  }, [questions, subjectFilter, categoryFilter, statusFilter, searchQuery]);

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto page-gutter py-8 min-h-[80vh]">
      {/* Header */}
      <PageHeader
        className="border-b border-border pb-6 mb-6"
        eyebrow={`${branch} · Sem ${semester} · ${academicYear}`}
        title="Doubt Board"
        description="Ask questions about paper-format problems, syllabus scope, or share handwritten solutions. Not for generic doubts — use the AI assistant for those."
        actions={
          <Button
            variant="primary"
            size="md"
            className="shrink-0 rounded-xl"
            onClick={() => {
              if (!currentUid) {
                notify.error("Sign in to ask a question.");
                return;
              }
              setComposerOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            Ask Question
          </Button>
        }
      />

      {/* Tab switcher */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <Segmented
          value={tab}
          onChange={setTab}
          size="sm"
          aria-label="Board view"
          options={[
            {
              value: "board",
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  Questions
                </span>
              ),
            },
            {
              value: "saved",
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5" />
                  Saved
                </span>
              ),
            },
          ]}
        />

        {tab === "board" && subjects.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted">Subject:</span>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">All subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Board tab */}
      {tab === "board" && (
        <>
          <div className="mb-4">
            <QASearchBar
              query={searchQuery}
              onQueryChange={setSearchQuery}
              category={categoryFilter}
              onCategoryChange={setCategoryFilter}
              status={statusFilter}
              onStatusChange={setStatusFilter}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<MessageCircle className="w-10 h-10" />}
              title="No questions yet"
              description={
                searchQuery
                  ? `No results for "${searchQuery}"`
                  : "Be the first to ask a question on this board!"
              }
            />
          ) : (
            <div className="border border-border rounded-xl overflow-hidden shadow-sm">
              {filtered.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  userVote={userVotes[q.id] ?? null}
                  isSaved={savedIds.has(q.id)}
                  onVote={(v) => handleVote(q.id, v)}
                  onSave={() => handleSave(q.id)}
                  onClick={() => setActiveThreadId(q.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Saved tab */}
      {tab === "saved" && <SavedQuestionsView />}

      {/* Composer */}
      <QuestionComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSubmit={handleCreateQuestion}
        subjectName={composerSubject}
      />

      {/* Thread */}
      {activeThreadId && (
        <QuestionThread
          questionId={activeThreadId}
          open={!!activeThreadId}
          onClose={() => setActiveThreadId(null)}
          onQuestionUpdated={fetchQuestions}
        />
      )}
    </div>
  );
}
