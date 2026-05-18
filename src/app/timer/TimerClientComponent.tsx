'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Coffee, 
  Brain, 
  Settings2, 
  Volume2, 
  VolumeX,
  CheckCircle2,
  X,
  Calendar,
  Trophy,
  LogIn,
} from 'lucide-react';
import Link from 'next/link';
import { FadeIn, ScaleButton } from '@/components/Animations';
import { createClient } from '@/lib/supabase';

type TimerMode = 'work' | 'break' | 'longBreak';

type PomodoroSession = {
  id: string;
  duration_seconds: number;
  completed_at: string;
};

type TimerStats = {
  todaySeconds: number;
  weekSeconds: number;
  monthSeconds: number;
  weekSessions: number;
  monthSessions: number;
  averageSeconds: number;
  bestDayLabel: string;
  bestDaySeconds: number;
};

const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 180;

function sanitizeDuration(value: number | string) {
  const parsed = Math.floor(Number(value));

  if (!Number.isFinite(parsed)) return MIN_DURATION_MINUTES;

  return Math.min(MAX_DURATION_MINUTES, Math.max(MIN_DURATION_MINUTES, parsed));
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysAgo(days: number) {
  const date = startOfToday();
  date.setDate(date.getDate() - days);
  return date;
}

function formatStudyTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.round((safeSeconds % 3600) / 60);

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function calculateStats(sessions: PomodoroSession[]): TimerStats {
  const todayStart = startOfToday();
  const weekStart = daysAgo(6);
  const monthStart = daysAgo(29);
  const byDay = new Map<string, number>();

  let todaySeconds = 0;
  let weekSeconds = 0;
  let monthSeconds = 0;
  let weekSessions = 0;
  let monthSessions = 0;

  sessions.forEach((session) => {
    const completedAt = new Date(session.completed_at);
    const duration = Math.max(0, session.duration_seconds || 0);
    const dayKey = completedAt.toISOString().slice(0, 10);

    byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + duration);

    if (completedAt >= monthStart) {
      monthSeconds += duration;
      monthSessions += 1;
    }

    if (completedAt >= weekStart) {
      weekSeconds += duration;
      weekSessions += 1;
    }

    if (completedAt >= todayStart) {
      todaySeconds += duration;
    }
  });

  let bestDayLabel = 'No sessions yet';
  let bestDaySeconds = 0;

  byDay.forEach((seconds, day) => {
    if (seconds > bestDaySeconds) {
      bestDaySeconds = seconds;
      bestDayLabel = new Date(`${day}T00:00:00`).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      });
    }
  });

  return {
    todaySeconds,
    weekSeconds,
    monthSeconds,
    weekSessions,
    monthSessions,
    averageSeconds: monthSessions > 0 ? Math.round(monthSeconds / monthSessions) : 0,
    bestDayLabel,
    bestDaySeconds,
  };
}

export default function TimerClient() {
  const [mode, setMode] = useState<TimerMode>('work');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [muted, setMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [cloudSessions, setCloudSessions] = useState<PomodoroSession[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Settings
  const [workTime, setWorkTime] = useState<number | string>(25);
  const [breakTime, setBreakTime] = useState<number | string>(5);
  const [longBreakTime, setLongBreakTime] = useState<number | string>(15);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const supabase = useRef(createClient());

  const totalTime =
    mode === 'work'
      ? sanitizeDuration(workTime) * 60
      : mode === 'break'
        ? sanitizeDuration(breakTime) * 60
        : sanitizeDuration(longBreakTime) * 60;
  const progress = Math.min(100, Math.max(0, ((totalTime - timeLeft) / totalTime) * 100));
  const stats = calculateStats(cloudSessions);

  const fetchPomodoroStats = useCallback(async (userId: string) => {
    setStatsLoading(true);
    const since = daysAgo(29).toISOString();
    const { data, error } = await supabase.current
      .from('pomodoro_sessions')
      .select('id, duration_seconds, completed_at')
      .eq('user_id', userId)
      .eq('mode', 'work')
      .gte('completed_at', since)
      .order('completed_at', { ascending: false });

    if (!error && data) {
      setCloudSessions(data as PomodoroSession[]);
    } else if (error) {
      console.error('Pomodoro stats fetch failed:', error.message);
    }

    setStatsLoading(false);
  }, []);

  const logPomodoroSession = useCallback(async (durationSeconds: number) => {
    if (!user) return;

    const { data, error } = await supabase.current
      .from('pomodoro_sessions')
      .insert({
        user_id: user.id,
        mode: 'work',
        duration_seconds: durationSeconds,
      })
      .select('id, duration_seconds, completed_at')
      .single();

    if (!error && data) {
      setCloudSessions((prev) => [data as PomodoroSession, ...prev]);
    } else if (error) {
      console.error('Pomodoro session log failed:', error.message);
    }
  }, [user]);

  useEffect(() => {
    supabase.current.auth.getUser().then(({ data }) => {
      const currentUser = data.user ? { id: data.user.id, email: data.user.email } : null;
      setUser(currentUser);
      if (currentUser) {
        fetchPomodoroStats(currentUser.id);
      } else {
        setStatsLoading(false);
      }
    });

    const { data: listener } = supabase.current.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ? { id: session.user.id, email: session.user.email } : null;
      setUser(currentUser);
      setCloudSessions([]);
      if (currentUser) {
        fetchPomodoroStats(currentUser.id);
      } else {
        setStatsLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [fetchPomodoroStats]);

  const playSound = useCallback(() => {
    if (muted) return;
    if (!audioRef.current) {
      audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    }
    audioRef.current.play().catch(e => console.error('Audio play failed', e));
  }, [muted]);

  const switchMode = useCallback((newMode: TimerMode) => {
    setMode(newMode);
    setIsActive(false);
    if (newMode === 'work') setTimeLeft(sanitizeDuration(workTime) * 60);
    else if (newMode === 'break') setTimeLeft(sanitizeDuration(breakTime) * 60);
    else setTimeLeft(sanitizeDuration(longBreakTime) * 60);
  }, [workTime, breakTime, longBreakTime]);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      playSound();
      if (mode === 'work') {
        const newSessions = sessions + 1;
        setSessions(newSessions);
        void logPomodoroSession(sanitizeDuration(workTime) * 60);
        if (newSessions % 4 === 0) switchMode('longBreak');
        else switchMode('break');
      } else {
        switchMode('work');
      }
      
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Focus Session Complete", {
          body: mode === 'work' ? "Time for a break!" : "Break is over, back to work!",
          icon: "/favicon.ico"
        });
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft, mode, sessions, playSound, switchMode, logPomodoroSession, workTime]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const formatTime = (seconds: number) => {
    const safeSeconds = Number.isFinite(seconds)
      ? Math.min(MAX_DURATION_MINUTES * 60, Math.max(0, Math.floor(seconds)))
      : 0;
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(totalTime);
  };

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto px-6 py-10 flex flex-col items-center justify-center min-h-[80vh]">
      <FadeIn className="w-full text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface text-muted text-[10px] font-bold uppercase tracking-wider mb-4 border border-border">
          {mode === 'work' ? <Brain className="w-3 h-3" /> : <Coffee className="w-3 h-3" />}
          {mode === 'work' ? 'Deep Work Session' : mode === 'break' ? 'Short Break' : 'Long Break'}
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">Stay Focused</h1>
        <p className="text-sm text-muted mt-2">Using the Pomodoro technique for maximum productivity.</p>
      </FadeIn>

      <FadeIn delay={0.1} className="relative mb-12">
        {/* Progress Circle */}
        <div className="relative w-72 h-72 sm:w-80 sm:h-80">
          <svg className="w-full h-full -rotate-90">
            <circle
              cx="50%"
              cy="50%"
              r="48%"
              className="fill-none stroke-surface-hover stroke-[6]"
            />
            <circle
              cx="50%"
              cy="50%"
              r="48%"
              className="fill-none stroke-foreground stroke-[6] transition-all duration-1000 ease-linear"
              strokeDasharray="301.6%"
              strokeDashoffset={`${301.6 - (301.6 * progress) / 100}%`}
              strokeLinecap="round"
            />
          </svg>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-6xl sm:text-7xl font-black tabular-nums tracking-tighter text-foreground">
              {formatTime(timeLeft)}
            </span>
            <div className="flex items-center gap-2 mt-4">
              {[...Array(4)].map((_, i) => (
                <div 
                  key={i} 
                  className={`w-2 h-2 rounded-full border border-foreground/20 ${
                    i < (sessions % 4) ? 'bg-foreground' : 'bg-transparent'
                  }`} 
                />
              ))}
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Controls */}
      <FadeIn delay={0.2} className="w-full max-w-xs space-y-8">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={resetTimer}
            className="w-12 h-12 rounded-full border border-border bg-card flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-all"
            title="Reset"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          
          <ScaleButton
            onClick={toggleTimer}
            className="w-20 h-20 rounded-full bg-foreground text-background flex items-center justify-center shadow-xl"
          >
            {isActive ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current translate-x-0.5" />}
          </ScaleButton>

          <button
            onClick={() => setShowSettings(true)}
            className="w-12 h-12 rounded-full border border-border bg-card flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-all"
            title="Settings"
          >
            <Settings2 className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center px-4 py-3 rounded-xl bg-surface border border-border">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CheckCircle2 className="w-4 h-4 text-muted" />
              Sessions Completed
            </div>
            <span className="text-sm font-bold font-mono">{sessions}</span>
          </div>
          
          <button 
            onClick={() => setMuted(!muted)}
            className="flex justify-between items-center px-4 py-3 rounded-xl bg-surface/50 border border-border hover:bg-surface transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-muted">
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              Sound Effects
            </div>
            <span className="text-xs font-bold uppercase tracking-wider">{muted ? 'Off' : 'On'}</span>
          </button>
        </div>
      </FadeIn>

      <FadeIn delay={0.3} className="w-full mt-12">
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-border">
            <div>
              <h2 className="text-lg font-bold text-foreground tracking-tight">Study Statistics</h2>
              <p className="text-sm text-muted mt-1">Completed work sessions from your Pomodoro history.</p>
            </div>
            {user && (
              <span className="text-xs text-muted">
                Last 30 days
              </span>
            )}
          </div>

          {!user ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Sign in to track your study time</p>
                <p className="text-xs text-muted mt-1">Weekly and monthly statistics sync across devices.</p>
              </div>
              <Link
                href="/login?redirectTo=/timer"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
              >
                <LogIn className="w-4 h-4" />
                Sign in
              </Link>
            </div>
          ) : statsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="h-24 rounded-xl border border-border bg-surface animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                  icon={<Brain className="w-4 h-4" />}
                  label="Today"
                  value={formatStudyTime(stats.todaySeconds)}
                  detail="Focused today"
                />
                <StatCard
                  icon={<Calendar className="w-4 h-4" />}
                  label="This Week"
                  value={formatStudyTime(stats.weekSeconds)}
                  detail={`${stats.weekSessions} session${stats.weekSessions === 1 ? '' : 's'}`}
                />
                <StatCard
                  icon={<CheckCircle2 className="w-4 h-4" />}
                  label="This Month"
                  value={formatStudyTime(stats.monthSeconds)}
                  detail={`${stats.monthSessions} session${stats.monthSessions === 1 ? '' : 's'}`}
                />
                <StatCard
                  icon={<Trophy className="w-4 h-4" />}
                  label="Best Day"
                  value={stats.bestDaySeconds > 0 ? formatStudyTime(stats.bestDaySeconds) : '0m'}
                  detail={stats.bestDayLabel}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-surface/50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Monthly Average</p>
                  <p className="text-sm text-foreground">
                    Your average completed focus session is{' '}
                    <span className="font-bold">{formatStudyTime(stats.averageSeconds)}</span>.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface/50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">Pace</p>
                  <p className="text-sm text-foreground">
                    {stats.weekSeconds > 0
                      ? `You have studied ${formatStudyTime(stats.weekSeconds)} in the last 7 days.`
                      : 'Complete a work session to start building your weekly trend.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </FadeIn>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <FadeIn className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center">
              <h2 className="font-bold text-foreground">Timer Settings</h2>
              <button onClick={() => setShowSettings(false)} className="text-muted hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-muted">Work Duration (mins)</label>
                <input 
                  type="number" 
                  min={MIN_DURATION_MINUTES}
                  max={MAX_DURATION_MINUTES}
                  step={1}
                  value={workTime} 
                  onChange={(e) => setWorkTime(e.target.value === '' ? '' : sanitizeDuration(e.target.value))}
                  className="w-full bg-surface border border-border rounded-lg px-4 py-2 text-foreground font-mono outline-none focus:ring-1 focus:ring-foreground"
                />
              </div>
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-muted">Short Break (mins)</label>
                <input 
                  type="number" 
                  min={MIN_DURATION_MINUTES}
                  max={MAX_DURATION_MINUTES}
                  step={1}
                  value={breakTime} 
                  onChange={(e) => setBreakTime(e.target.value === '' ? '' : sanitizeDuration(e.target.value))}
                  className="w-full bg-surface border border-border rounded-lg px-4 py-2 text-foreground font-mono outline-none focus:ring-1 focus:ring-foreground"
                />
              </div>
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-muted">Long Break (mins)</label>
                <input 
                  type="number" 
                  min={MIN_DURATION_MINUTES}
                  max={MAX_DURATION_MINUTES}
                  step={1}
                  value={longBreakTime} 
                  onChange={(e) => setLongBreakTime(e.target.value === '' ? '' : sanitizeDuration(e.target.value))}
                  className="w-full bg-surface border border-border rounded-lg px-4 py-2 text-foreground font-mono outline-none focus:ring-1 focus:ring-foreground"
                />
              </div>
            </div>
            <div className="p-4 bg-surface border-t border-border">
              <button 
                onClick={() => {
                  setShowSettings(false);
                  resetTimer();
                }}
                className="w-full py-3 bg-foreground text-background rounded-xl text-sm font-bold shadow-lg"
              >
                Apply Changes
              </button>
            </div>
          </FadeIn>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted mb-3">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-black tracking-tight text-foreground">{value}</p>
      <p className="text-xs text-muted mt-1">{detail}</p>
    </div>
  );
}
