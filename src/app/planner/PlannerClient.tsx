'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Check, Trash2, Download, Upload, Cloud, CloudOff, LogIn, Timer } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { logActivity } from '@/components/ActivityHeatmap';

type Todo = {
  id: string;
  text: string;
  done: boolean;
  focusSessions?: number;
  focusMinutes?: number;
};

type WeekData = Record<string, Todo[]>;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const STORAGE_KEY = 'utility_planner_week';

function generateId() {
  return Math.random().toString(36).slice(2, 11);
}

export default function PlannerClient() {
  const [weekData, setWeekData] = useState<WeekData>({});
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = useRef(createClient());

  // Init: Load from localStorage, then try cloud if signed in
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const init: WeekData = {};
    DAYS.forEach((d) => (init[d] = []));
    if (saved) {
      try {
        setWeekData(JSON.parse(saved));
      } catch {
        setWeekData(init);
      }
    } else {
      setWeekData(init);
    }
    setMounted(true);
  }, []);

  // Auth listener
  useEffect(() => {
    supabase.current.auth.getUser().then(({ data }) => {
      setUser(data.user ? { id: data.user.id, email: data.user.email } : null);
    });
    const { data: listener } = supabase.current.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Cloud sync: pull on user login
  useEffect(() => {
    if (!user || !mounted) return;
    pullFromCloud();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, mounted]);

  // Auto-save to localStorage whenever weekData changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(weekData));
    }
  }, [weekData, mounted]);

  const pushToCloud = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const { error } = await supabase.current
        .from('planner_data')
        .upsert(
          { user_id: user.id, data: weekData, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
      if (error) throw error;
      setLastSynced(new Date());
    } catch (e) {
      setSyncError('Sync failed. Your data is still saved locally.');
      console.error(e);
    } finally {
      setSyncing(false);
    }
  }, [user, weekData]);

  const pullFromCloud = useCallback(async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.current
        .from('planner_data')
        .select('data, updated_at')
        .eq('user_id', user.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      if (data?.data) {
        setWeekData(data.data as WeekData);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.data));
        setLastSynced(new Date(data.updated_at));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSyncing(false);
    }
  }, [user]);

  // Debounced cloud push
  useEffect(() => {
    if (!user || !mounted) return;
    const timer = setTimeout(() => pushToCloud(), 2000);
    return () => clearTimeout(timer);
  }, [weekData, user, mounted, pushToCloud]);

  const addTodo = (day: string) => {
    setWeekData((prev) => ({
      ...prev,
      [day]: [...(prev[day] ?? []), { id: generateId(), text: '', done: false }],
    }));
  };

  const updateTodoText = (day: string, id: string, text: string) => {
    setWeekData((prev) => ({
      ...prev,
      [day]: prev[day].map((t) => (t.id === id ? { ...t, text } : t)),
    }));
  };

  const toggleTodo = (day: string, id: string) => {
    setWeekData((prev) => ({
      ...prev,
      [day]: prev[day].map((t) => {
        if (t.id === id) {
          const nextState = !t.done;
          if (nextState) logActivity('planner_task_completed', 1);
          return { ...t, done: nextState };
        }
        return t;
      }),
    }));
  };

  const deleteTodo = (day: string, id: string) => {
    setWeekData((prev) => ({
      ...prev,
      [day]: prev[day].filter((t) => t.id !== id),
    }));
  };

  const clearAll = () => {
    if (confirm('Clear the entire week? This cannot be undone.')) {
      const init: WeekData = {};
      DAYS.forEach((d) => (init[d] = []));
      setWeekData(init);
    }
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(weekData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `utility-planner-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as WeekData;
        setWeekData(parsed);
      } catch {
        alert('Invalid file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const totalTasks = Object.values(weekData).reduce((s, t) => s + t.length, 0);
  const doneTasks = Object.values(weekData).reduce((s, t) => s + t.filter((x) => x.done).length, 0);

  if (!mounted) return null;

  return (
    <div className="flex-1 w-full px-4 sm:px-6 py-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 pb-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Weekly Planner</h1>
          <p className="text-muted text-sm mt-1">
            {totalTasks === 0
              ? 'Start by adding tasks to any day below.'
              : `${doneTasks} of ${totalTasks} tasks complete`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Cloud sync status */}
          {user ? (
            <div className="flex items-center gap-2 text-xs text-muted">
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
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground border border-border rounded-md px-2.5 py-1.5 hover:bg-surface transition-colors"
            >
              <CloudOff className="w-3.5 h-3.5" />
              <span>Sign in to sync</span>
              <LogIn className="w-3 h-3" />
            </Link>
          )}

          {syncError && (
            <span className="text-xs text-red-500">{syncError}</span>
          )}

          {/* Export */}
          <button
            onClick={exportData}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground border border-border rounded-md px-2.5 py-1.5 hover:bg-surface transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>

          {/* Import */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground border border-border rounded-md px-2.5 py-1.5 hover:bg-surface transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            Import
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={importData} />

          {/* Timer */}
          <Link
            href="/timer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground bg-surface hover:bg-surface-hover border border-border rounded-md px-3 py-1.5 transition-all shadow-sm"
          >
            <Timer className="w-3.5 h-3.5" />
            Focus Timer
          </Link>

          {/* Clear */}
          <button
            onClick={clearAll}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-red-500 border border-border rounded-md px-2.5 py-1.5 hover:bg-surface hover:border-red-200 dark:hover:border-red-900 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 items-start">
        {DAYS.map((day) => {
          const todos = weekData[day] ?? [];
          const done = todos.filter((t) => t.done).length;
          const total = todos.length;

          return (
            <div
              key={day}
              className="flex flex-col bg-card border border-border rounded-xl overflow-hidden min-h-[200px] lg:min-h-[60vh]"
            >
              {/* Column Header */}
              <div className="px-3 py-2.5 border-b border-border flex justify-between items-center bg-surface">
                <div>
                  <span className="font-semibold text-sm text-foreground">{day}</span>
                  {total > 0 && (
                    <span className="ml-2 text-[10px] text-muted font-medium">
                      {done}/{total}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => addTodo(day)}
                  className="w-5 h-5 rounded flex items-center justify-center hover:bg-surface-hover transition-colors text-muted hover:text-foreground"
                  title={`Add task to ${day}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Progress bar */}
              {total > 0 && (
                <div className="h-0.5 bg-surface">
                  <div
                    className="h-full bg-foreground transition-all duration-500"
                    style={{ width: `${(done / total) * 100}%` }}
                  />
                </div>
              )}

              {/* Tasks */}
              <div className="flex flex-col gap-1.5 p-2 flex-1">
                <AnimatePresence>
                  {todos.map((todo) => (
                    <motion.div
                      key={todo.id}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.12 }}
                      className={`flex flex-col gap-1 group bg-background border rounded-lg p-2.5 transition-all ${
                        todo.done ? 'border-border opacity-60' : 'border-border shadow-card'
                      }`}
                    >
                      <div className="flex items-start gap-2 w-full">
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleTodo(day, todo.id)}
                          className={`flex-shrink-0 w-4 h-4 mt-0.5 rounded-sm border flex items-center justify-center transition-colors ${
                            todo.done
                              ? 'bg-foreground border-foreground text-background'
                              : 'bg-card border-border hover:border-foreground'
                          }`}
                        >
                          {todo.done && <Check className="w-2.5 h-2.5" />}
                        </button>

                        {/* Text */}
                        <textarea
                          value={todo.text}
                          onChange={(e) => updateTodoText(day, todo.id, e.target.value)}
                          placeholder="Task…"
                          rows={1}
                          className={`bg-transparent outline-none resize-none overflow-hidden text-sm w-full pt-0 ${
                            todo.done ? 'line-through text-muted' : 'text-foreground'
                          }`}
                          onInput={(e) => {
                            const t = e.target as HTMLTextAreaElement;
                            t.style.height = 'auto';
                            t.style.height = t.scrollHeight + 'px';
                          }}
                        />

                        {/* Focus Timer Button */}
                        {!todo.done && (
                          <Link
                            href={`/timer?taskId=${todo.id}&taskText=${encodeURIComponent(todo.text)}&day=${day}`}
                            className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-muted hover:text-foreground transition-all ml-1 mt-0.5"
                            title="Start Focus Session"
                          >
                            <Timer className="w-3.5 h-3.5 text-muted hover:text-primary animate-pulse" />
                          </Link>
                        )}

                        {/* Delete */}
                        <button
                          onClick={() => deleteTodo(day, todo.id)}
                          className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-muted hover:text-foreground transition-all mt-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Focus Sessions Indicator */}
                      {todo.focusSessions && todo.focusSessions > 0 ? (
                        <div className="flex items-center gap-1 text-[10px] font-bold text-muted uppercase pl-6 select-none">
                          <span className="flex items-center gap-0.5 text-foreground">🔥 {todo.focusSessions} {todo.focusSessions === 1 ? 'Session' : 'Sessions'}</span>
                          <span>•</span>
                          <span>{todo.focusMinutes}m</span>
                        </div>
                      ) : null}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Empty state */}
                {todos.length === 0 && (
                  <div
                    className="flex-1 flex flex-col items-center justify-center border border-dashed border-border rounded-lg p-4 text-muted cursor-pointer hover:border-foreground/30 hover:text-foreground hover:bg-surface transition-all group min-h-[80px]"
                    onClick={() => addTodo(day)}
                  >
                    <Plus className="w-4 h-4 mb-1 opacity-40 group-hover:opacity-80" />
                    <span className="text-xs">Add task</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
