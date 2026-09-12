'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  RotateCcw, 
  Coffee, 
  Brain, 
  Settings2, 
  Volume2, 
  VolumeX,
  Flame,
  ShieldCheck,
  Music,
  CloudRain
} from 'lucide-react';
import { FadeIn } from '@/components/Animations';
import {
  Button,
  Card,
  Field,
  IconButton,
  Input,
  Modal,
  PageHeader,
  SectionHeader,
  Segmented,
} from '@/components/ui';
import { useMotionSafe } from '@/lib/motion';
import { logActivity, localDateKey } from '@/lib/activity';
import { incrementTaskFocus } from '@/lib/plannerStorage';

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

function formatTime(seconds: number) {
  const safeSeconds = Number.isFinite(seconds)
    ? Math.min(MAX_DURATION_MINUTES * 60, Math.max(0, Math.floor(seconds)))
    : 0;
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const sessionsSaved = localStorage.getItem('utility_focus_sessions');
        if (sessionsSaved) {
          const n = parseInt(sessionsSaved, 10);
          if (Number.isFinite(n) && n >= 0) setSessions(n);
        }
      } catch { /* ignore */ }
      try {
        const logsSaved = localStorage.getItem('utility_focus_logs');
        if (logsSaved) setFocusLogs(JSON.parse(logsSaved) as FocusLog[]);
      } catch { /* ignore */ }
    });
  }, []);
  
  // Settings
  const [workTime, setWorkTime] = useState<number | string>(25);
  const [breakTime, setBreakTime] = useState<number | string>(5);
  const [longBreakTime, setLongBreakTime] = useState<number | string>(15);

  // Focus Mode Guardrails
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [distractions, setDistractions] = useState(0);
  const [showFocusWarning, setShowFocusWarning] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const deadlineRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [soundscape, setSoundscape] = useState<'none' | 'lofi' | 'rain' | 'cafe'>('none');
  const [soundVolume, setSoundVolume] = useState(0.5);
  const [soundPlaying, setSoundPlaying] = useState(false);
  const soundAudioRef = useRef<HTMLAudioElement | null>(null);
  const motionSafe = useMotionSafe();

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
  }, [soundscape, soundUrls, isActive, soundPlaying, soundVolume]);

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

  const modeParam = searchParams.get('mode') as TimerMode | null;
  const startParam = searchParams.get('start') === 'true';
  const timerParamKey = `${modeParam ?? ''}:${startParam}`;
  const [prevTimerParamKey, setPrevTimerParamKey] = useState(timerParamKey);
  if (
    prevTimerParamKey !== timerParamKey &&
    modeParam &&
    ['work', 'break', 'longBreak'].includes(modeParam)
  ) {
    setPrevTimerParamKey(timerParamKey);
    setMode(modeParam);
    setIsActive(startParam);
    const duration =
      modeParam === 'work'
        ? sanitizeDuration(workTime)
        : modeParam === 'break'
          ? sanitizeDuration(breakTime)
          : sanitizeDuration(longBreakTime);
    setTimeLeft(duration * 60);
  }

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
    if (mode === 'work') return 'stroke-foreground';
    if (mode === 'break') return 'stroke-muted-hover';
    return 'stroke-muted';
  }, [mode]);

  // Load focus history + session count - initialized via lazy useState above

  useEffect(() => {
    try {
      localStorage.setItem('utility_focus_sessions', String(sessions));
    } catch {}
  }, [sessions]);

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
    deadlineRef.current = null;
    if (newMode === 'work') setTimeLeft(sanitizeDuration(workTime) * 60);
    else if (newMode === 'break') setTimeLeft(sanitizeDuration(breakTime) * 60);
    else setTimeLeft(sanitizeDuration(longBreakTime) * 60);
  }, [workTime, breakTime, longBreakTime]);

  const logFocusSession = useCallback(async (minutes: number) => {
    logActivity('focus_timer_completed', 1);

    const today = localDateKey();
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
      try {
        incrementTaskFocus(day, taskId, minutes);
      } catch (e) {
        console.error('Failed to update planner data:', e);
      }
    }
  }, [taskId, day]);

  const handleTimerComplete = useCallback(() => {
    deadlineRef.current = null;
    setIsActive(false);
    playSound();
    if (mode === 'work') {
      const newSessions = sessions + 1;
      setSessions(newSessions);

      const durationMins = sanitizeDuration(workTime);
      void logFocusSession(durationMins);

      if (newSessions % 4 === 0) switchMode('longBreak');
      else switchMode('break');
    } else {
      switchMode('work');
    }

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Focus Session Complete", {
        body: mode === 'work' ? "Time for a break!" : "Break is over, back to work!",
        icon: "/utility-logo.webp"
      });
    } else if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, [mode, sessions, playSound, switchMode, logFocusSession, workTime]);

  useEffect(() => {
    if (isActive) {
      if (deadlineRef.current == null) {
        deadlineRef.current = Date.now() + timeLeft * 1000;
      }
      timerRef.current = setInterval(() => {
        const end = deadlineRef.current;
        if (end == null) return;
        const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining === 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimerComplete();
        }
      }, 250);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, handleTimerComplete, timeLeft]);

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

  const toggleTimer = () => {
    if (isActive && deadlineRef.current != null) {
      const remaining = Math.max(
        0,
        Math.ceil((deadlineRef.current - Date.now()) / 1000),
      );
      setTimeLeft(remaining);
      deadlineRef.current = null;
    }
    setIsActive(!isActive);
  };
  const resetTimer = () => {
    setIsActive(false);
    deadlineRef.current = null;
    setTimeLeft(totalTime);
  };

  const weeklyChartData = useMemo(() => {
    const data = [];
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = localDateKey(d);
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
    <div className="flex-1 w-full page-gutter py-5 sm:py-10 flex flex-col md:flex-row items-center justify-center gap-12 min-h-screen">
      <div className="flex-1 flex flex-col items-center max-w-md w-full">
        <FadeIn className="w-full mb-6 flex flex-col items-center">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-2xs font-semibold uppercase tracking-wider mb-4 border border-border ${themeColorClass}`}>
            {mode === 'work' ? <Brain className="w-3 h-3" /> : <Coffee className="w-3 h-3" />}
            {mode === 'work' ? 'Deep Work Session' : mode === 'break' ? 'Short Break' : 'Long Break'}
          </div>
          <PageHeader
            className="text-center sm:flex-col sm:items-center [&_h1]:mx-auto [&_p]:mx-auto"
            title="Stay focused"
            description="Pomodoro tracker optimized for your weekly targets."
          />
          <Segmented
            className="mt-5 w-[min(100%,16.5rem)]"
            size="sm"
            aria-label="Timer mode"
            value={mode}
            onChange={switchMode}
            options={[
              { value: 'work', label: 'Focus' },
              { value: 'break', label: 'Break' },
              { value: 'longBreak', label: 'Long' },
            ]}
          />
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

        <FadeIn delay={0.1} className="relative mb-8 flex items-center justify-center">
          {isActive && !motionSafe.reduce && (
            <motion.div
              animate={{
                scale: [1, 1.12, 1],
                opacity: [0.12, 0.22, 0.12]
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute w-72 h-72 rounded-full bg-foreground/[0.02] dark:bg-foreground/[0.04] blur-2xl -z-10 pointer-events-none"
            />
          )}

          <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
            {isActive && !motionSafe.reduce && (
              <motion.div
                initial={{ scale: 0.96, opacity: 0.1 }}
                animate={{ scale: 1.04, opacity: [0.1, 0.18, 0.1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-[-12px] rounded-full border border-foreground/[0.06] pointer-events-none"
              />
            )}

            <svg className="w-full h-full -rotate-90">
              <circle
                cx="50%"
                cy="50%"
                r="46%"
                className="fill-none stroke-surface-hover stroke-[8]"
              />
              <circle
                cx="50%"
                cy="50%"
                r="46%"
                className={`fill-none stroke-[8] transition-all duration-1000 ease-linear ${strokeColorClass}`}
                strokeDasharray="289%"
                strokeDashoffset={`${289 - (289 * progress) / 100}%`}
                strokeLinecap="round"
                style={{
                  filter: isActive 
                    ? `drop-shadow(0 0 6px ${mode === 'work' ? 'rgb(var(--foreground) / 0.22)' : 'rgb(var(--muted) / 0.22)'})` 
                    : 'none'
                }}
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

        <FadeIn delay={0.2} className="w-full space-y-6 flex flex-col items-center">
          <div className="flex items-center justify-center gap-3">
            <IconButton
              variant="secondary"
              size="lg"
              label="Reset timer"
              onClick={resetTimer}
            >
              <RotateCcw className="w-5 h-5" />
            </IconButton>
            <Button
              size="lg"
              variant={isActive ? 'secondary' : 'primary'}
              onClick={toggleTimer}
              className="min-w-[8.5rem]"
              aria-label={isActive ? 'Pause timer' : 'Start timer'}
            >
              {isActive ? 'Pause' : 'Start'}
            </Button>
            <IconButton
              variant="secondary"
              size="lg"
              label={muted ? 'Unmute completion sound' : 'Mute completion sound'}
              onClick={() => setMuted((m) => !m)}
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </IconButton>
            <IconButton
              variant="secondary"
              size="lg"
              label="Timer settings"
              onClick={() => setShowSettings(true)}
            >
              <Settings2 className="w-5 h-5" />
            </IconButton>
          </div>
          <Button
            variant={isFocusMode ? 'primary' : 'secondary'}
            onClick={isFocusMode ? exitFocusMode : enterFocusMode}
          >
            <ShieldCheck className="w-4 h-4" />
            {isFocusMode ? 'Exit focus mode' : 'Enter focus mode'}
          </Button>
        </FadeIn>
      </div>

      <FadeIn delay={0.3} className="flex-1 w-full max-w-sm space-y-6">
        <Card>
          <SectionHeader title="Session statistics" />
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-surface/50 border border-border rounded-lg p-3 text-center">
              <span className="text-2xs font-semibold uppercase tracking-widest text-muted">Completed</span>
              <p className="text-2xl font-semibold text-foreground mt-1 tabular-nums">{sessions}</p>
            </div>
            <div className="bg-surface/50 border border-border rounded-lg p-3 text-center">
              <span className="text-2xs font-semibold uppercase tracking-widest text-muted">Today&apos;s focus</span>
              <p className="text-2xl font-semibold text-foreground mt-1 tabular-nums">
                {focusLogs.find(l => l.date === localDateKey())?.minutes || 0}m
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <SectionHeader title="Weekly study time" />
          <div className="flex justify-between items-end h-28 pt-4 px-1">
            {weeklyChartData.map((d, index) => {
              const pct = (d.minutes / maxMinutes) * 100;
              return (
                <div key={index} className="flex flex-col items-center flex-1 group relative">
                  <div className="absolute -top-8 bg-foreground text-background text-xs font-bold rounded px-1.5 py-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap shadow-md z-10">
                    {d.minutes}m
                  </div>
                  <div className="w-6 md:w-5 bg-surface border border-border rounded-full overflow-hidden flex items-end h-20">
                    <div
                      className="w-full bg-foreground transition-all duration-500 ease-out rounded-full"
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-muted mt-2">{d.day}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3 mb-4">
            <SectionHeader title="Ambient soundscapes" />
            {soundscape !== 'none' && (
              <Button
                size="sm"
                variant="secondary"
                onClick={toggleSoundscapePlay}
                aria-label={soundPlaying ? 'Pause soundscape' : 'Play soundscape'}
              >
                {soundPlaying ? 'Pause' : 'Play'}
              </Button>
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
              const active = soundscape === s;
              return (
                <Button
                  key={s}
                  size="sm"
                  variant={active ? 'primary' : 'secondary'}
                  onClick={() => setSoundscape(soundscape === s ? 'none' : s)}
                  aria-pressed={active}
                  aria-label={`Select ${label} soundscape`}
                  className="px-2"
                >
                  {active && soundPlaying ? (
                    <span className="flex items-end gap-0.5 h-3.5 w-3.5 shrink-0" aria-hidden>
                      <span className="w-0.5 bg-current animate-pulse h-2 block" style={{ animationDelay: '0.1s', animationDuration: '0.6s' }} />
                      <span className="w-0.5 bg-current animate-pulse h-3 block" style={{ animationDelay: '0.3s', animationDuration: '0.8s' }} />
                      <span className="w-0.5 bg-current animate-pulse h-1.5 block" style={{ animationDelay: '0.2s', animationDuration: '0.5s' }} />
                    </span>
                  ) : (
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                  )}
                  {label}
                </Button>
              );
            })}
          </div>

          {soundscape !== 'none' && (
            <Field label="Volume" htmlFor="soundscape-volume">
              <input
                id="soundscape-volume"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={soundVolume}
                onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                className="w-full accent-slider cursor-pointer"
                aria-valuetext={`${Math.round(soundVolume * 100)} percent`}
              />
            </Field>
          )}
        </Card>
      </FadeIn>

      <Modal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="Timer settings"
        size="sm"
      >
        <div className="space-y-5">
          <Field label="Work duration (minutes)" htmlFor="timer-work">
            <Input
              id="timer-work"
              type="number"
              min={MIN_DURATION_MINUTES}
              max={MAX_DURATION_MINUTES}
              step={1}
              value={workTime}
              onChange={(e) => setWorkTime(e.target.value === '' ? '' : sanitizeDuration(e.target.value))}
            />
          </Field>
          <Field label="Short break (minutes)" htmlFor="timer-break">
            <Input
              id="timer-break"
              type="number"
              min={MIN_DURATION_MINUTES}
              max={MAX_DURATION_MINUTES}
              step={1}
              value={breakTime}
              onChange={(e) => setBreakTime(e.target.value === '' ? '' : sanitizeDuration(e.target.value))}
            />
          </Field>
          <Field label="Long break (minutes)" htmlFor="timer-long-break">
            <Input
              id="timer-long-break"
              type="number"
              min={MIN_DURATION_MINUTES}
              max={MAX_DURATION_MINUTES}
              step={1}
              value={longBreakTime}
              onChange={(e) => setLongBreakTime(e.target.value === '' ? '' : sanitizeDuration(e.target.value))}
            />
          </Field>
          <Button
            className="w-full"
            onClick={() => {
              setShowSettings(false);
              resetTimer();
            }}
          >
            Apply changes
          </Button>
        </div>
      </Modal>

      <Modal
        open={showFocusWarning}
        onClose={exitFocusMode}
        title="Focus interrupted"
        size="sm"
      >
        <div className="space-y-5">
          <p className="text-sm text-muted leading-relaxed">
            You navigated away or exited fullscreen. Stay on this session to finish the block.
          </p>
          <div className="rounded-lg border border-border bg-surface/50 px-4 py-3 text-center">
            <p className="text-2xs font-semibold uppercase tracking-widest text-muted">
              Distractions
            </p>
            <p className="text-3xl font-semibold text-foreground mt-1 tabular-nums">
              {distractions}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={resumeFocus} className="w-full">
              Resume focus mode
            </Button>
            <Button variant="secondary" onClick={exitFocusMode} className="w-full">
              Exit focus mode
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
