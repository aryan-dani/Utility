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
  Bell,
  CheckCircle2,
  X
} from 'lucide-react';
import { FadeIn, ScaleButton } from '@/components/Animations';

type TimerMode = 'work' | 'break' | 'longBreak';

export default function TimerClient() {
  const [mode, setMode] = useState<TimerMode>('work');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [muted, setMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings
  const [workTime, setWorkTime] = useState<number | string>(25);
  const [breakTime, setBreakTime] = useState<number | string>(5);
  const [longBreakTime, setLongBreakTime] = useState<number | string>(15);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const totalTime = mode === 'work' ? (Number(workTime) || 1) * 60 : mode === 'break' ? (Number(breakTime) || 1) * 60 : (Number(longBreakTime) || 1) * 60;
  const progress = ((totalTime - timeLeft) / totalTime) * 100;

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
    if (newMode === 'work') setTimeLeft((Number(workTime) || 1) * 60);
    else if (newMode === 'break') setTimeLeft((Number(breakTime) || 1) * 60);
    else setTimeLeft((Number(longBreakTime) || 1) * 60);
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
  }, [isActive, timeLeft, mode, sessions, playSound, switchMode]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleTimer = () => setIsActive(!isActive);
  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(totalTime);
  };

  return (
    <div className="flex-1 w-full max-w-2xl mx-auto px-6 py-10 flex flex-col items-center justify-center min-h-[80vh]">
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
                  value={workTime} 
                  onChange={(e) => setWorkTime(e.target.value === '' ? '' : parseInt(e.target.value) || 1)}
                  className="w-full bg-surface border border-border rounded-lg px-4 py-2 text-foreground font-mono outline-none focus:ring-1 focus:ring-foreground"
                />
              </div>
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-muted">Short Break (mins)</label>
                <input 
                  type="number" 
                  value={breakTime} 
                  onChange={(e) => setBreakTime(e.target.value === '' ? '' : parseInt(e.target.value) || 1)}
                  className="w-full bg-surface border border-border rounded-lg px-4 py-2 text-foreground font-mono outline-none focus:ring-1 focus:ring-foreground"
                />
              </div>
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-widest text-muted">Long Break (mins)</label>
                <input 
                  type="number" 
                  value={longBreakTime} 
                  onChange={(e) => setLongBreakTime(e.target.value === '' ? '' : parseInt(e.target.value) || 1)}
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
