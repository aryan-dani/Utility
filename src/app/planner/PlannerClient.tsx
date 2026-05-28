'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, X, Check, Trash2, Download, Upload, Cloud, CloudOff, LogIn, ChevronLeft, ChevronRight,
  Share2, Copy, Users, Link2, Globe, Lock, UserPlus, CheckCircle2, Circle,
  CalendarDays, MoreHorizontal, Minus, List, Columns, Calendar, RefreshCw, Tag
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { logActivity } from '@/components/ActivityHeatmap';
import { parsePrompt, mergeEntries } from '@/lib/promptParser';
import { toast } from 'sonner';

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
};

type Collaborator = {
  id: string;
  user_email: string;
  role: 'editor' | 'viewer';
};

const CATEGORY_COLORS: Record<string, { bg: string, text: string, border: string }> = {
  'Exam Prep': { bg: 'bg-red-500/10 dark:bg-red-500/20', text: 'text-red-600 dark:text-red-400', border: 'border-red-500/20' },
  'Assignment': { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/20' },
  'Project': { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-500/20' },
  'Revision': { bg: 'bg-green-500/10 dark:bg-green-500/20', text: 'text-green-600 dark:text-green-400', border: 'border-green-500/20' },
  'General': { bg: 'bg-surface', text: 'text-muted', border: 'border-border' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

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

const STORAGE_KEY_PREFIX = 'utility_planner_v2_';

function storageKey(month: number, year: number) {
  return `${STORAGE_KEY_PREFIX}${year}_${month}`;
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
  onUpdateCategory?: (category: any) => void;
  onToggleRecurring?: () => void;
  onUpdateStatus?: (status: 'todo' | 'in-progress' | 'done') => void;
  compact?: boolean;
}) {
  if (compact) {
    const catColor = CATEGORY_COLORS[task.category || 'General'];
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
          <span className={`w-1 h-1 rounded-full shrink-0 ${
            task.category === 'Exam Prep' ? 'bg-red-500' :
            task.category === 'Assignment' ? 'bg-blue-500' :
            task.category === 'Project' ? 'bg-purple-500' :
            task.category === 'Revision' ? 'bg-green-500' :
            'bg-muted'
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
          className={`flex-shrink-0 w-[18px] h-[18px] mt-0.5 rounded-md border-[1.5px] flex items-center justify-center transition-all ${
            task.done
              ? 'bg-foreground border-foreground text-background'
              : 'bg-card border-border-strong hover:border-foreground'
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

        <button
          onClick={onDelete}
          className="opacity-0 group-hover/task:opacity-100 flex-shrink-0 text-muted hover:text-red-500 transition-all mt-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Task properties (Category, Status, Recurring) */}
      <div className="flex flex-wrap items-center gap-2 mt-2 ml-7">
        {/* Category Badges dropdown */}
        <select
          value={currentCategory}
          onChange={(e) => onUpdateCategory?.(e.target.value as any)}
          className={`text-[9px] font-bold px-2 py-0.5 rounded-md border outline-none cursor-pointer ${catColor.bg} ${catColor.text} ${catColor.border}`}
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
          onChange={(e) => onUpdateStatus?.(e.target.value as any)}
          className="text-[9px] font-bold px-2 py-0.5 rounded-md border border-border bg-surface text-foreground outline-none cursor-pointer"
        >
          <option value="todo">To Do</option>
          <option value="in-progress">In Progress</option>
          <option value="done">Done</option>
        </select>

        {/* Recurring button toggle */}
        <button
          onClick={onToggleRecurring}
          className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-md border transition-all ${
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
              <button
                onClick={() => onDeleteSubtask(sub.id)}
                className="opacity-0 group-hover/sub:opacity-100 text-muted hover:text-red-500 transition-all ml-auto"
              >
                <Minus className="w-3 h-3" />
              </button>
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
          <div className="flex-1 h-1 bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-foreground transition-all duration-300"
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
  useEffect(() => {
    if (isOpen) {
      setText('');
      setParsed([]);
      setLoading(false);
      setError(null);
    }
  }, [isOpen]);

  const handleParse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/planner/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, month, year }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to parse prompt');
      
      const parsedEntries = json.data || [];
      setParsed(parsedEntries);
      
      if (parsedEntries.length === 0) {
        setError('No study plan entries detected. Try adding specific dates and tasks.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while parsing the study plan.');
      toast.error(err.message || 'Failed to parse prompt with AI');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-popover flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center">
              <Plus className="w-4 h-4 text-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Add from Prompt</h2>
              <p className="text-[11px] text-muted">Generate a structured study plan from natural language goals using AI</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input */}
        <div className="px-6 py-4 flex-1 overflow-y-auto">
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
            <button
              onClick={handleParse}
              disabled={loading || !text.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <div className="w-3 h-3 border-2 border-background border-t-transparent rounded-full animate-spin" />
                  Generating Plan...
                </>
              ) : (
                'Parse with AI'
              )}
            </button>
            {error && (
              <span className="text-xs text-red-500 font-medium">{error}</span>
            )}
          </div>

          {/* Live Preview */}
          {parsed.length > 0 && (
            <div className="mt-6 border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-xs font-bold text-foreground">Preview — {parsed.reduce((s, e) => s + e.tasks.length, 0)} tasks across {parsed.length} days</span>
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

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <span className="text-[11px] text-muted">
            Format: Any natural language study goals
          </span>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-surface border border-border text-foreground text-xs font-medium hover:bg-surface-hover transition-colors">
              Cancel
            </button>
            <button
              onClick={() => {
                if (parsed.length > 0) {
                  onApply(parsed);
                  setText('');
                  setParsed([]);
                  onClose();
                }
              }}
              disabled={parsed.length === 0 || loading}
              className="px-4 py-2 rounded-lg bg-foreground text-background text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Apply {parsed.length > 0 ? `(${parsed.reduce((s, e) => s + e.tasks.length, 0)} tasks)` : ''}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
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

  if (!isOpen) return null;

  const shareUrl = planId ? `${typeof window !== 'undefined' ? window.location.origin : ''}/planner/shared/${planId}` : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = () => {
    if (!email.trim() || !email.includes('@')) {
      toast.error('Enter a valid email address');
      return;
    }
    onAddCollaborator(email.trim(), role);
    setEmail('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-popover"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center">
              <Share2 className="w-4 h-4 text-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Share Plan</h2>
              <p className="text-[11px] text-muted">Collaborate or share a read-only link</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
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
                  {isPublic ? <Globe className="w-4 h-4 text-emerald-500" /> : <Lock className="w-4 h-4 text-muted" />}
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
                  className={`relative w-11 h-6 rounded-full transition-colors ${isPublic ? 'bg-emerald-500' : 'bg-surface-hover border border-border-strong'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${isPublic ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Copy link */}
              {isPublic && (
                <div className="flex gap-2">
                  <div className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 flex items-center gap-2 overflow-hidden">
                    <Link2 className="w-3.5 h-3.5 text-muted flex-shrink-0" />
                    <span className="text-xs text-muted truncate font-mono">{shareUrl}</span>
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
                    className="bg-surface border border-border rounded-lg px-2 py-2 text-xs text-foreground outline-none"
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
                          <div className="w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center text-[10px] font-bold text-foreground uppercase">
                            {c.user_email[0]}
                          </div>
                          <span className="text-xs text-foreground">{c.user_email}</span>
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            c.role === 'editor' ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400' : 'bg-surface-hover text-muted'
                          }`}>
                            {c.role}
                          </span>
                        </div>
                        <button
                          onClick={() => onRemoveCollaborator(c.id)}
                          className="text-muted hover:text-red-500 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
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
  onUpdateTaskCategory: (taskId: string, category: any) => void;
  onToggleTaskRecurring: (taskId: string) => void;
  onUpdateTaskStatus: (taskId: string, status: 'todo' | 'in-progress' | 'done') => void;
}) {
  const dateObj = new Date(date + 'T00:00:00');
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const dayNum = dateObj.getDate();
  const monthName = dateObj.toLocaleDateString('en-US', { month: 'long' });
  const isToday = date === todayISO();
  const done = tasks.filter(t => t.done).length;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-popover flex flex-col max-h-[85vh]"
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
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-muted hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress */}
        {tasks.length > 0 && (
          <div className="px-6 pt-3">
            <div className="h-1.5 bg-surface rounded-full overflow-hidden">
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
  const [mounted, setMounted] = useState(false);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = useMemo(() => createClient(), []);

  const today = todayISO();
  const calendarDays = useMemo(() => getCalendarDays(month, year), [month, year]);

  // ── Init ──
  useEffect(() => {
    const key = storageKey(month, year);
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPlanData(parsed.data || {});
        setPlanMeta(parsed.meta || { title: 'Study Plan', month, year, is_public: false });
      } catch {
        setPlanData({});
      }
    } else {
      setPlanData({});
      setPlanMeta({ title: 'Study Plan', month, year, is_public: false });
    }
    setMounted(true);
  }, [month, year]);

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ? { id: data.user.id, email: data.user.email ?? undefined } : null);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email ?? undefined } : null);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  // ── Cloud pull on login ──
  useEffect(() => {
    if (!user || !mounted) return;
    pullFromCloud();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, mounted, month, year]);

  // ── Save to localStorage ──
  useEffect(() => {
    if (mounted) {
      const key = storageKey(month, year);
      localStorage.setItem(key, JSON.stringify({ data: planData, meta: planMeta }));
    }
  }, [planData, planMeta, mounted, month, year]);

  // ── Cloud push (debounced) ──
  const pushToCloud = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('planner_plans')
        .select('id')
        .eq('owner_id', user.id)
        .eq('month', month)
        .eq('year', year)
        .single();

      if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;

      if (existing) {
        const { error } = await supabase
          .from('planner_plans')
          .update({
            data: planData,
            title: planMeta.title,
            is_public: planMeta.is_public,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (error) throw error;
        setPlanMeta(prev => ({ ...prev, id: existing.id }));
      } else {
        const { data: newPlan, error } = await supabase
          .from('planner_plans')
          .insert({
            owner_id: user.id,
            owner_email: user.email,
            title: planMeta.title,
            month,
            year,
            data: planData,
            is_public: planMeta.is_public,
          })
          .select('id')
          .single();
        if (error) throw error;
        if (newPlan) setPlanMeta(prev => ({ ...prev, id: newPlan.id }));
      }
      setLastSynced(new Date());
    } catch (e) {
      console.error('Sync error:', e);
    } finally {
      setSyncing(false);
    }
  }, [user, supabase, planData, planMeta, month, year]);

  const pullFromCloud = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase
        .from('planner_plans')
        .select('id, data, title, is_public, updated_at')
        .eq('owner_id', user.id)
        .eq('month', month)
        .eq('year', year)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setPlanData((data.data as PlanData) || {});
        setPlanMeta({ id: data.id, title: data.title || 'Study Plan', month, year, is_public: data.is_public });
        setLastSynced(new Date(data.updated_at));
        localStorage.setItem(storageKey(month, year), JSON.stringify({ data: data.data, meta: { id: data.id, title: data.title, month, year, is_public: data.is_public } }));

        // Load collaborators
        const { data: collabs } = await supabase
          .from('planner_collaborators')
          .select('*')
          .eq('plan_id', data.id);
        if (collabs) setCollaborators(collabs as Collaborator[]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  }, [user, supabase, month, year]);

  useEffect(() => {
    if (!user || !mounted) return;
    const timer = setTimeout(() => pushToCloud(), 2000);
    return () => clearTimeout(timer);
  }, [planData, planMeta, user, mounted, pushToCloud]);

  // ── Task operations ──
  const addTask = (date: string, text: string = '', category: string = 'General') => {
    setPlanData(prev => ({
      ...prev,
      [date]: [...(prev[date] || []), { id: generateId(), text, done: false, subtasks: [], category: category as any, status: 'todo' }],
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
    setPlanData(prev => ({
      ...prev,
      [date]: (prev[date] || []).filter(t => t.id !== taskId),
    }));
  };

  const updateTask = (date: string, taskId: string, text: string) => {
    setPlanData(prev => ({
      ...prev,
      [date]: (prev[date] || []).map(t => t.id === taskId ? { ...t, text } : t),
    }));
  };

  const updateTaskCategory = (date: string, taskId: string, category: 'Revision' | 'Exam Prep' | 'Assignment' | 'Project' | 'General') => {
    setPlanData(prev => ({
      ...prev,
      [date]: (prev[date] || []).map(t => t.id === taskId ? { ...t, category } : t),
    }));
  };

  const updateTaskStatus = (date: string, taskId: string, status: 'todo' | 'in-progress' | 'done') => {
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
      let taskToPropagate: Task | null = null;
      const updatedDateTasks = (prev[date] || []).map(t => {
        if (t.id === taskId) {
          const nextRecurring = !t.isRecurring;
          if (nextRecurring) {
            taskToPropagate = { ...t, isRecurring: true };
          }
          return { ...t, isRecurring: nextRecurring };
        }
        return t;
      });

      let nextData = { ...prev, [date]: updatedDateTasks };

      if (taskToPropagate) {
        const startDate = new Date(date + 'T00:00:00');
        const activeMonth = startDate.getMonth();
        const activeYear = startDate.getFullYear();

        const tempDate = new Date(startDate);
        tempDate.setDate(tempDate.getDate() + 7);

        while (tempDate.getMonth() === activeMonth && tempDate.getFullYear() === activeYear) {
          const isoString = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}-${String(tempDate.getDate()).padStart(2, '0')}`;
          const existing = nextData[isoString] || [];
          if (!existing.some(t => t.text === (taskToPropagate as any).text)) {
            nextData[isoString] = [
              ...existing,
              {
                ...(taskToPropagate as any),
                id: generateId(),
                isRecurring: true,
                done: false,
                status: 'todo',
                subtasks: []
              }
            ];
          }
          tempDate.setDate(tempDate.getDate() + 7);
        }
        toast.success('Task recurring rule propagated through this month');
      }

      return nextData;
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
    toast.success(`Added ${entries.reduce((s, e) => s + e.tasks.length, 0)} tasks across ${entries.length} days`);
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
    toast.success(newVal ? 'Plan is now public' : 'Plan is now private');
  };

  const addCollaborator = async (email: string, role: 'editor' | 'viewer') => {
    if (!planMeta.id) {
      toast.error('Save your plan to the cloud first');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('planner_collaborators')
        .insert({ plan_id: planMeta.id, user_email: email, role })
        .select()
        .single();
      if (error) throw error;
      if (data) setCollaborators(prev => [...prev, data as Collaborator]);
      toast.success(`Invited ${email} as ${role}`);
    } catch (e: any) {
      if (e?.code === '23505') toast.error('Already invited');
      else toast.error('Failed to invite');
      console.error(e);
    }
  };

  const removeCollaborator = async (id: string) => {
    try {
      await supabase.from('planner_collaborators').delete().eq('id', id);
      setCollaborators(prev => prev.filter(c => c.id !== id));
      toast.success('Collaborator removed');
    } catch (e) {
      toast.error('Failed to remove');
      console.error(e);
    }
  };

  // ── Export/Import ──
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ meta: planMeta, data: planData }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-plan-${MONTH_NAMES[month - 1].toLowerCase()}-${year}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.data) {
          setPlanData(parsed.data);
          if (parsed.meta) setPlanMeta(parsed.meta);
          toast.success('Plan imported');
        } else {
          // Try old format
          setPlanData(parsed);
          toast.success('Plan imported (legacy format)');
        }
      } catch {
        toast.error('Invalid file format');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const clearAll = () => {
    if (confirm(`Clear all tasks for ${MONTH_NAMES[month - 1]} ${year}? This cannot be undone.`)) {
      setPlanData({});
    }
  };

  // ── Stats ──
  const totalTasks = Object.values(planData).reduce((s, t) => s + (t?.length || 0), 0);
  const doneTasks = Object.values(planData).reduce((s, t) => s + (t || []).filter(x => x.done).length, 0);
  const progressPct = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

  if (!mounted) return null;

  return (
    <div className="flex-1 w-full px-4 sm:px-6 py-6 max-w-[1400px] mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 mb-6 pb-5 border-b border-border">
        {/* Title row */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            {editingTitle ? (
              <input
                autoFocus
                value={planMeta.title}
                onChange={(e) => setPlanMeta(prev => ({ ...prev, title: e.target.value }))}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(false)}
                className="text-2xl font-bold tracking-tight text-foreground bg-transparent border-b-2 border-foreground outline-none"
              />
            ) : (
              <h1
                className="text-2xl font-bold tracking-tight text-foreground cursor-pointer hover:opacity-70 transition-opacity"
                onClick={() => setEditingTitle(true)}
                title="Click to rename"
              >
                {planMeta.title}
              </h1>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Cloud sync */}
            {user ? (
              <div className="flex items-center gap-1.5 text-[11px] text-muted">
                {syncing ? (
                  <>
                    <div className="w-3 h-3 border border-muted border-t-foreground rounded-full animate-spin" />
                    <span>Syncing…</span>
                  </>
                ) : lastSynced ? (
                  <>
                    <Cloud className="w-3.5 h-3.5 text-emerald-500" />
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
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-[11px] text-muted hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 hover:bg-surface transition-colors"
              >
                <CloudOff className="w-3.5 h-3.5" />
                Sign in to sync
                <LogIn className="w-3 h-3" />
              </Link>
            )}

            {/* Prompt button */}
            <button
              onClick={() => setPromptOpen(true)}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground border border-border rounded-lg px-2.5 py-1.5 hover:bg-surface transition-colors"
            >
              Add from Prompt
            </button>

            {/* Share */}
            <button
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 hover:bg-surface transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share
            </button>

            {/* Export */}
            <button onClick={exportData} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 hover:bg-surface transition-colors">
              <Download className="w-3.5 h-3.5" />
              Export
            </button>

            {/* Import */}
            <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted hover:text-foreground border border-border rounded-lg px-2.5 py-1.5 hover:bg-surface transition-colors">
              <Upload className="w-3.5 h-3.5" />
              Import
            </button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={importData} />

            {/* Clear */}
            <button onClick={clearAll} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted hover:text-red-500 border border-border rounded-lg px-2.5 py-1.5 hover:bg-surface hover:border-red-200 dark:hover:border-red-900 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Month nav + progress */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={goPrevMonth}
              className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 min-w-[180px] text-center">
              <span className="text-lg font-bold text-foreground">{MONTH_NAMES[month - 1]}</span>
              <span className="text-lg font-light text-muted ml-2">{year}</span>
            </div>
            <button
              onClick={goNextMonth}
              className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={goToday}
              className="ml-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-muted hover:text-foreground bg-surface border border-border hover:bg-surface-hover transition-colors"
            >
              Today
            </button>
            
            {/* View Toggles */}
            <div className="flex items-center bg-surface border border-border rounded-lg p-0.5 ml-2 shrink-0">
              <button
                onClick={() => setPlannerView('calendar')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  plannerView === 'calendar'
                    ? 'bg-foreground text-background shadow-xs'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Calendar</span>
              </button>
              <button
                onClick={() => setPlannerView('list')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  plannerView === 'list'
                    ? 'bg-foreground text-background shadow-xs'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                onClick={() => setPlannerView('kanban')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  plannerView === 'kanban'
                    ? 'bg-foreground text-background shadow-xs'
                    : 'text-muted hover:text-foreground'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex-1 sm:w-48 h-2 bg-surface rounded-full overflow-hidden border border-border">
              <div
                className="h-full bg-foreground rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-muted whitespace-nowrap">
              {doneTasks}/{totalTasks} tasks
            </span>
          </div>
        </div>
      </div>

      {/* ── Calendar View ── */}
      {plannerView === 'calendar' && (
        <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border shadow-card animate-fade-in">
          {/* Day headers */}
          {DAY_LABELS.map((d) => (
            <div key={d} className="bg-surface py-2.5 text-center">
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
                className={`bg-background min-h-[100px] sm:min-h-[120px] p-1.5 sm:p-2 flex flex-col cursor-pointer transition-all hover:bg-surface/50 group/cell relative ${
                  !isCurrentMonth ? 'opacity-40' : ''
                }`}
              >
                {/* Date number */}
                <div className="flex items-center justify-between mb-1">
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
                              toast.success('Task added');
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
                            toast.success('Task added');
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
          <div className="bg-surface/40 border border-border rounded-xl p-4 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400" />
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
          <div className="bg-surface/40 border border-border rounded-xl p-4 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
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
          <div className="bg-surface/40 border border-border rounded-xl p-4 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
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
