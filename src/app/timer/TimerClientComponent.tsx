'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
  Flame,
  BarChart3,
  ShieldCheck,
  Music,
  CloudRain
} from 'lucide-react';
import { FadeIn, ScaleButton } from '@/components/Animations';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { logActivity } from '@/components/ActivityHeatmap';

type TimerMode = 'work' | 'break' | 'longBreak';

interface FocusLog {
  date: string; // YYYY-MM-DD
  minutes: number;
}

const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 180;

function sanitizeDuration(value: number | string) {
  const parsed = Math.floor(Number(value));

  if (!Number.isFinite(parsed)) return MIN_DURATION_MINUTES;

  return Math.min(MAX_DURATION_MINUTES, Math.max(MIN_DURATION_MINUTES, parsed));
}

export default function TimerClient() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get('taskId');
  const taskText = searchParams.get('taskText');
  const day = searchParams.get('day');

  const [mode, setMode] = useState<TimerMode>('work');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [muted, setMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [focusLogs, setFocusLogs] = useState<FocusLog[]>([]);
  
  // Settings
  const [workTime, setWorkTime] = useState<number | string>(25);
  const [breakTime, setBreakTime] = useState<number | string>(5);
  const [longBreakTime, setLongBreakTime] = useState<number | string>(15);

  // Focus Mode Guardrails
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [distractions, setDistractions] = useState(0);
  const [showFocusWarning, setShowFocusWarning] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [soundscape, setSoundscape] = useState<'none' | 'lofi' | 'rain' | 'cafe'>('none');
  const [soundVolume, setSoundVolume] = useState(0.5);
  const [soundPlaying, setSoundPlaying] = useState(false);
  const soundAudioRef = useRef<HTMLAudioElement | null>(null);

  const soundUrls = useMemo(() => ({
    lofi: 'https://raw.githubusercontent.com/Saumya-patel-31/Moodmap/main/public/audio/lofi.mp3',
    rain: 'https://raw.githubusercontent.com/stu442/pomodoro-web/main/public/sounds/rain.mp3',
    cafe: 'https://raw.githubusercontent.com/stu442/pomodoro-web/main/public/sounds/coffeeshop.mp3',
  }), []);

  useEffect(() => {
    if (soundscape === 'none') {
      if (soundAudioRef.current) {
        soundAudioRef.current.pause();
        soundAudioRef.current = null;
      }
      setSoundPlaying(false);
      return;
    }

    if (soundAudioRef.current) {
      soundAudioRef.current.pause();
    }

    const audio = new Audio(soundUrls[soundscape]);
    audio.loop = true;
    audio.volume = soundVolume;
    soundAudioRef.current = audio;

    if (isActive || soundPlaying) {
      audio.play()
        .then(() => setSoundPlaying(true))
        .catch(err => console.error("Soundscape play failed", err));
    }
  }, [soundscape, soundUrls]);

  useEffect(() => {
    if (soundAudioRef.current) {
      soundAudioRef.current.volume = soundVolume;
    }
  }, [soundVolume]);

  useEffect(() => {
    if (isActive && soundscape !== 'none' && soundAudioRef.current && !soundPlaying) {
      soundAudioRef.current.play()
        .then(() => setSoundPlaying(true))
        .catch(() => {});
    }
  }, [isActive, soundscape, soundPlaying]);

  // Handle initial query parameters (mode and start)
  useEffect(() => {
    const modeParam = searchParams.get('mode') as TimerMode | null;
    const startParam = searchParams.get('start') === 'true';

    if (modeParam && ['work', 'break', 'longBreak'].includes(modeParam)) {
      setMode(modeParam);
      setIsActive(startParam);
      
      const duration = modeParam === 'work' 
        ? sanitizeDuration(workTime) 
        : modeParam === 'break' 
          ? sanitizeDuration(breakTime) 
          : sanitizeDuration(longBreakTime);
      setTimeLeft(duration * 60);
    }
  }, [searchParams]);

  // Handle Focus Mode activity & fullscreen changes
  useEffect(() => {
    if (!isFocusMode) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setDistractions((prev) => prev + 1);
        setShowFocusWarning(true);
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setDistractions((prev) => prev + 1);
        setShowFocusWarning(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    document.body.classList.add('focus-mode-active');

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.body.classList.remove('focus-mode-active');
    };
  }, [isFocusMode]);

  const enterFocusMode = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setIsFocusMode(true);
      setDistractions(0);
      setShowFocusWarning(false);
    } catch (err) {
      console.error("Failed to enter fullscreen:", err);
      setIsFocusMode(true);
      setDistractions(0);
      setShowFocusWarning(false);
    }
  };

  const exitFocusMode = async () => {
    setIsFocusMode(false);
    setShowFocusWarning(false);
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.error("Failed to exit fullscreen:", err);
      }
    }
  };

  const resumeFocus = async () => {
    setShowFocusWarning(false);
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (err) {
        console.error("Failed to re-enter fullscreen:", err);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (soundAudioRef.current) {
        soundAudioRef.current.pause();
      }
    };
  }, []);

  const toggleSoundscapePlay = () => {
    if (!soundAudioRef.current) return;
    if (soundPlaying) {
      soundAudioRef.current.pause();
      setSoundPlaying(false);
    } else {
      soundAudioRef.current.play()
        .then(() => setSoundPlaying(true))
        .catch(err => console.error("Soundscape play failed", err));
    }
  };

  const totalTime =
    mode === 'work'
      ? sanitizeDuration(workTime) * 60
      : mode === 'break'
        ? sanitizeDuration(breakTime) * 60
        : sanitizeDuration(longBreakTime) * 60;
  const progress = Math.min(100, Math.max(0, ((totalTime - timeLeft) / totalTime) * 100));

  const themeColorClass = useMemo(() => {
    if (mode === 'work') return 'text-foreground border-foreground/20 bg-foreground/5';
    if (mode === 'break') return 'text-muted-hover border-muted/20 bg-muted/5';
    return 'text-muted border-muted/20 bg-muted/5';
  }, [mode]);

  const strokeColorClass = useMemo(() => {
    if (mode === 'work') return isActive ? 'stroke-foreground [filter:drop-shadow(0_0_8px_rgb(var(--foreground)/0.3))]' : 'stroke-foreground';
    if (mode === 'break') return isActive ? 'stroke-muted-hover [filter:drop-shadow(0_0_8px_rgb(var(--muted)/0.3))]' : 'stroke-foreground';
    return isActive ? 'stroke-muted [filter:drop-shadow(0_0_8px_rgb(var(--muted)/0.3))]' : 'stroke-foreground';
  }, [mode, isActive]);

  // Load focus history
  useEffect(() => {
    const logsSaved = localStorage.getItem('utility_focus_logs');
    if (logsSaved) {
      try {
        setFocusLogs(JSON.parse(logsSaved));
      } catch {}
    }
  }, []);

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

  const logFocusSession = useCallback(async (minutes: number) => {
    logActivity('focus_timer_completed', 1);

    const today = new Date().toISOString().split('T')[0];
    try {
      const logsSaved = localStorage.getItem('utility_focus_logs');
      let logs: FocusLog[] = [];
      if (logsSaved) {
        logs = JSON.parse(logsSaved);
      }
      const existingIndex = logs.findIndex(l => l.date === today);
      if (existingIndex !== -1) {
        logs[existingIndex].minutes += minutes;
      } else {
        logs.push({ date: today, minutes });
      }
      localStorage.setItem('utility_focus_logs', JSON.stringify(logs));
      setFocusLogs(logs);
    } catch (e) {
      console.error('Failed to log focus history:', e);
    }

    if (taskId && day) {
      const plannerSaved = localStorage.getItem('utility_planner_week');
      if (plannerSaved) {
        try {
          const weekData = JSON.parse(plannerSaved);
          if (weekData[day]) {
            weekData[day] = weekData[day].map((todo: any) => {
              if (todo.id === taskId) {
                return {
                  ...todo,
                  focusSessions: (todo.focusSessions || 0) + 1,
                  focusMinutes: (todo.focusMinutes || 0) + minutes,
                };
              }
              return todo;
            });
            localStorage.setItem('utility_planner_week', JSON.stringify(weekData));
            
            const user = auth.currentUser;
            if (user) {
              const docRef = doc(db, 'planner_data', user.uid);
              await setDoc(docRef, {
                user_id: user.uid,
                data: weekData,
                updated_at: new Date().toISOString()
              }, { merge: true });
            }
          }
        } catch (e) {
          console.error('Failed to update planner data:', e);
        }
      }
    }
  }, [taskId, day]);

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
        
        const durationMins = sanitizeDuration(workTime);
        logFocusSession(durationMins);

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
  }, [isActive, timeLeft, mode, sessions, playSound, switchMode, logFocusSession, workTime]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      const modeLabel = mode === 'work' ? 'Work' : mode === 'break' ? 'Short Break' : 'Long Break';
      document.title = `(${formatTime(timeLeft)}) ${modeLabel} | Utility`;
    } else {
      document.title = 'Focus Timer | Utility';
    }
    return () => {
      document.title = 'Utility';
    };
  }, [timeLeft, isActive, mode]);

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

  const weeklyChartData = useMemo(() => {
    const data = [];
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().split('T')[0];
      const log = focusLogs.find(l => l.date === dateString);
      const dayLabel = daysOfWeek[d.getDay()];
      data.push({
        day: dayLabel,
        minutes: log ? log.minutes : 0,
        date: dateString
      });
    }
    return data;
  }, [focusLogs]);

  const maxMinutes = useMemo(() => {
    const max = Math.max(...weeklyChartData.map(d => d.minutes), 0);
    return max === 0 ? 60 : max;
  }, [weeklyChartData]);

  return (
    <div className="flex-1 w-full px-6 py-10 flex flex-col md:flex-row items-center justify-center gap-12 min-h-screen">
      
      {/* Left panel: Pomodoro timer */}
      <div className="flex-1 flex flex-col items-center max-w-md w-full">
        <FadeIn className="w-full text-center mb-6 flex flex-col items-center">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4 border border-border transition-all duration-300 ${themeColorClass}`}>
            {mode === 'work' ? <Brain className="w-3 h-3" /> : <Coffee className="w-3 h-3" />}
            {mode === 'work' ? 'Deep Work Session' : mode === 'break' ? 'Short Break' : 'Long Break'}
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Stay Focused</h1>
          <p className="text-xs text-muted mt-1.5 mb-5">Pomodoro tracker optimized for your weekly targets.</p>

          {/* Mode Selector Tabs */}
          <div className="flex bg-surface/50 border border-border/80 rounded-xl p-1 w-full max-w-[280px] shadow-xs">
            {(['work', 'break', 'longBreak'] as const).map((m) => {
              const labelMap = {
                work: 'Focus',
                break: 'Break',
                longBreak: 'Long Break',
              };
              return (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                    mode === m
                      ? 'bg-background border border-border/80 text-foreground shadow-sm font-bold'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  {labelMap[m]}
                </button>
              );
            })}
          </div>
        </FadeIn>

        {/* Active Task Callout */}
        {taskText && (
          <FadeIn delay={0.05} className="w-full mb-8 bg-surface/60 border border-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-background border border-border flex items-center justify-center text-primary shrink-0 animate-pulse">
              <Flame className="w-4 h-4 fill-current" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Focused Task</p>
              <p className="text-xs font-semibold text-foreground truncate">{decodeURIComponent(taskText)}</p>
            </div>
          </FadeIn>
        )}

        <FadeIn delay={0.1} className="relative mb-8">
          {/* Progress Circle */}
          <div className="relative w-64 h-64 sm:w-72 sm:h-72">
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
                className={`fill-none stroke-[6] transition-all duration-1000 ease-linear ${strokeColorClass}`}
                strokeDasharray="301.6%"
                strokeDashoffset={`${301.6 - (301.6 * progress) / 100}%`}
                strokeLinecap="round"
              />
            </svg>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl sm:text-6xl font-black tabular-nums tracking-tighter text-foreground">
                {formatTime(timeLeft)}
              </span>
              <div className="flex items-center gap-2.5 mt-4">
                {[...Array(4)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-2.5 h-2.5 rounded-full border border-foreground/30 transition-colors duration-300 ${
                      i < (sessions % 4) 
                        ? 'bg-foreground border-foreground' 
                        : 'bg-transparent'
                    }`} 
                  />
                ))}
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Controls */}
        <FadeIn delay={0.2} className="w-full space-y-6 flex flex-col items-center">
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={resetTimer}
              className="w-12 h-12 rounded-xl border border-border bg-card flex items-center justify-center text-foreground hover:scale-105 active:scale-95 shadow-sm transition-all duration-200"
              title="Reset"
              aria-label="Reset timer"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            
            <button
              onClick={toggleTimer}
              className={`w-28 h-12 rounded-xl border border-transparent flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all duration-200 ${
                isActive 
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/95' 
                  : 'bg-primary text-primary-foreground hover:bg-primary/95'
              }`}
              aria-label={isActive ? "Pause timer" : "Start timer"}
            >
              {isActive ? <span className="font-bold text-xs uppercase tracking-widest">Pause</span> : <span className="font-bold text-xs uppercase tracking-widest">Start</span>}
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className="w-12 h-12 rounded-xl border border-border bg-card flex items-center justify-center text-foreground hover:scale-105 active:scale-95 shadow-sm transition-all duration-200"
              title="Settings"
              aria-label="Timer settings"
            >
              <Settings2 className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={isFocusMode ? exitFocusMode : enterFocusMode}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 border flex items-center gap-2 shadow-xs ${
              isFocusMode
                ? 'bg-destructive/10 border-destructive/30 text-destructive hover:bg-destructive/20'
                : 'bg-surface/50 border-border text-foreground hover:bg-surface-hover/80 hover:border-border-strong'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            {isFocusMode ? 'Exit Focus Mode' : 'Enter Focus Mode'}
          </button>
        </FadeIn>
      </div>

      {/* Right panel: Focus analytics */}
      <FadeIn delay={0.3} className="flex-1 w-full max-w-sm space-y-6">
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Session Statistics
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface/50 border border-border rounded-xl p-3 text-center">
              <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Completed</span>
              <p className="text-2xl font-black text-foreground mt-1">{sessions}</p>
            </div>
            <div className="bg-surface/50 border border-border rounded-xl p-3 text-center">
              <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Today's Focus</span>
              <p className="text-2xl font-black text-foreground mt-1">
                {focusLogs.find(l => l.date === new Date().toISOString().split('T')[0])?.minutes || 0}m
              </p>
            </div>
          </div>
        </div>

        {/* Weekly Chart */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-muted" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Weekly Study Time</h3>
          </div>
          <div className="flex justify-between items-end h-28 pt-2 px-2">
            {weeklyChartData.map((d, index) => {
              const pct = (d.minutes / maxMinutes) * 100;
              return (
                <div key={index} className="flex flex-col items-center flex-1 group relative">
                  {/* Tooltip */}
                  <div className="absolute -top-8 bg-foreground text-background text-[10px] font-bold rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap shadow-md z-10">
                    {d.minutes}m
                  </div>
                  <div className="w-5 bg-surface border border-border rounded-full overflow-hidden flex items-end h-20 transition-all group-hover:border-foreground/30">
                    <div 
                      className="w-full bg-foreground transition-all duration-500 ease-out rounded-full" 
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-muted mt-2">{d.day}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ambient Soundscapes Card */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-muted" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">Ambient Soundscapes</h3>
            </div>
            {soundscape !== 'none' && (
              <button 
                onClick={toggleSoundscapePlay}
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-surface border border-border rounded-md text-foreground hover:bg-surface-hover transition-all"
                aria-label={soundPlaying ? 'Pause soundscape' : 'Play soundscape'}
              >
                {soundPlaying ? 'Pause' : 'Play'}
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-3 gap-2 mb-4">
            {(['lofi', 'rain', 'cafe'] as const).map((s) => {
              const soundMap = {
                lofi: { label: 'Lo-fi', icon: Music },
                rain: { label: 'Rain', icon: CloudRain },
                cafe: { label: 'Café', icon: Coffee },
              };
              const { label, icon: Icon } = soundMap[s];
              return (
                <button
                  key={s}
                  onClick={() => setSoundscape(soundscape === s ? 'none' : s)}
                  className={`flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                    soundscape === s
                      ? 'bg-primary text-primary-foreground border-transparent font-bold shadow-xs'
                      : 'bg-surface/40 border-border text-muted hover:border-border-strong hover:text-foreground'
                  }`}
                  aria-label={`Select ${s} soundscape`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {soundscape !== 'none' && (
            <div className="space-y-2 animate-fade-in">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-muted">
                <span>Volume</span>
                <span>{Math.round(soundVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={soundVolume}
                onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                className="w-full accent-slider cursor-pointer"
                aria-label="Soundscape volume slider"
              />
            </div>
          )}
        </div>
      </FadeIn>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/95">
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

      {/* Focus Mode Interrupted Modal */}
      <AnimatePresence>
        {showFocusWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex flex-col items-center justify-center p-4 bg-background/95"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="max-w-md w-full text-center space-y-6 p-8 border border-destructive/20 bg-card rounded-2xl shadow-2xl"
            >
              <div className="w-16 h-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto text-destructive animate-bounce">
                <X className="w-8 h-8" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-destructive tracking-tight uppercase">
                  Focus Interrupted!
                </h2>
                <p className="text-sm text-foreground-subtle">
                  You navigated away or exited fullscreen mode. Stay focused on your targets to finish the session!
                </p>
              </div>

              <div className="py-3 px-4 bg-surface/50 border border-border rounded-xl inline-block">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">
                  Distractions Count
                </p>
                <p className="text-3xl font-black text-foreground mt-1 animate-warning-pulse">
                  {distractions}
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2.5">
                <button
                  onClick={resumeFocus}
                  className="w-full py-3 bg-foreground text-background font-bold rounded-xl text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
                >
                  Resume Focus Mode
                </button>
                <button
                  onClick={exitFocusMode}
                  className="w-full py-2.5 bg-surface border border-border text-foreground font-semibold rounded-xl text-xs hover:bg-surface-hover transition-all"
                >
                  Exit Focus Mode
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
