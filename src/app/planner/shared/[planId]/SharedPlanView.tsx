'use client';

import { useMemo } from 'react';
import { Check, User, MoreHorizontal, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { PageShell } from '@/components/ui';

type SubTask = { id: string; text: string; done: boolean };
type Task = { id: string; text: string; done: boolean; subtasks: SubTask[] };
type PlanData = Record<string, Task[]>;

interface Plan {
  id: string;
  title: string;
  owner_email: string;
  month: number;
  year: number;
  data: PlanData;
  is_public: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getCalendarDays(month: number, year: number) {
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const daysInMonth = lastDay.getDate();

  let startDow = firstDay.getDay() - 1;
  if (startDow < 0) startDow = 6;

  const days: { date: string; dayNum: number; isCurrentMonth: boolean }[] = [];

  const prevMonthLastDay = new Date(year, month - 1, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const d = prevMonthLastDay - i;
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    days.push({ date: `${py}-${String(pm).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dayNum: d, isCurrentMonth: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dayNum: d, isCurrentMonth: true });
  }

  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    const nm = month === 12 ? 1 : month + 1;
    const ny = month === 12 ? year + 1 : year;
    days.push({ date: `${ny}-${String(nm).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dayNum: d, isCurrentMonth: false });
  }

  return days;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function SharedPlanView({ plan }: { plan: Plan }) {
  const planData = (plan.data || {}) as PlanData;
  const calendarDays = useMemo(() => getCalendarDays(plan.month, plan.year), [plan.month, plan.year]);
  const today = todayISO();

  const totalTasks = Object.values(planData).reduce((s, t) => s + (t?.length || 0), 0);
  const doneTasks = Object.values(planData).reduce((s, t) => s + (t || []).filter(x => x.done).length, 0);
  const progressPct = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

  return (
    <PageShell className="min-w-0">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6 pb-5 border-b border-border">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <Link href="/planner" className="inline-flex items-center gap-1.5 text-[11px] text-muted hover:text-foreground mb-2 transition-colors">
              <ArrowLeft className="w-3 h-3" /> Back to my planner
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{plan.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <User className="w-3.5 h-3.5" />
                <span>Shared by {plan.owner_email?.split('@')[0] || 'Anonymous'}</span>
              </div>
              <span className="text-xs text-muted">·</span>
              <span className="text-xs text-muted">{MONTH_NAMES[plan.month - 1]} {plan.year}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-lg bg-foreground/5 border border-foreground/15 text-[11px] font-bold text-foreground uppercase">
              Read-only
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-3 bg-surface overflow-hidden border border-border rounded-full p-0.5">
            <div className="h-full bg-foreground transition-all duration-500 rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-xs font-semibold text-muted whitespace-nowrap">{doneTasks}/{totalTasks} tasks</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="hidden md:grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden border border-border shadow-card">
        {DAY_LABELS.map((d) => (
          <div key={d} className="bg-surface py-2.5 text-center">
            <span className="text-[11px] font-bold text-muted uppercase tracking-wider">{d}</span>
          </div>
        ))}

        {calendarDays.map(({ date, dayNum, isCurrentMonth }) => {
          const tasks = planData[date] || [];
          const isToday = date === today;
          const done = tasks.filter(t => t.done).length;

          return (
            <div
              key={date}
              className={`bg-background min-h-[100px] sm:min-h-[120px] p-1.5 sm:p-2 flex flex-col ${!isCurrentMonth ? 'opacity-40' : ''}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold leading-none w-6 h-6 rounded-lg flex items-center justify-center ${
                  isToday ? 'bg-foreground text-background' : 'text-foreground'
                }`}>
                  {dayNum}
                </span>
                {tasks.length > 0 && (
                  <span className="text-[9px] font-bold text-muted">{done}/{tasks.length}</span>
                )}
              </div>

              <div className="flex flex-col gap-0.5 flex-1 overflow-hidden">
                {tasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="flex items-center gap-1.5">
                    <div className={`flex-shrink-0 w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${
                      task.done ? 'bg-foreground border-foreground text-background' : 'border-border-strong'
                    }`}>
                      {task.done && <Check className="w-2 h-2" />}
                    </div>
                    <span className={`text-[11px] leading-tight truncate ${task.done ? 'line-through text-muted' : 'text-foreground'}`}>
                      {task.text}
                    </span>
                  </div>
                ))}
                {tasks.length > 3 && (
                  <span className="text-[10px] text-muted font-medium flex items-center gap-0.5 mt-0.5">
                    <MoreHorizontal className="w-3 h-3" /> +{tasks.length - 3} more
                  </span>
                )}
              </div>

              {tasks.length > 0 && (
                <div className="mt-auto pt-1">
                  <div className="h-1.5 bg-surface border border-border overflow-hidden rounded-full p-0.5">
                    <div className="h-full bg-foreground transition-all duration-300 rounded-full" style={{ width: `${(done / tasks.length) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="md:hidden space-y-3">
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
              <div key={date} className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center shrink-0 ${
                      isToday
                        ? "bg-foreground text-background"
                        : "bg-surface border border-border text-foreground"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase leading-none opacity-85">{dayName}</span>
                    <span className="text-base font-black leading-none">{dayNum}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">
                      {isToday ? "Today" : dateObj.toLocaleDateString("en-US", { weekday: "long" })}
                    </p>
                    <p className="text-xs text-muted">
                      {tasks.length === 0 ? "No tasks" : `${done}/${tasks.length} done`}
                    </p>
                  </div>
                </div>
                {tasks.length > 0 && (
                  <div className="space-y-1.5">
                    {tasks.map((task) => (
                      <div key={task.id} className="flex items-center gap-2 text-sm">
                        <span
                          className={`w-4 h-4 rounded border shrink-0 ${
                            task.done ? "bg-foreground border-foreground" : "border-border-strong"
                          }`}
                        />
                        <span className={`truncate ${task.done ? "line-through text-muted" : "text-foreground"}`}>
                          {task.text || "Untitled"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>
    </PageShell>
  );
}
