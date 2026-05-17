'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { Flame, Trophy, Calendar, Zap, Info } from 'lucide-react';

interface ActivityLog {
  logged_date: string; // YYYY-MM-DD
  count: number;
}

const STORAGE_KEY = 'utility_activity_logs';

export function logActivity(actionType: string, count = 1) {
  if (typeof window === 'undefined') return;

  const today = new Date().toISOString().split('T')[0];

  // 1. Log to localStorage for instant local feedback
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    const logs: Record<string, number> = existing ? JSON.parse(existing) : {};
    logs[today] = (logs[today] || 0) + count;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    // Dispatch event so ActivityHeatmap updates instantly
    window.dispatchEvent(new Event('activity_logged'));
  } catch (err) {
    console.error('Local activity log error:', err);
  }

  // 2. Log to Supabase if logged in
  const supabase = createClient();
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) return;
    // RPC or direct insert/rpc
    supabase
      .from('activity_logs')
      .select('count')
      .eq('user_id', user.id)
      .eq('action_type', actionType)
      .eq('logged_date', today)
      .single()
      .then(({ data }) => {
        if (data) {
          supabase
            .from('activity_logs')
            .update({ count: data.count + count })
            .eq('user_id', user.id)
            .eq('action_type', actionType)
            .eq('logged_date', today)
            .then();
        } else {
          supabase
            .from('activity_logs')
            .insert({
              user_id: user.id,
              action_type: actionType,
              count: count,
              logged_date: today,
            })
            .then();
        }
      });
  });
}

export default function ActivityHeatmap() {
  const [activityMap, setActivityMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<{ date: string; count: number } | null>(null);

  const fetchActivity = async () => {
    // Load local storage first
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) {
        setActivityMap(JSON.parse(local));
      }
    } catch {}

    // Try cloud fetch
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('activity_logs')
        .select('logged_date, count')
        .eq('user_id', user.id);

      if (data) {
        const cloudMap: Record<string, number> = {};
        data.forEach((item: ActivityLog) => {
          cloudMap[item.logged_date] = (cloudMap[item.logged_date] || 0) + item.count;
        });

        setActivityMap((prev) => {
          const merged = { ...prev };
          Object.keys(cloudMap).forEach((date) => {
            merged[date] = Math.max(merged[date] || 0, cloudMap[date]);
          });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          return merged;
        });
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchActivity();

    const handleLocalLog = () => {
      fetchActivity();
    };

    window.addEventListener('activity_logged', handleLocalLog);
    return () => window.removeEventListener('activity_logged', handleLocalLog);
  }, []);

  // Generate last 18 weeks of dates (18 weeks * 7 days = 126 days)
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - 125); // 126 days total

  const days: { date: string; count: number; label: string }[] = [];
  let curr = new Date(startDate);

  while (curr <= today) {
    const dateStr = curr.toISOString().split('T')[0];
    const count = activityMap[dateStr] || 0;
    days.push({
      date: dateStr,
      count,
      label: curr.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    });
    curr.setDate(curr.getDate() + 1);
  }

  // Calculate Stats
  const totalContributions = Object.values(activityMap).reduce((a, b) => a + b, 0);

  // Calculate Current Streak
  let currentStreak = 0;
  let tempDate = new Date(today);
  while (true) {
    const dStr = tempDate.toISOString().split('T')[0];
    if (activityMap[dStr] && activityMap[dStr] > 0) {
      currentStreak++;
      tempDate.setDate(tempDate.getDate() - 1);
    } else {
      // Check if today has 0 but yesterday had some
      if (currentStreak === 0 && tempDate.toDateString() === today.toDateString()) {
        tempDate.setDate(tempDate.getDate() - 1);
        const yStr = tempDate.toISOString().split('T')[0];
        if (activityMap[yStr] && activityMap[yStr] > 0) {
          currentStreak++;
          tempDate.setDate(tempDate.getDate() - 1);
          continue;
        }
      }
      break;
    }
  }

  // Calculate Best Streak
  let bestStreak = 0;
  let tempStreak = 0;
  days.forEach((d) => {
    if (d.count > 0) {
      tempStreak++;
      if (tempStreak > bestStreak) bestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }
  });

  // Helper for cell color based on count
  const getCellColor = (count: number) => {
    if (count === 0) return 'bg-surface border-border hover:border-muted';
    if (count <= 2) return 'bg-emerald-500/20 border-emerald-500/30 text-emerald-500';
    if (count <= 5) return 'bg-emerald-500/40 border-emerald-500/50 text-emerald-500';
    if (count <= 8) return 'bg-emerald-500/70 border-emerald-500/80 text-emerald-500';
    return 'bg-emerald-500 border-emerald-600 text-white shadow-xs';
  };

  return (
    <div className="w-full bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-card my-12">
      {/* Header & Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground tracking-tight">Academic Activity Heatmap</h2>
          </div>
          <p className="text-sm text-muted">
            Track your daily study consistency, flashcard reviews, AI prompts, and planner tasks completed.
          </p>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-surface border border-border rounded-xl p-4 shadow-xs">
          <div className="flex flex-col items-center text-center px-3 border-r border-border last:border-r-0">
            <span className="text-xs text-muted mb-1 flex items-center gap-1 font-medium">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Total
            </span>
            <span className="text-lg font-bold text-foreground">{totalContributions}</span>
          </div>

          <div className="flex flex-col items-center text-center px-3 border-r border-border last:border-r-0">
            <span className="text-xs text-muted mb-1 flex items-center gap-1 font-medium">
              <Flame className="w-3.5 h-3.5 text-orange-500" /> Streak
            </span>
            <span className="text-lg font-bold text-foreground">{currentStreak} days</span>
          </div>

          <div className="flex flex-col items-center text-center px-3 border-r border-border last:border-r-0">
            <span className="text-xs text-muted mb-1 flex items-center gap-1 font-medium">
              <Trophy className="w-3.5 h-3.5 text-yellow-500" /> Best
            </span>
            <span className="text-lg font-bold text-foreground">{bestStreak} days</span>
          </div>

          <div className="flex flex-col items-center text-center px-3">
            <span className="text-xs text-muted mb-1 flex items-center gap-1 font-medium">
              <Info className="w-3.5 h-3.5 text-blue-500" /> Daily Avg
            </span>
            <span className="text-lg font-bold text-foreground">
              {(totalContributions / 126).toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Grid container */}
      <div className="relative overflow-x-auto pb-4">
        <div className="min-w-[700px] flex gap-2 items-start justify-center">
          {/* Day labels (Mon, Wed, Fri) */}
          <div className="flex flex-col gap-2 pr-2 text-[10px] font-semibold text-muted uppercase tracking-wider py-1">
            <span className="h-4 flex items-center">Mon</span>
            <span className="h-4 flex items-center">Tue</span>
            <span className="h-4 flex items-center">Wed</span>
            <span className="h-4 flex items-center">Thu</span>
            <span className="h-4 flex items-center">Fri</span>
            <span className="h-4 flex items-center">Sat</span>
            <span className="h-4 flex items-center">Sun</span>
          </div>

          {/* 18 Columns of 7 days */}
          <div className="flex gap-1.5 flex-1 justify-between">
            {Array.from({ length: Math.ceil(days.length / 7) }).map((_, colIdx) => {
              const weekDays = days.slice(colIdx * 7, (colIdx + 1) * 7);
              return (
                <div key={colIdx} className="flex flex-col gap-1.5">
                  {weekDays.map((day) => (
                    <div
                      key={day.date}
                      onMouseEnter={() => setHoveredCell({ date: day.label, count: day.count })}
                      onMouseLeave={() => setHoveredCell(null)}
                      className={`w-4 h-4 rounded-md border transition-all cursor-pointer ${getCellColor(
                        day.count
                      )}`}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Legend & Tooltip */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-border">
        {/* Active Tooltip Display */}
        <div className="h-6 flex items-center">
          {hoveredCell ? (
            <p className="text-xs font-semibold text-foreground bg-surface border border-border px-3 py-1 rounded-md shadow-xs animate-fade-in">
              {hoveredCell.date} — <span className="text-primary font-bold">{hoveredCell.count} contributions</span>
            </p>
          ) : (
            <p className="text-xs text-muted italic">Hover over any cell to view daily activity.</p>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>Less</span>
          <div className="flex gap-1.5">
            <div className="w-3.5 h-3.5 rounded bg-surface border border-border" />
            <div className="w-3.5 h-3.5 rounded bg-emerald-500/20 border border-emerald-500/30" />
            <div className="w-3.5 h-3.5 rounded bg-emerald-500/40 border border-emerald-500/50" />
            <div className="w-3.5 h-3.5 rounded bg-emerald-500/70 border border-emerald-500/80" />
            <div className="w-3.5 h-3.5 rounded bg-emerald-500 border border-emerald-600" />
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
