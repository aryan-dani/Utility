'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { auth } from '@/lib/firebase/auth';
import { Flame, Trophy, Calendar, Zap, Info } from 'lucide-react';
import { ACTIVITY_STORAGE_KEY, localDateKey } from '@/lib/activity';
import { homeOrVercelActivityCounts } from '@/lib/homeApi';

const STORAGE_KEY = ACTIVITY_STORAGE_KEY;
const WEEK_COUNT = 53;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function mondayOnOrBefore(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay(); // 0 Sun … 6 Sat
  const offset = day === 0 ? 6 : day - 1;
  return addDays(next, -offset);
}

type HeatCell = {
  date: Date;
  key: string;
  count: number;
  inRange: boolean;
  label: string;
};

export default function ActivityHeatmap() {
  const [activityMap, setActivityMap] = useState<Record<string, number>>(() => {
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) return JSON.parse(local) as Record<string, number>;
    } catch {}
    return {};
  });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ key: string; label: string; count: number } | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const fetchActivity = async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        const idToken = await user.getIdToken();
        const cloudMap = await homeOrVercelActivityCounts(idToken);

        setActivityMap((prev) => {
          const merged = { ...prev };
          Object.keys(cloudMap).forEach((date) => {
            const n = Number(cloudMap[date]) || 0;
            if (n > 0) merged[date] = Math.max(merged[date] || 0, n);
          });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          return merged;
        });
      } catch (err) {
        console.error('API fetchActivity error:', err);
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await fetchActivity();
      if (!cancelled) setLoading(false);
    })();

    const handleLocalLog = () => {
      try {
        const local = localStorage.getItem(STORAGE_KEY);
        if (local) {
          setActivityMap(JSON.parse(local) as Record<string, number>);
        }
      } catch {}
    };

    window.addEventListener('activity_logged', handleLocalLog);
    return () => {
      cancelled = true;
      window.removeEventListener('activity_logged', handleLocalLog);
    };
  }, []);

  const todayKey = useMemo(() => localDateKey(), []);

  const weeks = useMemo(() => {
    const today = startOfDay(new Date());
    const thisMonday = mondayOnOrBefore(today);
    const gridStart = addDays(thisMonday, -(WEEK_COUNT - 1) * 7);
    const cols: HeatCell[][] = [];
    let cursor = new Date(gridStart);

    for (let w = 0; w < WEEK_COUNT; w++) {
      const week: HeatCell[] = [];
      for (let d = 0; d < 7; d++) {
        const key = localDateKey(cursor);
        const inRange = cursor <= today;
        week.push({
          date: new Date(cursor),
          key,
          count: inRange ? activityMap[key] || 0 : 0,
          inRange,
          label: cursor.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
        });
        cursor = addDays(cursor, 1);
      }
      cols.push(week);
    }
    return cols;
  }, [activityMap]);

  const daysInRange = weeks.flat().filter((d) => d.inRange);
  const totalContributions = Object.values(activityMap).reduce((a, b) => a + b, 0);

  let currentStreak = 0;
  let tempDate = startOfDay(new Date());
  while (true) {
    const dStr = localDateKey(tempDate);
    if (activityMap[dStr] && activityMap[dStr] > 0) {
      currentStreak++;
      tempDate = addDays(tempDate, -1);
    } else {
      if (currentStreak === 0 && localDateKey(tempDate) === todayKey) {
        tempDate = addDays(tempDate, -1);
        const yStr = localDateKey(tempDate);
        if (activityMap[yStr] && activityMap[yStr] > 0) {
          currentStreak++;
          tempDate = addDays(tempDate, -1);
          continue;
        }
      }
      break;
    }
  }

  let bestStreak = 0;
  let tempStreak = 0;
  daysInRange.forEach((d) => {
    if (d.count > 0) {
      tempStreak++;
      if (tempStreak > bestStreak) bestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  });

  const getCellColor = (count: number, inRange: boolean) => {
    if (!inRange) return 'bg-transparent border-transparent pointer-events-none';
    // Empty cells need a hard edge in dark mode or the grid reads as a black void.
    if (count === 0) return 'bg-muted/15 border-border hover:border-border-strong';
    if (count <= 2) return 'bg-foreground/25 border-border';
    if (count <= 5) return 'bg-foreground/45 border-border';
    if (count <= 8) return 'bg-foreground/70 border-border';
    return 'bg-foreground border-foreground';
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const frame = requestAnimationFrame(() => {
      el.scrollLeft = el.scrollWidth;
    });
    return () => cancelAnimationFrame(frame);
  }, [loading, weeks.length]);

  const monthLabels = weeks.map((week, idx) => {
    const monthStart = week.find((d) => d.date.getDate() === 1);
    if (monthStart) {
      return monthStart.date.toLocaleDateString('en-US', { month: 'short' });
    }
    if (idx === 0) {
      return week[0].date.toLocaleDateString('en-US', { month: 'short' });
    }
    return '';
  });

  const active = selected ?? daysInRange.find((d) => d.key === todayKey) ?? null;

  if (!loading && totalContributions === 0) {
    const signedIn = Boolean(auth.currentUser);
    return (
      <div className="w-full min-w-0 bg-card border border-border p-4 sm:p-5 rounded-xl">
        <p className="text-sm font-medium text-foreground">
          {signedIn ? "No study logs yet" : "Sign in to track your streak"}
        </p>
        <p className="text-xs text-muted mt-1 max-w-xl">
          Daily study, flashcard reviews, and AI sessions show up here after the first log.
        </p>
        <a
          href={signedIn ? "/timer" : "/login"}
          className="inline-flex mt-3 text-xs font-medium underline underline-offset-4"
        >
          {signedIn ? "Start a focus session" : "Sign in"}
        </a>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 bg-card border border-border p-4 sm:p-5 rounded-xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4 pb-4 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Calendar className="w-4 h-4 text-muted shrink-0" />
            <h2 className="text-sm font-semibold text-foreground tracking-tight">
              Activity
            </h2>
          </div>
          <p className="text-xs text-muted">
            Study sessions, flashcards, Ask, and planner tasks.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-3 sm:gap-4 text-center">
          <div>
            <span className="text-[10px] text-muted font-medium uppercase tracking-wide flex items-center justify-center gap-1">
              <Zap className="w-3 h-3" /> Total
            </span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{totalContributions}</span>
          </div>
          <div>
            <span className="text-[10px] text-muted font-medium uppercase tracking-wide flex items-center justify-center gap-1">
              <Flame className="w-3 h-3" /> Streak
            </span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{currentStreak}d</span>
          </div>
          <div>
            <span className="text-[10px] text-muted font-medium uppercase tracking-wide flex items-center justify-center gap-1">
              <Trophy className="w-3 h-3" /> Best
            </span>
            <span className="text-sm font-semibold tabular-nums text-foreground">{bestStreak}d</span>
          </div>
          <div>
            <span className="text-[10px] text-muted font-medium uppercase tracking-wide flex items-center justify-center gap-1">
              <Info className="w-3 h-3" /> Avg
            </span>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {(totalContributions / Math.max(daysInRange.length, 1)).toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <div
          ref={scrollerRef}
          className="heatmap-scroll max-w-full pb-2"
          aria-label="Activity heatmap. Swipe sideways to see earlier weeks."
        >
          <div
            className="heatmap-grid"
            style={{
              gridTemplateColumns: `2.25rem repeat(${weeks.length}, minmax(0, 1fr))`,
            }}
          >
            <div className="sticky left-0 z-10 bg-card" />
            {weeks.map((_, colIdx) => (
              <div key={`month-${colIdx}`} className="relative h-4 min-w-0">
                {monthLabels[colIdx] ? (
                  <span className="absolute left-0 top-0 z-[1] whitespace-nowrap text-[11px] font-medium text-muted leading-none">
                    {monthLabels[colIdx]}
                  </span>
                ) : null}
              </div>
            ))}

            {WEEKDAYS.map((dayName, rowIdx) => (
              <Fragment key={dayName}>
                <span className="sticky left-0 z-10 flex items-center justify-end bg-card pr-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {dayName}
                </span>
                {weeks.map((week) => {
                  const day = week[rowIdx];
                  return (
                    <button
                      key={day.key}
                      type="button"
                      disabled={!day.inRange}
                      aria-label={`${day.count} activities on ${day.label}`}
                      onClick={() => {
                        if (!day.inRange) return;
                        setSelected({ key: day.key, label: day.label, count: day.count });
                      }}
                      className={`aspect-square w-full min-w-0 self-start rounded-sm border transition-colors ${getCellColor(
                        day.count,
                        day.inRange,
                      )} ${
                        selected?.key === day.key
                          ? 'z-[1] ring-1 ring-foreground ring-offset-1 ring-offset-card'
                          : ''
                      }`}
                    />
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-5 pt-4 border-t border-border">
        <p className="text-xs text-muted">
          {active ? (
            <>
              <span className="text-foreground font-medium">{active.label}</span>
              {' · '}
              {active.count} {active.count === 1 ? 'log' : 'logs'}
            </>
          ) : (
            <>Tap a cell for that day’s logs. Swipe the grid for earlier weeks.</>
          )}
        </p>

        <div className="flex items-center gap-2 text-xs text-muted select-none">
          <span>Less</span>
          <div className="flex gap-1.5">
            <div className="w-3.5 h-3.5 rounded-sm bg-muted/15 border border-border" />
            <div className="w-3.5 h-3.5 rounded-sm bg-foreground/25 border border-border" />
            <div className="w-3.5 h-3.5 rounded-sm bg-foreground/45 border border-border" />
            <div className="w-3.5 h-3.5 rounded-sm bg-foreground/70 border border-border" />
            <div className="w-3.5 h-3.5 rounded-sm bg-foreground border border-foreground" />
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
