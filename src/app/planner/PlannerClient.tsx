'use client';

import { useEffect, useState, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, Check, Trash2, Download, Upload, Cloud, CloudOff, LogIn, ChevronLeft, ChevronRight,
  Share2, Copy, Users, Link2, Globe, Lock, UserPlus, CheckCircle2, Circle,
  CalendarDays, MoreHorizontal, Minus, List, Columns, Calendar, RefreshCw, Undo2
} from 'lucide-react';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { logActivity } from '@/lib/activity';
import { parsePrompt, mergeEntries } from '@/lib/promptParser';
import { plannerStorageKey } from '@/lib/plannerStorage';
import { notify } from '@/lib/toast';
import { Button, Modal, PageHeader, Card, Segmented } from '@/components/ui';
import AppLink from '@/components/ui/AppLink';
import { authFetch } from '@/lib/authFetch';
import { getSoonestUpcomingExam } from '@/lib/examCountdown';
import { useIsClient } from '@/lib/clientHooks';
import { toggleTaskRecurring as applyRecurringToggle } from '@/lib/planner/recurrence';
import { normalizeImportedPlan } from '@/lib/planner/importPlan';
import { generateId } from '@/lib/id';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SubTask = {
  id: string;
  text: string;
  done: boolean;
};

export type Task = {
  id: string;
  text: string;
  done: boolean;
  subtasks: SubTask[];
  category?: 'Revision' | 'Exam Prep' | 'Assignment' | 'Project' | 'General';
  status?: 'todo' | 'in-progress' | 'done';
  isRecurring?: boolean;
  recurringDays?: number[];
};

type PlanData = Record<string, Task[]>; // "2026-05-27" -> Task[]

type PlanMeta = {
  id?: string;
  title: string;
  month: number;
  year: number;
  is_public: boolean;
  updated_at?: string;
};

type TaskCategory = NonNullable<Task['category']>;
type TaskStatus = NonNullable<Task['status']>;

type Collaborator = {
  id: string;
  user_email: string;
  role: 'editor' | 'viewer';
};

const CATEGORY_COLORS: Record<string, { bg: string, text: string, border: string }> = {
  'Exam Prep': { bg: 'bg-foreground/10 dark:bg-foreground/15', text: 'text-foreground font-bold', border: 'border-foreground/30' },
  'Assignment': { bg: 'bg-surface-hover/80 dark:bg-surface-hover/60', text: 'text-muted-hover', border: 'border-border-strong/50' },
  'Project': { bg: 'bg-foreground text-background dark:bg-foreground dark:text-background', text: 'text-background dark:text-background font-semibold', border: 'border-transparent' },
  'Revision': { bg: 'bg-surface', text: 'text-foreground', border: 'border-border-strong' },
  'General': { bg: 'bg-surface', text: 'text-muted', border: 'border-border' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getCalendarDays(month: number, year: number) {
  // month is 1-indexed
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();

  // Monday = 0, Sunday = 6
  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const days: { date: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  // Previous month fill
  const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    days.push({
      date: `${py}-${String(pm).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayNum: d,
      isCurrentMonth: false,
    });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({
      date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayNum: d,
      isCurrentMonth: true,
    });
  }

  // Next month fill to complete 6 rows
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    const nm = month === 12 ? 1 : month + 1;
    const ny = month === 12 ? year + 1 : year;
    days.push({
      date: `${ny}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      dayNum: d,
      isCurrentMonth: false,
    });
  }

  return days;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function storageKey(month: number, year: number) {
  return plannerStorageKey(year, month);
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TaskItem({
  task,
  onToggle,
  onDelete,
  onUpdate,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
  onUpdateCategory,
  onToggleRecurring,
  onUpdateStatus,
  compact = false,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: (text: string) => void;
  onToggleSubtask: (subtaskId: string) => void;
  onAddSubtask: () => void;
  onDeleteSubtask: (subtaskId: string) => void;
  onUpdateCategory?: (category: TaskCategory) => void;
  onToggleRecurring?: () => void;
  onUpdateStatus?: (status: TaskStatus) => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex items-center gap-1 group/task">
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={`flex-shrink-0 w-3 h-3 rounded-xs border flex items-center justify-center transition-all ${
            task.done
              ? 'bg-foreground border-foreground text-background'
              : 'border-border-strong hover:border-foreground'
          }`}
        >
          {task.done && <Check className="w-1.5 h-1.5" />}
        </button>
        <span className={`text-[10px] leading-tight truncate flex-1 ${task.done ? 'line-through text-muted' : 'text-foreground'}`}>
          {task.text}
        </span>
        {task.category && task.category !== 'General' && (
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            task.category === 'Exam Prep' ? 'bg-foreground' :
            task.category === 'Assignment' ? 'bg-muted' :
            task.category === 'Project' ? 'bg-foreground-subtle' :
            task.category === 'Revision' ? 'bg-border-strong' :
            'bg-border'
          }`} />
        )}
      </div>
    );
  }

  const subtasksDone = task.subtasks.filter(s => s.done).length;
  const currentCategory = task.category || 'General';
  const catColor = CATEGORY_COLORS[currentCategory];

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.12 }}
      className={`group/task bg-background border rounded-xl p-3 transition-all ${
        task.done ? 'border-border opacity-60' : 'border-border shadow-card'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <button
          onClick={onToggle}
          className={`flex-shrink-0 tap-target mt-0.5 rounded-md border-[1.5px] transition-all ${
            task.done
              ? 'bg-foreground border-foreground text-background'
              : 'bg-card border-border-strong hover:border-foreground active:bg-surface'
          }`}
        >
          {task.done && <Check className="w-2.5 h-2.5" />}
        </button>

        <textarea
          value={task.text}
          onChange={(e) => onUpdate(e.target.value)}
          placeholder="Task…"
          rows={1}
          className={`bg-transparent outline-none resize-none overflow-hidden text-sm w-full leading-snug ${
            task.done ? 'line-through text-muted' : 'text-foreground'
          }`}
          onInput={(e) => {
            const t = e.target as HTMLTextAreaElement;
            t.style.height = 'auto';
            t.style.height = t.scrollHeight + 'px';
          }}
        />

        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="opacity-100 md:opacity-0 md:group-hover/task:opacity-100 flex-shrink-0 hover:text-destructive mt-0.5 tap-target md:min-h-0 md:min-w-0 p-0 min-h-0"
          aria-label="Delete task"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Task properties (Category, Status, Recurring) */}
      <div className="flex flex-wrap items-center gap-2 mt-2 ml-7">
        {/* Category Badges dropdown */}
        <select
          value={currentCategory}
          onChange={(e) => onUpdateCategory?.(e.target.value as TaskCategory)}
          className={`text-xs font-bold px-2 py-1.5 min-h-11 md:min-h-0 rounded-md border outline-none cursor-pointer ${catColor.bg} ${catColor.text} ${catColor.border}`}
        >
          <option value="General">General</option>
          <option value="Revision">Revision</option>
          <option value="Exam Prep">Exam Prep</option>
          <option value="Assignment">Assignment</option>
          <option value="Project">Project</option>
        </select>

        {/* Status Dropdown */}
        <select
          value={task.status || (task.done ? 'done' : 'todo')}
          onChange={(e) => onUpdateStatus?.(e.target.value as TaskStatus)}
          className="ui-select ui-select-sm"
        >
          <option value="todo">To Do</option>
          <option value="in-progress">In Progress</option>
          <option value="done">Done</option>
        </select>

        {/* Recurring button toggle */}
        <button
          onClick={onToggleRecurring}
          className={`flex items-center gap-1 text-xs font-bold px-2 py-1.5 min-h-11 md:min-h-0 rounded-md border transition-all ${
            task.isRecurring
              ? 'bg-primary/10 border-primary/20 text-primary'
              : 'bg-surface border-border text-muted hover:text-foreground'
          }`}
          title="Repeat weekly on this day of week"
        >
          <RefreshCw className={`w-2.5 h-2.5 ${task.isRecurring ? 'animate-spin-slow' : ''}`} />
          <span>{task.isRecurring ? 'Weekly' : 'One-time'}</span>
        </button>
      </div>

      {/* Subtasks */}
      {task.subtasks.length > 0 && (
        <div className="ml-7 mt-2 flex flex-col gap-1.5 border-l-2 border-border pl-3">
          {task.subtasks.map((sub) => (
            <div key={sub.id} className="flex items-center gap-2 group/sub">
              <button
                onClick={() => onToggleSubtask(sub.id)}
                className={`flex-shrink-0 w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-all ${
                  sub.done
                    ? 'bg-foreground border-foreground text-background'
                    : 'border-border-strong hover:border-foreground'
                }`}
              >
                {sub.done && <Check className="w-2 h-2" />}
              </button>
              <span className={`text-xs ${sub.done ? 'line-through text-muted' : 'text-foreground-subtle'}`}>
                {sub.text}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeleteSubtask(sub.id)}
                className="opacity-100 md:opacity-0 md:group-hover/sub:opacity-100 hover:text-destructive ml-auto tap-target md:min-h-0 md:min-w-0 p-0 min-h-0"
                aria-label="Delete subtask"
              >
                <Minus className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add subtask */}
      {!task.done && (
        <button
          onClick={onAddSubtask}
          className="ml-7 mt-1.5 flex items-center gap-1.5 text-[11px] text-muted hover:text-foreground transition-colors"
        >
          <Plus className="w-3 h-3" />
          <span>Add subtask</span>
        </button>
      )}

      {/* Subtask progress */}
      {task.subtasks.length > 0 && (
        <div className="ml-7 mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden border border-border">
            <div
              className="h-full bg-foreground transition-all duration-300 rounded-full"
              style={{ width: `${(subtasksDone / task.subtasks.length) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-muted font-medium">{subtasksDone}/{task.subtasks.length}</span>
        </div>
      )}
    </motion.div>
  );
}

// ─── Prompt Modal ────────────────────────────────────────────────────────────

function PromptModal({
  isOpen,
  onClose,
  onApply,
  month,
  year,
}: {
  isOpen: boolean;
  onClose: () => void;
  onApply: (entries: ReturnType<typeof parsePrompt>) => void;
  month: number;
  year: number;
}) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ReturnType<typeof parsePrompt>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset modal state when opened
  const [prevPromptOpen, setPrevPromptOpen] = useState(isOpen);
  if (isOpen && !prevPromptOpen) {
    setText('');
    setParsed([]);
    setLoading(false);
    setError(null);
  }
  if (prevPromptOpen !== isOpen) {
    setPrevPromptOpen(isOpen);
  }

  const handleParse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      if (!auth.currentUser) {
        throw new Error('Please sign in to use AI plan parsing.');
      }
      const res = await authFetch('/api/planner/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: text, month, year }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to parse prompt');
      
      const parsedEntries = json.data || [];
      setParsed(parsedEntries);
      
      if (parsedEntries.length === 0) {
        setError('No study plan entries detected. Try adding specific dates and tasks.');
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'An error occurred while parsing the study plan.';
      setError(message);
      notify.error(err, 'Could not parse study plan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center">
            <Plus className="w-4 h-4 text-foreground" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">Add from Prompt</div>
            <p className="text-[11px] text-muted font-normal">Generate a structured study plan from natural language goals using AI</p>
          </div>
        </div>
      }
      className="max-h-[90vh]"
    >
      <div className="flex-1 overflow-y-auto -mt-2">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (parsed.length > 0) setParsed([]);
            if (error) setError(null);
          }}
          placeholder={`Type your study goals here, e.g.:\n"I want to finish DET unit 3 notes on the 27th, memorize them on the 28th, and study DAA branch and bound on the 31st. Then do complexity theory on June 1st."`}
          rows={8}
          className="w-full bg-surface border border-border rounded-xl p-4 text-sm text-foreground placeholder:text-muted/50 outline-none focus:border-foreground/30 resize-none leading-relaxed transition-colors"
        />

        <div className="flex justify-between items-center mt-3">
          <Button
            variant="primary"
            size="sm"
            onClick={handleParse}
            disabled={loading || !text.trim()}
          >
            {loading ? (
              <>
                <div className="w-3 h-3 border-2 border-background border-t-transparent rounded-full animate-spin" />
                Generating Plan...
              </>
            ) : (
              'Parse with AI'
            )}
          </Button>
          {error && (
            <span className="text-xs text-destructive font-medium">{error}</span>
          )}
        </div>

          {/* Live Preview */}
          {parsed.length > 0 && (
            <div className="mt-6 border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-3.5 h-3.5 text-foreground" />
                <span className="text-xs font-bold text-foreground">Preview: {parsed.reduce((s, e) => s + e.tasks.length, 0)} tasks across {parsed.length} days</span>
              </div>
              <div className="grid gap-2 max-h-[240px] overflow-y-auto pr-1">
                {parsed.map((entry) => {
                  const dateObj = new Date(entry.date + 'T00:00:00');
                  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                  const dayNum = dateObj.getDate();
                  const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });
                  return (
                    <div key={entry.date} className="flex gap-3 items-start bg-surface/50 border border-border rounded-lg p-3">
                      <div className="flex flex-col items-center min-w-[44px] bg-background border border-border rounded-lg px-2 py-1.5">
                        <span className="text-[10px] font-bold text-muted uppercase">{dayName}</span>
                        <span className="text-base font-black text-foreground leading-none">{dayNum}</span>
                        <span className="text-[9px] text-muted uppercase">{monthName}</span>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-1">
                        {entry.tasks.map((task) => (
                          <div key={task.id} className="flex flex-col gap-1">
                            <div className="flex items-start gap-2">
                              <Circle className="w-3 h-3 text-border-strong flex-shrink-0 mt-0.5" />
                              <span className="text-xs text-foreground font-medium">{task.text}</span>
                            </div>
                            {task.subtasks && task.subtasks.length > 0 && (
                              <div className="flex flex-col gap-1 pl-5 border-l border-border ml-1.5 mt-0.5">
                                {task.subtasks.map((sub) => (
                                  <div key={sub.id} className="flex items-center gap-2">
                                    <Circle className="w-2.5 h-2.5 text-muted/60 flex-shrink-0" />
                                    <span className="text-[11px] text-muted">{sub.text}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
        <span className="text-[11px] text-muted">
          Format: Any natural language study goals
        </span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              if (parsed.length > 0) {
                onApply(parsed);
                setText('');
                setParsed([]);
                onClose();
              }
            }}
            disabled={parsed.length === 0 || loading}
          >
            Apply {parsed.length > 0 ? `(${parsed.reduce((s, e) => s + e.tasks.length, 0)} tasks)` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Share / Collab Modal ────────────────────────────────────────────────────

function ShareModal({
  isOpen,
  onClose,
  planId,
  isPublic,
  onTogglePublic,
  collaborators,
  onAddCollaborator,
  onRemoveCollaborator,
}: {
  isOpen: boolean;
  onClose: () => void;
  planId: string | undefined;
  isPublic: boolean;
  onTogglePublic: () => void;
  collaborators: Collaborator[];
  onAddCollaborator: (email: string, role: 'editor' | 'viewer') => void;
  onRemoveCollaborator: (id: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [copied, setCopied] = useState(false);
  const sharePath = planId ? `/planner/shared/${planId}` : '';

  if (!isOpen) return null;

  const handleCopy = () => {
    const shareUrl = `${window.location.origin}${sharePath}`;
    void notify.promise(
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }),
      {
        loading: 'Copying…',
        success: 'Link copied',
        error: 'Could not copy',
        id: 'planner-link-copy',
      }
    );
  };

  const handleInvite = () => {
    if (!email.trim() || !email.includes('@')) {
      notify.error('Enter a valid email address');
      return;
    }
    onAddCollaborator(email.trim(), role);
    setEmail('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center p-4 animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-card border border-border w-full max-w-lg shadow-popover rounded-2xl overflow-hidden max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center">
              <Share2 className="w-4 h-4 text-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Share Plan</h2>
              <p className="text-[11px] text-muted">Collaborate or share a read-only link</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="tap-target rounded-lg bg-surface border border-border text-muted hover:text-foreground transition-colors"
            aria-label="Close share dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto">
          {!planId ? (
            <div className="text-center py-8">
              <CloudOff className="w-8 h-8 text-muted mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">Sign in to share</p>
              <p className="text-xs text-muted mb-4">Your plan needs to be saved to the cloud first.</p>
              <Link href="/login" className="inline-flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg text-xs font-bold hover:opacity-90 transition-opacity">
                <LogIn className="w-3.5 h-3.5" /> Sign in
              </Link>
            </div>
          ) : (
            <>
              {/* Public toggle */}
              <div className="flex items-center justify-between bg-surface rounded-xl border border-border p-4">
                <div className="flex items-center gap-3">
                  {isPublic ? <Globe className="w-4 h-4 text-foreground" /> : <Lock className="w-4 h-4 text-muted" />}
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {isPublic ? 'Public link enabled' : 'Private plan'}
                    </p>
                    <p className="text-[11px] text-muted">
                      {isPublic ? 'Anyone with the link can view' : 'Only you and collaborators can see this'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onTogglePublic}
                  className={`relative w-11 h-6 rounded-full border border-border transition-colors ${isPublic ? 'bg-foreground' : 'bg-surface-hover'}`}
                >
                  <div className={`absolute top-0.5 w-4.5 h-4.5 rounded-full border border-border bg-white transition-transform ${isPublic ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Copy link */}
              {isPublic && (
                <div className="flex gap-2">
                  <div className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 flex items-center gap-2 overflow-hidden">
                    <Link2 className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                    <span className="text-xs text-muted truncate font-mono">{sharePath}</span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="px-3 py-2 rounded-lg bg-foreground text-background text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}

              {/* Invite collaborator */}
              <div>
                <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" /> Invite collaborators
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted outline-none focus:border-foreground/30 transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                  />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                    className="ui-select ui-select-sm"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    onClick={handleInvite}
                    className="px-3 py-2 rounded-lg bg-surface border border-border text-foreground text-xs font-semibold hover:bg-surface-hover transition-colors"
                  >
                    Invite
                  </button>
                </div>
              </div>

              {/* Collaborator list */}
              {collaborators.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Collaborators ({collaborators.length})
                  </p>
                  <div className="space-y-1.5">
                    {collaborators.map((c) => (
                      <div key={c.id} className="flex items-center justify-between bg-surface rounded-lg border border-border px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-background border border-border flex items-center justify-center text-[10px] font-bold text-foreground uppercase">
                            {c.user_email[0]}
                          </div>
                          <span className="text-xs text-foreground">{c.user_email}</span>
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            c.role === 'editor' ? 'bg-surface border border-border text-foreground' : 'bg-surface-hover text-muted'
                          }`}>
                            {c.role}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveCollaborator(c.id)}
                          className="hover:text-destructive min-h-0 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Day Detail Panel ────────────────────────────────────────────────────────

function DayPanel({
  date,
  tasks,
  onClose,
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
  onAddTask,
  onToggleSubtask,
  onAddSubtask,
  onDeleteSubtask,
  onUpdateTaskCategory,
  onToggleTaskRecurring,
  onUpdateTaskStatus,
}: {
  date: string;
  tasks: Task[];
  onClose: () => void;
  onToggleTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateTask: (taskId: string, text: string) => void;
  onAddTask: () => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onAddSubtask: (taskId: string) => void;
  onDeleteSubtask: (taskId: string, subtaskId: string) => void;
  onUpdateTaskCategory: (taskId: string, category: TaskCategory) => void;
  onToggleTaskRecurring: (taskId: string) => void;
  onUpdateTaskStatus: (taskId: string, status: TaskStatus) => void;
}) {
  const dateObj = new Date(date + 'T00:00:00');
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const dayNum = dateObj.getDate();
  const monthName = dateObj.toLocaleDateString('en-US', { month: 'long' });
  const isToday = date === todayISO();
  const done = tasks.filter(t => t.done).length;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border w-full max-w-lg shadow-popover rounded-2xl flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center ${
              isToday
                ? 'bg-foreground text-background'
                : 'bg-surface border border-border text-foreground'
            }`}>
              <span className="text-[10px] font-bold uppercase leading-none opacity-70">{dayName.slice(0, 3)}</span>
              <span className="text-lg font-black leading-none">{dayNum}</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">{dayName}, {monthName} {dayNum}</h2>
              <p className="text-[11px] text-muted">
                {tasks.length === 0 ? 'No tasks yet' : `${done} of ${tasks.length} complete`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="tap-target rounded-lg bg-surface border border-border text-muted hover:text-foreground transition-colors"
            aria-label="Close day details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress */}
        {tasks.length > 0 && (
          <div className="px-6 pt-3">
            <div className="h-2 bg-surface rounded-full overflow-hidden border border-border">
              <div
                className="h-full bg-foreground transition-all duration-500 rounded-full"
                style={{ width: `${(done / tasks.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Tasks */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          <AnimatePresence>
            {tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={() => onToggleTask(task.id)}
                onDelete={() => onDeleteTask(task.id)}
                onUpdate={(text) => onUpdateTask(task.id, text)}
                onToggleSubtask={(subId) => onToggleSubtask(task.id, subId)}
                onAddSubtask={() => onAddSubtask(task.id)}
                onDeleteSubtask={(subId) => onDeleteSubtask(task.id, subId)}
                onUpdateCategory={(cat) => onUpdateTaskCategory(task.id, cat)}
                onToggleRecurring={() => onToggleTaskRecurring(task.id)}
                onUpdateStatus={(stat) => onUpdateTaskStatus(task.id, stat)}
              />
            ))}
          </AnimatePresence>

          {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <CalendarDays className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm font-medium">No tasks for this day</p>
              <p className="text-xs mt-1">Click below to add one</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border">
          <button
            onClick={onAddTask}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-border text-foreground text-xs font-semibold hover:bg-surface-hover transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Task
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PlannerClient() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [planData, setPlanData] = useState<PlanData>({});
  const [planMeta, setPlanMeta] = useState<PlanMeta>({
    title: 'Study Plan',
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    is_public: false,
  });
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const mounted = useIsClient();
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [plannerView, setPlannerView] = useState<'calendar' | 'list' | 'kanban'>('calendar');
  const [quickAddDate, setQuickAddDate] = useState<string | null>(null);
  const [quickAddText, setQuickAddText] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cloudHydratingRef = useRef(false);
  const skipLocalStampRef = useRef(false);
  const lastWrittenDataRef = useRef<string>('');
  const lastPushedSnapshotRef = useRef<string | null>(null);

  const today = todayISO();
  const calendarDays = useMemo(() => getCalendarDays(month, year), [month, year]);
  const upcomingExam = useMemo(() => {
    void planData;
    return getSoonestUpcomingExam();
  }, [planData]);

  const planPeriodKey = `${month}-${year}`;
  const [prevPlanPeriod, setPrevPlanPeriod] = useState('');
  if (prevPlanPeriod !== planPeriodKey) {
    setPrevPlanPeriod(planPeriodKey);
    // Reset during render with empty defaults; hydrate from localStorage after mount.
    setPlanData({});
    setPlanMeta({ title: 'Study Plan', month, year, is_public: false });
  }

  useLayoutEffect(() => {
    if (!prevPlanPeriod) return;
    lastWrittenDataRef.current = '';
    skipLocalStampRef.current = true;
  }, [planPeriodKey, prevPlanPeriod]);

  useEffect(() => {
    if (!mounted) return;
    queueMicrotask(() => {
      const saved = localStorage.getItem(storageKey(month, year));
      if (!saved) return;
      try {
        const parsed = JSON.parse(saved);
        skipLocalStampRef.current = true;
        setPlanData(parsed.data || {});
        setPlanMeta(parsed.meta || { title: 'Study Plan', month, year, is_public: false });
      } catch {
        /* keep empty defaults */
      }
    });
  }, [mounted, month, year]);

  // ── Auth ──
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ? { id: firebaseUser.uid, email: firebaseUser.email ?? undefined } : null);
    });
    return () => unsubscribe();
  }, []);

  const pullFromCloud = useCallback(async (signal?: { cancelled: boolean }) => {
    if (!user) return;
    await Promise.resolve();
    if (signal?.cancelled) return;
    cloudHydratingRef.current = true;
    setSyncing(true);
    try {
      if (!auth.currentUser) return;

      const res = await authFetch(`/api/planner?month=${month}&year=${year}`);

      if (signal?.cancelled) return;
      if (!res.ok) throw new Error(await res.text());
      const resData = await res.json();
      if (signal?.cancelled) return;

      if (resData.plan) {
        const p = resData.plan;
        const cloudUpdatedMs = p.updated_at ? new Date(p.updated_at).getTime() : 0;

        let localUpdatedMs = 0;
        try {
          const raw = localStorage.getItem(storageKey(month, year));
          if (raw) {
            const parsed = JSON.parse(raw);
            const ts = parsed?.meta?.updated_at || parsed?.updated_at;
            if (ts) localUpdatedMs = new Date(ts).getTime();
          }
        } catch {
          /* ignore */
        }

        // Last-write-wins: keep local when it is newer than cloud.
        if (localUpdatedMs > cloudUpdatedMs) {
          if (p.id) {
            skipLocalStampRef.current = true;
            setPlanMeta(prev => ({ ...prev, id: prev.id || p.id }));
          }
          setCollaborators(resData.collaborators || []);
          if (cloudUpdatedMs) setLastSynced(new Date(cloudUpdatedMs));
          return;
        }

        if (signal?.cancelled) return;

        const nextData = p.data || {};
        const nextMeta = {
          id: p.id,
          title: p.title || 'Study Plan',
          month,
          year,
          is_public: !!p.is_public,
          updated_at: p.updated_at || undefined,
        };
        skipLocalStampRef.current = true;
        setPlanData(nextData);
        setPlanMeta(nextMeta);
        
        let updatedDate = new Date();
        if (p.updated_at) {
          updatedDate = new Date(p.updated_at);
        }
        setLastSynced(updatedDate);
        localStorage.setItem(storageKey(month, year), JSON.stringify({
          data: nextData,
          meta: nextMeta
        }));

        lastPushedSnapshotRef.current = JSON.stringify({
          data: nextData,
          title: nextMeta.title,
          is_public: nextMeta.is_public,
        });

        setCollaborators(resData.collaborators || []);
      }
    } catch (e) {
      if (!signal?.cancelled) {
        console.error(e);
        notify.error('Could not load plan from cloud.');
      }
    } finally {
      if (!signal?.cancelled) {
        cloudHydratingRef.current = false;
        setSyncing(false);
      }
    }
  }, [user, month, year, setPlanData]);

  const cloudPullKey = user && mounted ? `${user.id}:${month}:${year}` : '';
  useEffect(() => {
    if (!cloudPullKey) return;
    const signal = { cancelled: false };
    queueMicrotask(() => {
      if (!signal.cancelled) void pullFromCloud(signal);
    });
    return () => {
      signal.cancelled = true;
    };
  }, [cloudPullKey, pullFromCloud]);

  // ── Save to localStorage ──
  useEffect(() => {
    if (!mounted) return;
    const key = storageKey(month, year);
    const dataSnap = JSON.stringify({
      data: planData,
      title: planMeta.title,
      is_public: planMeta.is_public,
      id: planMeta.id,
    });

    if (skipLocalStampRef.current) {
      localStorage.setItem(key, JSON.stringify({ data: planData, meta: planMeta }));
      lastWrittenDataRef.current = dataSnap;
      skipLocalStampRef.current = false;
      return;
    }

    let updated_at = planMeta.updated_at;
    if (lastWrittenDataRef.current && dataSnap !== lastWrittenDataRef.current) {
      updated_at = new Date().toISOString();
    }
    lastWrittenDataRef.current = dataSnap;
    localStorage.setItem(key, JSON.stringify({
      data: planData,
      meta: { ...planMeta, updated_at },
    }));
  }, [planData, planMeta, mounted, month, year]);

  // ── Cloud push (debounced) ──
  const pushToCloud = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    try {
      if (!auth.currentUser) return;

      const res = await authFetch('/api/planner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          month,
          year,
          data: planData,
          title: planMeta.title,
          is_public: planMeta.is_public,
          ...(planMeta.id ? { planId: planMeta.id } : {}),
        })
      });

      if (!res.ok) throw new Error(await res.text());
      const resData = await res.json();
      skipLocalStampRef.current = true;
      setPlanMeta(prev => ({ ...prev, id: resData.id, updated_at: new Date().toISOString() }));
      lastPushedSnapshotRef.current = JSON.stringify({
        data: planData,
        title: planMeta.title,
        is_public: planMeta.is_public,
      });
      setLastSynced(new Date());
    } catch (e) {
      console.error('Sync error:', e);
      notify.error('Cloud sync failed. Changes are still saved locally.');
    } finally {
      setSyncing(false);
    }
  }, [user, planData, planMeta.title, planMeta.is_public, planMeta.id, month, year]);

  useEffect(() => {
    if (!user || !mounted) return;
    if (cloudHydratingRef.current) return;
    const snapshot = JSON.stringify({
      data: planData,
      title: planMeta.title,
      is_public: planMeta.is_public,
    });
    if (snapshot === lastPushedSnapshotRef.current) return;
    const timer = setTimeout(() => pushToCloud(), 2000);
    return () => clearTimeout(timer);
  }, [planData, planMeta, user, mounted, pushToCloud]);

  // ── Task operations ──
  const addTask = (date: string, text: string = '', category: TaskCategory = 'General') => {
    setPlanData(prev => ({
      ...prev,
      [date]: [...(prev[date] || []), { id: generateId(), text, done: false, subtasks: [], category, status: 'todo' }],
    }));
  };

  const toggleTask = (date: string, taskId: string) => {
    setPlanData(prev => ({
      ...prev,
      [date]: (prev[date] || []).map(t => {
        if (t.id === taskId) {
          const next = !t.done;
          if (next) logActivity('planner_task_completed', 1);
          return { ...t, done: next, status: next ? 'done' : 'todo' };
        }
        return t;
      }),
    }));
  };

  const deleteTask = (date: string, taskId: string) => {
    pushUndoSnapshot();
    setPlanData(prev => ({
      ...prev,
      [date]: (prev[date] || []).filter(t => t.id !== taskId),
    }));
    notify.message('Task deleted', {
      action: {
        label: 'Undo',
        onClick: () => undoLastChange(),
      },
    });
  };

  const updateTask = (date: string, taskId: string, text: string) => {
    setPlanData(prev => ({
      ...prev,
      [date]: (prev[date] || []).map(t => t.id === taskId ? { ...t, text } : t),
    }));
  };

  const updateTaskCategory = (date: string, taskId: string, category: TaskCategory) => {
    setPlanData(prev => ({
      ...prev,
      [date]: (prev[date] || []).map(t => t.id === taskId ? { ...t, category } : t),
    }));
  };

  const updateTaskStatus = (date: string, taskId: string, status: TaskStatus) => {
    setPlanData(prev => ({
      ...prev,
      [date]: (prev[date] || []).map(t => {
        if (t.id === taskId) {
          return { ...t, status, done: status === 'done' };
        }
        return t;
      }),
    }));
  };

  const toggleTaskRecurring = (date: string, taskId: string) => {
    setPlanData(prev => {
      const { plan, propagated } = applyRecurringToggle(prev, date, taskId, generateId);
      if (propagated) {
        notify.success('Task recurring rule propagated through this month');
      }
      return plan;
    });
  };

  const toggleSubtask = (date: string, taskId: string, subtaskId: string) => {
    setPlanData(prev => ({
      ...prev,
      [date]: (prev[date] || []).map(t =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks.map(s => s.id === subtaskId ? { ...s, done: !s.done } : s) }
          : t
      ),
    }));
  };

  const addSubtask = (date: string, taskId: string) => {
    const text = prompt('Subtask text:');
    if (!text) return;
    setPlanData(prev => ({
      ...prev,
      [date]: (prev[date] || []).map(t =>
        t.id === taskId
          ? { ...t, subtasks: [...t.subtasks, { id: generateId(), text, done: false }] }
          : t
      ),
    }));
  };

  const deleteSubtask = (date: string, taskId: string, subtaskId: string) => {
    setPlanData(prev => ({
      ...prev,
      [date]: (prev[date] || []).map(t =>
        t.id === taskId
          ? { ...t, subtasks: t.subtasks.filter(s => s.id !== subtaskId) }
          : t
      ),
    }));
  };

  // ── Prompt apply ──
  const handlePromptApply = (entries: ReturnType<typeof parsePrompt>) => {
    setPlanData(prev => mergeEntries(prev, entries));
    notify.success(`Added ${entries.reduce((s, e) => s + e.tasks.length, 0)} tasks across ${entries.length} days`);
  };

  // ── Navigation ──
  const goNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const goPrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const goToday = () => {
    const n = new Date();
    setMonth(n.getMonth() + 1);
    setYear(n.getFullYear());
  };

  // ── Share/collab ──
  const togglePublic = async () => {
    const newVal = !planMeta.is_public;
    setPlanMeta(prev => ({ ...prev, is_public: newVal }));
    notify.success(newVal ? 'Plan is now public' : 'Plan is now private');
  };

  const addCollaborator = async (email: string, role: 'editor' | 'viewer') => {
    if (!planMeta.id) {
      notify.error('Save your plan to the cloud first');
      return;
    }
    if (!auth.currentUser) return;

    try {
      await notify.promise(
        (async () => {
          const res = await authFetch('/api/planner/collaborators', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              planId: planMeta.id,
              email,
              role
            })
          });

          if (!res.ok) {
            const errText = await res.text();
            let parsedErr;
            try { parsedErr = JSON.parse(errText); } catch {}
            throw new Error(parsedErr?.error || errText);
          }

          const resData = await res.json();
          setCollaborators(prev => [...prev, resData.collaborator]);
        })(),
        {
          loading: 'Inviting collaborator…',
          success: `Invited ${email} as ${role}`,
          error: 'Could not invite collaborator',
          id: 'planner-invite',
        }
      );
    } catch {
      // notify.promise already surfaced the error
    }
  };

  const removeCollaborator = async (id: string) => {
    if (!auth.currentUser) return;

    try {
      await notify.promise(
        (async () => {
          const res = await authFetch(`/api/planner/collaborators?id=${id}`, {
            method: 'DELETE',
          });

          if (!res.ok) throw new Error(await res.text());

          setCollaborators(prev => prev.filter(c => c.id !== id));
        })(),
        {
          loading: 'Removing collaborator…',
          success: 'Collaborator removed',
          error: 'Could not remove collaborator',
          id: 'planner-remove-collaborator',
        }
      );
    } catch {
      // notify.promise already surfaced the error
    }
  };

  // ── Export/Import ──
  const undoStackRef = useRef<PlanData[]>([]);

  const pushUndoSnapshot = useCallback(() => {
    undoStackRef.current = [
      ...undoStackRef.current.slice(-19),
      structuredClone(planData),
    ];
  }, [planData]);

  const undoLastChange = useCallback(() => {
    const prev = undoStackRef.current.pop();
    if (!prev) {
      notify.message('Nothing to undo');
      return;
    }
    setPlanData(prev);
    notify.success('Restored');
  }, [setPlanData]);

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ meta: planMeta, data: planData }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-plan-${MONTH_NAMES[month - 1].toLowerCase()}-${year}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const escapeIcs = (text: string) =>
    text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');

  const exportIcs = () => {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//UtilityOS//Planner//EN',
      'CALSCALE:GREGORIAN',
    ];
    for (const [date, tasks] of Object.entries(planData)) {
      for (const task of tasks || []) {
        const dt = date.replace(/-/g, '');
        lines.push(
          'BEGIN:VEVENT',
          `UID:${task.id}@utilityos.tech`,
          `DTSTAMP:${dt}T000000Z`,
          `DTSTART;VALUE=DATE:${dt}`,
          `SUMMARY:${escapeIcs(task.text)}`,
          task.done || task.status === 'done' ? 'STATUS:COMPLETED' : 'STATUS:CONFIRMED',
          'END:VEVENT',
        );
      }
    }
    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-plan-${MONTH_NAMES[month - 1].toLowerCase()}-${year}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    notify.success('Calendar exported');
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        const { data, meta, legacy } = normalizeImportedPlan(parsed);
        pushUndoSnapshot();
        setPlanData(data);
        if (meta) setPlanMeta(meta);
        notify.success(legacy ? 'Plan imported (legacy format)' : 'Plan imported');
      } catch {
        notify.error('Invalid file format');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const clearAll = () => {
    if (confirm(`Clear all tasks for ${MONTH_NAMES[month - 1]} ${year}?`)) {
      pushUndoSnapshot();
      setPlanData({});
      notify.message('Month cleared', {
        action: {
          label: 'Undo',
          onClick: () => undoLastChange(),
        },
      });
    }
  };

  // ── Stats ──
  const totalTasks = Object.values(planData).reduce((s, t) => s + (t?.length || 0), 0);
  const doneTasks = Object.values(planData).reduce((s, t) => s + (t || []).filter(x => x.done).length, 0);
  const progressPct = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

  if (!mounted) return null;

  return (
    <div className="flex-1 w-full min-w-0 page-gutter py-6 sm:py-8 max-w-5xl mx-auto flex flex-col gap-5 sm:gap-6 pb-12">
      {/* ── Header toolkit ── */}
      <Card className="rounded-2xl" padding="lg">
        <PageHeader
          className="min-w-0"
          eyebrow="Productivity"
          title={
            editingTitle ? (
              <input
                autoFocus
                value={planMeta.title}
                onChange={(e) => setPlanMeta(prev => ({ ...prev, title: e.target.value }))}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(false)}
                className="font-display text-2xl sm:text-3xl tracking-tight text-foreground bg-transparent border-b-2 border-foreground outline-none w-full min-w-0 max-w-full"
              />
            ) : (
              <span
                className="cursor-pointer hover:opacity-70 transition-opacity break-words min-w-0"
                onClick={() => setEditingTitle(true)}
                title="Click to rename"
              >
                {planMeta.title}
              </span>
            )
          }
          description="Plan the month, then switch to list or board when you need focus."
          actions={
            <div className="flex flex-wrap items-center gap-2 min-w-0 w-full sm:w-auto sm:justify-end">
            {upcomingExam && (
              <span
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground border border-border rounded-full px-2.5 py-1 bg-surface"
                title={upcomingExam.text}
              >
                <CalendarDays className="w-3.5 h-3.5 text-muted" />
                {upcomingExam.daysUntil === 0
                  ? "Exam today"
                  : upcomingExam.daysUntil === 1
                    ? "Exam tomorrow"
                    : `Exam in ${upcomingExam.daysUntil}d`}
              </span>
            )}
            {/* Cloud sync */}
            {user ? (
              <div className="flex items-center gap-1.5 text-xs text-muted px-2 py-1.5 rounded-lg bg-surface border border-border/70">
                {syncing ? (
                  <>
                    <div className="w-3 h-3 border border-muted border-t-foreground rounded-full animate-spin" />
                    <span>Syncing…</span>
                  </>
                ) : lastSynced ? (
                  <>
                    <Cloud className="w-3.5 h-3.5 text-foreground" />
                    <span>Synced {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-3.5 h-3.5" />
                    <span>Cloud enabled</span>
                  </>
                )}
              </div>
            ) : (
              <AppLink
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground border border-border rounded-lg px-2.5 py-2 min-h-11 hover:bg-surface transition-colors"
              >
                <CloudOff className="w-3.5 h-3.5" />
                Sign in to sync
                <LogIn className="w-3 h-3" />
              </AppLink>
            )}

            <button
              onClick={() => setPromptOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-background bg-foreground border border-foreground rounded-lg px-2.5 py-2 min-h-11 hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              Add from Prompt
            </button>

            <div className="hidden sm:flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShareOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground border border-border rounded-lg px-2.5 py-2 min-h-11 hover:bg-surface transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share
              </button>
              <button onClick={exportData} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground border border-border rounded-lg px-2.5 py-2 min-h-11 hover:bg-surface transition-colors">
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
              <button onClick={exportIcs} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground border border-border rounded-lg px-2.5 py-2 min-h-11 hover:bg-surface transition-colors">
                <CalendarDays className="w-3.5 h-3.5" />
                ICS
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground border border-border rounded-lg px-2.5 py-2 min-h-11 hover:bg-surface transition-colors">
                <Upload className="w-3.5 h-3.5" />
                Import
              </button>
              <button
                onClick={undoLastChange}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground border border-border rounded-lg px-2.5 py-2 min-h-11 hover:bg-surface transition-colors"
                title="Undo"
                aria-label="Undo"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="min-h-11 hover:text-destructive hover:border-destructive/30"
                aria-label="Clear month"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="relative sm:hidden">
              <button
                onClick={() => setMoreOpen((o) => !o)}
                className="tap-target rounded-lg border border-border text-muted hover:text-foreground hover:bg-surface"
                aria-label="More planner actions"
                aria-expanded={moreOpen}
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {moreOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-30 w-44 bg-card border border-border rounded-xl shadow-popover p-1 flex flex-col">
                  <button onClick={() => { setShareOpen(true); setMoreOpen(false); }} className="flex items-center gap-2 px-3 py-2.5 min-h-11 text-xs font-medium text-foreground hover:bg-surface rounded-lg text-left">
                    <Share2 className="w-3.5 h-3.5" /> Share
                  </button>
                  <button onClick={() => { exportData(); setMoreOpen(false); }} className="flex items-center gap-2 px-3 py-2.5 min-h-11 text-xs font-medium text-foreground hover:bg-surface rounded-lg text-left">
                    <Download className="w-3.5 h-3.5" /> Export JSON
                  </button>
                  <button onClick={() => { exportIcs(); setMoreOpen(false); }} className="flex items-center gap-2 px-3 py-2.5 min-h-11 text-xs font-medium text-foreground hover:bg-surface rounded-lg text-left">
                    <CalendarDays className="w-3.5 h-3.5" /> Export ICS
                  </button>
                  <button onClick={() => { fileInputRef.current?.click(); setMoreOpen(false); }} className="flex items-center gap-2 px-3 py-2.5 min-h-11 text-xs font-medium text-foreground hover:bg-surface rounded-lg text-left">
                    <Upload className="w-3.5 h-3.5" /> Import
                  </button>
                  <button onClick={() => { undoLastChange(); setMoreOpen(false); }} className="flex items-center gap-2 px-3 py-2.5 min-h-11 text-xs font-medium text-foreground hover:bg-surface rounded-lg text-left">
                    <Undo2 className="w-3.5 h-3.5" /> Undo
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => { clearAll(); setMoreOpen(false); }} className="min-h-11 text-destructive hover:bg-surface justify-start w-full">
                    <Trash2 className="w-3.5 h-3.5" /> Clear month
                  </Button>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={importData} />
            </div>
          }
        />
      </Card>

      {/* ── Controls toolkit ── */}
      <Card className="rounded-2xl" padding="md">
        <div className="flex flex-col gap-3 sm:gap-4 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
            <Segmented
              value={plannerView}
              onChange={setPlannerView}
              aria-label="Planner view"
              options={[
                { value: 'calendar', label: (<span className="inline-flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /><span className="hidden sm:inline">Calendar</span></span>) },
                { value: 'list', label: (<span className="inline-flex items-center gap-1.5"><List className="w-3.5 h-3.5" /><span className="hidden sm:inline">List</span></span>) },
                { value: 'kanban', label: (<span className="inline-flex items-center gap-1.5"><Columns className="w-3.5 h-3.5" /><span className="hidden sm:inline">Kanban</span></span>) },
              ]}
            />

            <div className="flex items-center gap-1.5 min-w-0 sm:flex-1 sm:justify-center">
              <button
                onClick={goPrevMonth}
                className="tap-target shrink-0 rounded-lg bg-surface border border-border text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0 px-2 text-center">
                <span className="text-sm sm:text-base font-bold text-foreground">{MONTH_NAMES[month - 1]}</span>
                <span className="text-sm sm:text-base font-light text-muted ml-1.5">{year}</span>
              </div>
              <button
                onClick={goNextMonth}
                className="tap-target shrink-0 rounded-lg bg-surface border border-border text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={goToday}
                className="shrink-0 min-h-9 px-3 rounded-lg text-[11px] font-semibold text-muted hover:text-foreground bg-surface border border-border hover:bg-surface-hover transition-colors"
              >
                Today
              </button>
            </div>

            <div className="flex items-center gap-3 min-w-0 sm:w-48 sm:shrink-0">
              <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden border border-border">
                <div
                  className="h-full bg-foreground rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-muted whitespace-nowrap">
                {doneTasks}/{totalTasks}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Calendar View ── */}
      {plannerView === 'calendar' && (
        <>
        <Card className="hidden lg:block rounded-2xl overflow-hidden animate-fade-in" padding="none">
        <div className="grid grid-cols-7 gap-px bg-border/80">
          {/* Day headers */}
          {DAY_LABELS.map((d) => (
            <div key={d} className="bg-surface/80 py-3 text-center">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">{d}</span>
            </div>
          ))}

          {/* Day cells */}
          {calendarDays.map(({ date, dayNum, isCurrentMonth }) => {
            const tasks = planData[date] || [];
            const isToday = date === today;
            const done = tasks.filter(t => t.done).length;
            const hasOverflow = tasks.length > 3;

            return (
              <div
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`min-h-[108px] sm:min-h-[124px] p-2 sm:p-2.5 flex flex-col cursor-pointer transition-all hover:bg-surface/60 group/cell relative ${
                  isCurrentMonth ? 'bg-card' : 'bg-surface/40 opacity-55'
                } ${isToday ? 'ring-1 ring-inset ring-foreground/25' : ''}`}
              >
                {/* Date number */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-bold leading-none w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                    isToday
                      ? 'bg-foreground text-background'
                      : 'text-foreground group-hover/cell:bg-surface'
                  }`}>
                    {dayNum}
                  </span>
                  {tasks.length > 0 && (
                    <span className="text-[9px] font-bold text-muted">
                      {done}/{tasks.length}
                    </span>
                  )}
                </div>

                {/* Task preview (compact chips) */}
                <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
                  {tasks.slice(0, 3).map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      compact
                      onToggle={() => toggleTask(date, task.id)}
                      onDelete={() => deleteTask(date, task.id)}
                      onUpdate={(text) => updateTask(date, task.id, text)}
                      onToggleSubtask={(subId) => toggleSubtask(date, task.id, subId)}
                      onAddSubtask={() => addSubtask(date, task.id)}
                      onDeleteSubtask={(subId) => deleteSubtask(date, task.id, subId)}
                    />
                  ))}
                  {hasOverflow && (
                    <span className="text-[10px] text-muted font-medium flex items-center gap-0.5 mt-0.5">
                      <MoreHorizontal className="w-3 h-3" />
                      +{tasks.length - 3} more
                    </span>
                  )}
                </div>

                {/* Quick Add Input inside cell */}
                {isCurrentMonth && (
                  <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                    {quickAddDate === date ? (
                      <input
                        autoFocus
                        type="text"
                        value={quickAddText}
                        onChange={(e) => setQuickAddText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (quickAddText.trim()) {
                              addTask(date, quickAddText.trim());
                              notify.success('Task added');
                            }
                            setQuickAddDate(null);
                            setQuickAddText('');
                          } else if (e.key === 'Escape') {
                            setQuickAddDate(null);
                            setQuickAddText('');
                          }
                        }}
                        onBlur={() => {
                          if (quickAddText.trim()) {
                            addTask(date, quickAddText.trim());
                            notify.success('Task added');
                          }
                          setQuickAddDate(null);
                          setQuickAddText('');
                        }}
                        placeholder="New task..."
                        className="w-full bg-surface border border-foreground/15 rounded-md px-1.5 py-0.5 text-[10px] text-foreground placeholder:text-muted/50 outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setQuickAddDate(date);
                          setQuickAddText('');
                        }}
                        className="opacity-0 group-hover/cell:opacity-100 transition-opacity w-full py-0.5 rounded border border-dashed border-border-strong text-[9px] text-muted hover:text-foreground hover:bg-surface flex items-center justify-center gap-0.5"
                      >
                        <Plus className="w-2.5 h-2.5" /> Quick Add
                      </button>
                    )}
                  </div>
                )}

                {/* Progress mini bar */}
                {tasks.length > 0 && !quickAddDate && (
                  <div className="mt-auto pt-1">
                    <div className="h-0.5 bg-surface rounded-full overflow-hidden">
                      <div
                        className="h-full bg-foreground transition-all duration-300 rounded-full"
                        style={{ width: `${(done / tasks.length) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </Card>

        <div className="lg:hidden space-y-3 animate-fade-in">
          {(() => {
            const monthDays = calendarDays.filter((d) => d.isCurrentMonth);
            const todayIdx = monthDays.findIndex((d) => d.date === today);
            const ordered =
              todayIdx >= 0
                ? [...monthDays.slice(todayIdx), ...monthDays.slice(0, todayIdx)]
                : monthDays;
            return ordered.map(({ date, dayNum }) => {
              const tasks = planData[date] || [];
              const isToday = date === today;
              const done = tasks.filter((t) => t.done).length;
              const dateObj = new Date(date + "T00:00:00");
              const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
              return (
                <div
                  key={date}
                  className="bg-card border border-border rounded-xl p-3 active:bg-surface/50"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center shrink-0 ${
                        isToday
                          ? "bg-foreground text-background"
                          : "bg-surface border border-border text-foreground"
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase leading-none opacity-85">
                        {dayName}
                      </span>
                      <span className="text-base font-black leading-none">{dayNum}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-foreground">
                        {isToday ? "Today" : dateObj.toLocaleDateString("en-US", { weekday: "long" })}
                      </p>
                      <p className="text-xs text-muted">
                        {tasks.length === 0
                          ? "No tasks"
                          : `${done}/${tasks.length} done`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(date);
                        addTask(date);
                      }}
                      className="tap-target rounded-lg border border-border text-muted hover:text-foreground"
                      aria-label={`Add task on ${date}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {tasks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedDate(date)}
                      className="w-full text-left space-y-1.5"
                    >
                      {tasks.slice(0, 4).map((task) => (
                        <div key={task.id} className="flex items-center gap-2 text-sm">
                          <span
                            className={`w-4 h-4 rounded border shrink-0 ${
                              task.done
                                ? "bg-foreground border-foreground"
                                : "border-border-strong"
                            }`}
                          />
                          <span
                            className={`truncate ${
                              task.done ? "line-through text-muted" : "text-foreground"
                            }`}
                          >
                            {task.text || "Untitled"}
                          </span>
                        </div>
                      ))}
                      {tasks.length > 4 && (
                        <p className="text-xs text-muted">+{tasks.length - 4} more</p>
                      )}
                    </button>
                  )}
                </div>
              );
            });
          })()}
        </div>
        </>
      )}

      {/* ── List View ── */}
      {plannerView === 'list' && (
        <div className="space-y-4 animate-fade-in">
          {calendarDays.filter(d => d.isCurrentMonth && (planData[d.date] || []).length > 0).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-card border border-border rounded-xl">
              <CalendarDays className="w-12 h-12 text-muted/30 mb-3" />
              <h3 className="text-sm font-bold text-foreground">No tasks scheduled</h3>
              <p className="text-xs text-muted mt-1 mb-4">No tasks set for the month of {MONTH_NAMES[month - 1]}.</p>
              <button
                onClick={() => {
                  const todayStr = todayISO();
                  setSelectedDate(todayStr);
                  addTask(todayStr);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-foreground text-background rounded-lg text-xs font-bold hover:opacity-90 transition-opacity"
              >
                <Plus className="w-3.5 h-3.5" /> Create Task for Today
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {calendarDays
                .filter(d => d.isCurrentMonth && (planData[d.date] || []).length > 0)
                .map((day) => {
                  const tasks = planData[day.date] || [];
                  const dateObj = new Date(day.date + 'T00:00:00');
                  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                  const dayNum = dateObj.getDate();
                  const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });
                  const isToday = day.date === today;

                  return (
                    <div key={day.date} className="flex flex-col md:flex-row gap-4 bg-card border border-border rounded-xl p-4 shadow-sm hover:border-foreground/10 transition-colors">
                      {/* Date details */}
                      <div className="md:w-48 flex-shrink-0 flex items-center md:items-start gap-3 md:flex-col">
                        <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center ${
                          isToday ? 'bg-foreground text-background' : 'bg-surface border border-border text-foreground'
                        }`}>
                          <span className="text-[9px] font-bold uppercase leading-none opacity-85">{dayName.slice(0, 3)}</span>
                          <span className="text-base font-black leading-none">{dayNum}</span>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-foreground">{dayName}</h4>
                          <p className="text-[10px] text-muted">{monthName} {dayNum}, {year}</p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedDate(day.date);
                            addTask(day.date);
                          }}
                          className="ml-auto md:ml-0 inline-flex items-center gap-1 text-[10px] font-bold text-muted hover:text-foreground transition-colors"
                        >
                          <Plus className="w-3 h-3" /> Add Task
                        </button>
                      </div>

                      {/* Tasks lists */}
                      <div className="flex-1 space-y-2">
                        <AnimatePresence>
                          {tasks.map((task) => (
                            <TaskItem
                              key={task.id}
                              task={task}
                              onToggle={() => toggleTask(day.date, task.id)}
                              onDelete={() => deleteTask(day.date, task.id)}
                              onUpdate={(text) => updateTask(day.date, task.id, text)}
                              onToggleSubtask={(subId) => toggleSubtask(day.date, task.id, subId)}
                              onAddSubtask={() => addSubtask(day.date, task.id)}
                              onDeleteSubtask={(subId) => deleteSubtask(day.date, task.id, subId)}
                              onUpdateCategory={(cat) => updateTaskCategory(day.date, task.id, cat)}
                              onToggleRecurring={() => toggleTaskRecurring(day.date, task.id)}
                              onUpdateStatus={(stat) => updateTaskStatus(day.date, task.id, stat)}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ── Kanban View ── */}
      {plannerView === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start animate-fade-in">
          {/* TO DO COLUMN */}
          <div className="bg-card border border-border rounded-2xl shadow-card p-4 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-destructive" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">To Do</h3>
              </div>
              <span className="text-[10px] font-bold bg-surface border border-border text-muted px-2 py-0.5 rounded-full">
                {calendarDays.filter(d => d.isCurrentMonth).reduce((acc, d) => acc + (planData[d.date] || []).filter(t => !t.done && (t.status === 'todo' || !t.status)).length, 0)}
              </span>
            </div>
            
            <div className="overflow-y-auto space-y-4 flex-1 max-h-[60vh] pr-1">
              {calendarDays.filter(d => d.isCurrentMonth).map((day) => {
                const tasks = (planData[day.date] || []).filter(t => !t.done && (t.status === 'todo' || !t.status));
                if (tasks.length === 0) return null;
                const dateObj = new Date(day.date + 'T00:00:00');
                const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                return (
                  <div key={day.date} className="space-y-2">
                    <span className="text-[9px] font-bold bg-surface border border-border text-muted px-1.5 py-0.5 rounded-md">
                      {dateLabel}
                    </span>
                    {tasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onToggle={() => toggleTask(day.date, task.id)}
                        onDelete={() => deleteTask(day.date, task.id)}
                        onUpdate={(text) => updateTask(day.date, task.id, text)}
                        onToggleSubtask={(subId) => toggleSubtask(day.date, task.id, subId)}
                        onAddSubtask={() => addSubtask(day.date, task.id)}
                        onDeleteSubtask={(subId) => deleteSubtask(day.date, task.id, subId)}
                        onUpdateCategory={(cat) => updateTaskCategory(day.date, task.id, cat)}
                        onToggleRecurring={() => toggleTaskRecurring(day.date, task.id)}
                        onUpdateStatus={(stat) => updateTaskStatus(day.date, task.id, stat)}
                      />
                    ))}
                  </div>
                );
              })}
              
              {calendarDays.filter(d => d.isCurrentMonth).reduce((acc, d) => acc + (planData[d.date] || []).filter(t => !t.done && (t.status === 'todo' || !t.status)).length, 0) === 0 && (
                <div className="text-center py-8 text-muted text-xs">
                  No tasks to do
                </div>
              )}
            </div>
          </div>

          {/* IN PROGRESS COLUMN */}
          <div className="bg-card border border-border rounded-2xl shadow-card p-4 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-muted" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">In Progress</h3>
              </div>
              <span className="text-[10px] font-bold bg-surface border border-border text-muted px-2 py-0.5 rounded-full">
                {calendarDays.filter(d => d.isCurrentMonth).reduce((acc, d) => acc + (planData[d.date] || []).filter(t => !t.done && t.status === 'in-progress').length, 0)}
              </span>
            </div>

            <div className="overflow-y-auto space-y-4 flex-1 max-h-[60vh] pr-1">
              {calendarDays.filter(d => d.isCurrentMonth).map((day) => {
                const tasks = (planData[day.date] || []).filter(t => !t.done && t.status === 'in-progress');
                if (tasks.length === 0) return null;
                const dateObj = new Date(day.date + 'T00:00:00');
                const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                return (
                  <div key={day.date} className="space-y-2">
                    <span className="text-[9px] font-bold bg-surface border border-border text-muted px-1.5 py-0.5 rounded-md">
                      {dateLabel}
                    </span>
                    {tasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onToggle={() => toggleTask(day.date, task.id)}
                        onDelete={() => deleteTask(day.date, task.id)}
                        onUpdate={(text) => updateTask(day.date, task.id, text)}
                        onToggleSubtask={(subId) => toggleSubtask(day.date, task.id, subId)}
                        onAddSubtask={() => addSubtask(day.date, task.id)}
                        onDeleteSubtask={(subId) => deleteSubtask(day.date, task.id, subId)}
                        onUpdateCategory={(cat) => updateTaskCategory(day.date, task.id, cat)}
                        onToggleRecurring={() => toggleTaskRecurring(day.date, task.id)}
                        onUpdateStatus={(stat) => updateTaskStatus(day.date, task.id, stat)}
                      />
                    ))}
                  </div>
                );
              })}

              {calendarDays.filter(d => d.isCurrentMonth).reduce((acc, d) => acc + (planData[d.date] || []).filter(t => !t.done && t.status === 'in-progress').length, 0) === 0 && (
                <div className="text-center py-8 text-muted text-xs">
                  No tasks in progress
                </div>
              )}
            </div>
          </div>

          {/* DONE COLUMN */}
          <div className="bg-card border border-border rounded-2xl shadow-card p-4 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-foreground" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Completed</h3>
              </div>
              <span className="text-[10px] font-bold bg-surface border border-border text-muted px-2 py-0.5 rounded-full">
                {calendarDays.filter(d => d.isCurrentMonth).reduce((acc, d) => acc + (planData[d.date] || []).filter(t => t.done || t.status === 'done').length, 0)}
              </span>
            </div>

            <div className="overflow-y-auto space-y-4 flex-1 max-h-[60vh] pr-1">
              {calendarDays.filter(d => d.isCurrentMonth).map((day) => {
                const tasks = (planData[day.date] || []).filter(t => t.done || t.status === 'done');
                if (tasks.length === 0) return null;
                const dateObj = new Date(day.date + 'T00:00:00');
                const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                return (
                  <div key={day.date} className="space-y-2">
                    <span className="text-[9px] font-bold bg-surface border border-border text-muted px-1.5 py-0.5 rounded-md">
                      {dateLabel}
                    </span>
                    {tasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onToggle={() => toggleTask(day.date, task.id)}
                        onDelete={() => deleteTask(day.date, task.id)}
                        onUpdate={(text) => updateTask(day.date, task.id, text)}
                        onToggleSubtask={(subId) => toggleSubtask(day.date, task.id, subId)}
                        onAddSubtask={() => addSubtask(day.date, task.id)}
                        onDeleteSubtask={(subId) => deleteSubtask(day.date, task.id, subId)}
                        onUpdateCategory={(cat) => updateTaskCategory(day.date, task.id, cat)}
                        onToggleRecurring={() => toggleTaskRecurring(day.date, task.id)}
                        onUpdateStatus={(stat) => updateTaskStatus(day.date, task.id, stat)}
                      />
                    ))}
                  </div>
                );
              })}

              {calendarDays.filter(d => d.isCurrentMonth).reduce((acc, d) => acc + (planData[d.date] || []).filter(t => t.done || t.status === 'done').length, 0) === 0 && (
                <div className="text-center py-8 text-muted text-xs">
                  No completed tasks
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Day Detail Panel ── */}
      <AnimatePresence>
        {selectedDate && (
          <DayPanel
            date={selectedDate}
            tasks={planData[selectedDate] || []}
            onClose={() => setSelectedDate(null)}
            onToggleTask={(taskId) => toggleTask(selectedDate, taskId)}
            onDeleteTask={(taskId) => deleteTask(selectedDate, taskId)}
            onUpdateTask={(taskId, text) => updateTask(selectedDate, taskId, text)}
            onAddTask={() => addTask(selectedDate)}
            onToggleSubtask={(taskId, subId) => toggleSubtask(selectedDate, taskId, subId)}
            onAddSubtask={(taskId) => addSubtask(selectedDate, taskId)}
            onDeleteSubtask={(taskId, subId) => deleteSubtask(selectedDate, taskId, subId)}
            onUpdateTaskCategory={(taskId, cat) => updateTaskCategory(selectedDate, taskId, cat)}
            onToggleTaskRecurring={(taskId) => toggleTaskRecurring(selectedDate, taskId)}
            onUpdateTaskStatus={(taskId, stat) => updateTaskStatus(selectedDate, taskId, stat)}
          />
        )}
      </AnimatePresence>

      {/* ── Prompt Modal ── */}
      <PromptModal
        isOpen={promptOpen}
        onClose={() => setPromptOpen(false)}
        onApply={handlePromptApply}
        month={month}
        year={year}
      />

      {/* ── Share Modal ── */}
      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        planId={planMeta.id}
        isPublic={planMeta.is_public}
        onTogglePublic={togglePublic}
        collaborators={collaborators}
        onAddCollaborator={addCollaborator}
        onRemoveCollaborator={removeCollaborator}
      />
    </div>
  );
}
