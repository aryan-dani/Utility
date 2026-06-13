'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
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

  // 2. Log to Firestore via server API if logged in
  const user = auth.currentUser;
  if (!user) return;

  user.getIdToken()
    .then((idToken) => {
      fetch('/api/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ actionType, count })
      }).catch((err) => console.error("API logActivity network error:", err));
    })
    .catch((err) => console.error("API logActivity token error:", err));
}

export default function ActivityHeatmap() {
  const [activityMap, setActivityMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<{ date: string; count: number; top?: number; left?: number } | null>(null);
 
  const fetchActivity = async () => {
    // Load local storage first
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local) {
        setActivityMap(JSON.parse(local));
      }
    } catch {}
 
    // Try cloud fetch
    const user = auth.currentUser;
    if (user) {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/activity', {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const cloudMap: Record<string, number> = {};
        
        (data.logs || []).forEach((item: any) => {
          if (item.logged_date && item.count) {
            cloudMap[item.logged_date] = (cloudMap[item.logged_date] || 0) + Number(item.count);
          }
        });
 
        setActivityMap((prev) => {
          const merged = { ...prev };
          Object.keys(cloudMap).forEach((date) => {
            merged[date] = Math.max(merged[date] || 0, cloudMap[date]);
          });
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          return merged;
        });
      } catch (err) {
        console.error("API fetchActivity error:", err);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchActivity();

    let timeoutId: NodeJS.Timeout;
    const handleLocalLog = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        fetchActivity();
      }, 300);
    };

    window.addEventListener('activity_logged', handleLocalLog);
    return () => {
      window.removeEventListener('activity_logged', handleLocalLog);
      clearTimeout(timeoutId);
    };
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
    if (count === 0) return 'bg-surface border-foreground/15 hover:border-foreground';
    if (count <= 2) return 'bg-foreground/10 border-foreground/30 text-foreground';
    if (count <= 5) return 'bg-foreground/25 border-foreground/50 text-foreground';
    if (count <= 8) return 'bg-foreground/50 border-foreground/80 text-foreground';
    return 'bg-foreground border-foreground text-background';
  };

  return (
    <div className="w-full bg-card border-2 border-foreground p-6 sm:p-8 shadow-[4px_4px_0px_0px_rgb(var(--foreground))] my-12">
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-surface border-2 border-foreground p-4 shadow-[3px_3px_0px_0px_rgb(var(--foreground))] w-full lg:w-auto">
          <div className="flex flex-col items-center text-center px-3 border-r border-border">
            <span className="text-xs text-muted mb-1 flex items-center gap-1 font-medium">
              <Zap className="w-3.5 h-3.5 text-foreground" /> Total
            </span>
            <span className="text-lg font-bold text-foreground">{totalContributions}</span>
          </div>

          <div className="flex flex-col items-center text-center px-3 border-r-0 sm:border-r border-border">
            <span className="text-xs text-muted mb-1 flex items-center gap-1 font-medium">
              <Flame className="w-3.5 h-3.5 text-foreground" /> Streak
            </span>
            <span className="text-lg font-bold text-foreground">{currentStreak} days</span>
          </div>

          <div className="flex flex-col items-center text-center px-3 border-r border-border">
            <span className="text-xs text-muted mb-1 flex items-center gap-1 font-medium">
              <Trophy className="w-3.5 h-3.5 text-foreground" /> Best
            </span>
            <span className="text-lg font-bold text-foreground">{bestStreak} days</span>
          </div>

          <div className="flex flex-col items-center text-center px-3">
            <span className="text-xs text-muted mb-1 flex items-center gap-1 font-medium">
              <Info className="w-3.5 h-3.5 text-foreground" /> Daily Avg
            </span>
            <span className="text-lg font-bold text-foreground">
              {(totalContributions / 126).toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Grid container */}
      <div className="relative">
        <div className="relative overflow-x-auto pb-4 custom-scrollbar">
          <div className="min-w-[700px] flex gap-2 items-start justify-center">
            {/* Day labels (Mon, Wed, Fri) */}
            <div className="flex flex-col gap-2 pr-2 text-[10px] font-semibold text-muted uppercase tracking-wider py-1 select-none">
              <span className="h-4 flex items-center">Mon</span>
              <span className="h-4 flex items-center">Tue</span>
              <span className="h-4 flex items-center">Wed</span>
              <span className="h-4 flex items-center">Thu</span>
              <span className="h-4 flex items-center">Fri</span>
              <span className="h-4 flex items-center">Sat</span>
              <span className="h-4 flex items-center">Sun</span>
            </div>

            {/* 18 Columns of 7 days */}
            <div className="flex gap-1.5 flex-1 justify-between relative">
              {Array.from({ length: Math.ceil(days.length / 7) }).map((_, colIdx) => {
                const weekDays = days.slice(colIdx * 7, (colIdx + 1) * 7);
                return (
                  <div key={colIdx} className="flex flex-col gap-1.5">
                    {weekDays.map((day) => (
                      <div
                        key={day.date}
                        role="gridcell"
                        aria-label={`${day.count} activities on ${day.label}`}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const parentRect = e.currentTarget.parentElement?.parentElement?.parentElement?.getBoundingClientRect();
                          if (parentRect) {
                            const top = rect.top - parentRect.top - 34;
                            const left = rect.left - parentRect.left + (rect.width / 2);
                            setHoveredCell({
                              date: day.label,
                              count: day.count,
                              top,
                              left
                            });
                          }
                        }}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`w-4 h-4 rounded-none border transition-all cursor-pointer ${getCellColor(
                          day.count
                        )}`}
                      />
                    ))}
                  </div>
                );
              })}

              {/* Floating Tooltip positioned dynamically near hovered cell */}
              {hoveredCell && hoveredCell.top !== undefined && hoveredCell.left !== undefined && (
                <div 
                  style={{ 
                    top: `${hoveredCell.top}px`, 
                    left: `${hoveredCell.left}px`,
                    transform: 'translateX(-50%)'
                  }}
                  className="absolute z-30 pointer-events-none text-[10px] font-bold text-foreground bg-card border border-border px-2.5 py-1 rounded-lg shadow-popover whitespace-nowrap animate-fade-in"
                >
                  {hoveredCell.date} · <span className="text-primary font-black">{hoveredCell.count} logs</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Touch scroll indicator gradient for mobile */}
        <div className="absolute right-0 top-0 bottom-4 w-12 bg-gradient-to-l from-card to-transparent pointer-events-none md:hidden" />
      </div>

      {/* Footer Legend */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-border">
        <div className="h-6 flex items-center">
          <p className="text-xs text-muted italic">Hover over any cell to view daily activity logs.</p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 text-xs text-muted select-none">
          <span>Less</span>
          <div className="flex gap-1.5">
            <div className="w-3.5 h-3.5 rounded-none bg-surface border border-foreground/15" />
            <div className="w-3.5 h-3.5 rounded-none bg-foreground/10 border border-foreground/30" />
            <div className="w-3.5 h-3.5 rounded-none bg-foreground/25 border border-foreground/50" />
            <div className="w-3.5 h-3.5 rounded-none bg-foreground/50 border border-foreground/80" />
            <div className="w-3.5 h-3.5 rounded-none bg-foreground border border-foreground" />
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
