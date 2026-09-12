"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus,
  Loader2,
  MessageCircle,
  Bookmark,
  HelpCircle,
  BookOpen,
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
  Select,
  Modal,
  Input,
} from "@/components/ui";
import type {
  QAQuestion,
  QuestionCategory,
  QuestionStatus,
  VoteValue,
} from "@/lib/qa/types";
import { rankQuestions } from "@/lib/qa/types";
import { useWorkspaceResources } from "@/lib/useWorkspaceResources";
import { useAdminStatus } from "@/lib/adminStatus";
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

  const { subjects: catalogSubjects, resources } = useWorkspaceResources();

  const [questions, setQuestions] = useState<QAQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("thread");
  });
  const [tab, setTab] = useState<BoardTab>("board");
  const [currentUid, setCurrentUid] = useState<string | null>(null);

  // Board filters
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<QuestionCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<QuestionStatus | "all">("all");
  const [customSubjects, setCustomSubjects] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("qa-custom-subjects");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [customSubjectModalOpen, setCustomSubjectModalOpen] = useState(false);
  const [newSubjectInput, setNewSubjectInput] = useState("");

  // Track user votes and saves
  const [userVotes, setUserVotes] = useState<Record<string, VoteValue | null>>({});
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const { isAdmin } = useAdminStatus();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUid(user?.uid ?? null);
    });
    return () => unsub();
  }, []);

  // Keep thread view in sync with browser back/forward.
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setActiveThreadId(params.get("thread"));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleOpenThread = useCallback((questionId: string) => {
    setActiveThreadId(questionId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("thread", questionId);
      window.history.pushState({ thread: questionId }, "", url.toString());
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const handleCloseThread = useCallback(() => {
    setActiveThreadId(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("thread");
      window.history.pushState({}, "", url.toString());
    }
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

  // Combine subjects from catalog, custom added subjects, and existing questions
  const subjects = useMemo(() => {
    const set = new Set<string>();
    catalogSubjects.forEach((s) => {
      if (s) set.add(s);
    });
    questions.forEach((q) => {
      if (q.subject_name) set.add(q.subject_name);
    });
    customSubjects.forEach((s) => {
      if (s) set.add(s);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [catalogSubjects, questions, customSubjects]);

  const handleAddCustomSubject = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCustomSubjects((prev) => {
      if (prev.includes(trimmed)) return prev;
      const next = [...prev, trimmed];
      try {
        localStorage.setItem("qa-custom-subjects", JSON.stringify(next));
      } catch {}
      return next;
    });
    setSubjectFilter(trimmed);
    notify.success(`Subject "${trimmed}" selected`);
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

  if (activeThreadId) {
    return (
      <div className="flex-1 w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl mx-auto page-gutter pt-6 pb-24 min-h-[85vh]">
        <QuestionThread
          questionId={activeThreadId}
          open={true}
          onClose={handleCloseThread}
          onQuestionUpdated={fetchQuestions}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto page-gutter pt-6 pb-24 min-h-[85vh]">
      {/* Header */}
      <PageHeader
        className="border-b border-border pb-6 mb-6"
        eyebrow={`${branch} · Sem ${semester} · ${academicYear}`}
        title="Doubt Board"
        description="Ask questions about paper-format problems, syllabus scope, or share handwritten solutions. For generic doubts, use the AI assistant."
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

        {tab === "board" && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted shrink-0">Subject:</span>
            <Select<string>
              value={subjectFilter}
              onChange={setSubjectFilter}
              options={[
                { value: "all", label: "All subjects" },
                ...subjects.map((s) => ({ value: s, label: s })),
              ]}
              size="sm"
              align="right"
              className="min-w-[150px] max-w-[220px]"
              onCreateOption={handleAddCustomSubject}
              createOptionLabel={(q) => `+ Add & filter by "${q}"`}
              footerAction={{
                label: "Add custom subject…",
                icon: Plus,
                onClick: () => {
                  setNewSubjectInput("");
                  setCustomSubjectModalOpen(true);
                },
              }}
            />
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
                  onClick={() => handleOpenThread(q.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Saved tab */}
      {tab === "saved" && <SavedQuestionsView onOpenThread={handleOpenThread} />}

      {/* Composer */}
      <QuestionComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onSubmit={handleCreateQuestion}
        initialSubject={subjectFilter !== "all" ? subjectFilter : undefined}
        availableSubjects={subjects}
        availableResources={resources}
      />

      {/* Custom Subject Modal */}
      <Modal
        open={customSubjectModalOpen}
        onClose={() => {
          setCustomSubjectModalOpen(false);
          setNewSubjectInput("");
        }}
        size="sm"
        title={
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <span>Add Custom Subject</span>
          </div>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newSubjectInput.trim()) return;
            handleAddCustomSubject(newSubjectInput.trim());
            setNewSubjectInput("");
            setCustomSubjectModalOpen(false);
          }}
          className="space-y-4"
        >
          <p className="text-xs text-muted leading-relaxed">
            Add an elective, lab course, or custom topic to filter doubts and ask questions.
          </p>
          <Input
            value={newSubjectInput}
            onChange={(e) => setNewSubjectInput(e.target.value.slice(0, 100))}
            placeholder="e.g. Cloud Computing or Robotics"
            autoFocus
            className="rounded-xl text-sm"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => {
                setCustomSubjectModalOpen(false);
                setNewSubjectInput("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={!newSubjectInput.trim()}
            >
              Add Subject
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
