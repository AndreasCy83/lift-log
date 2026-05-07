import { useCallback, useEffect, useRef, useState } from 'react';
import { Timer, Pause, Play, RotateCcw, X, ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react';
import RestTimerNative from '@/lib/RestTimerNative';
import {
  getCurrentRestTimer,
  getTimerRemaining,
  pauseCurrentRestTimer,
  resumeCurrentRestTimer,
  clearAllRestTimers,
  startRestTimer,
  markCueFired,
  adjustRestTimerSeconds,
  REST_TIMERS_CHANGED_EVENT,
  type ActiveRestTimer,
} from '@/lib/restTimerState';
import { speakCue, playFinishBeep } from '@/lib/ttsVoice';

interface Props {
  /** Optional resolver: workoutExerciseId -> human-readable label (e.g. exercise name). */
  resolveLabel?: (workoutExerciseId: string) => string | undefined;
  /** Extra bottom offset in px (e.g. for bottom navigation height). Defaults to 80. */
  bottomOffset?: number;
  /** When true, only the minimized pill is shown and clicking it calls onMinimizedClick instead of expanding. */
  forceMinimized?: boolean;
  /** Optional handler invoked when the minimized pill is clicked (used in forceMinimized mode). */
  onMinimizedClick?: () => void;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function FloatingRestTimer({ resolveLabel, bottomOffset = 80, forceMinimized = false, onMinimizedClick }: Props) {
  const [timer, setTimer] = useState<ActiveRestTimer | null>(() => getCurrentRestTimer());
  const [remaining, setRemaining] = useState<number>(() => {
    const t = getCurrentRestTimer();
    return t ? getTimerRemaining(t) : 0;
  });
  const [minimized, setMinimized] = useState(false);
  const finishedRef = useRef(false);
  const lastIdRef = useRef<string | null>(null);

  const sync = useCallback(() => {
    const t = getCurrentRestTimer();
    setTimer(t);
    if (t) {
      setRemaining(getTimerRemaining(t));
      // New timer started → auto-expand and reset finish flag.
      if (lastIdRef.current !== t.id || finishedRef.current) {
        lastIdRef.current = t.id;
        finishedRef.current = false;
        setMinimized(false);
      }
    } else {
      setRemaining(0);
      lastIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    sync();
    const onChange = () => sync();
    const onVis = () => { if (!document.hidden) sync(); };
    window.addEventListener(REST_TIMERS_CHANGED_EVENT, onChange);
    window.addEventListener('storage', onChange);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener(REST_TIMERS_CHANGED_EVENT, onChange);
      window.removeEventListener('storage', onChange);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [sync]);

  // Tick while running
  useEffect(() => {
    if (!timer || timer.status === 'paused') return;
    let raf = 0;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const t = getCurrentRestTimer();
      if (!t) { setTimer(null); return; }
      const rem = getTimerRemaining(t);
      setRemaining(rem);

      if (rem <= 10 && rem > 9.5 && !t.cuesFired.includes(10)) {
        speakCue('10 seconds');
        markCueFired(t.id, 10);
        t.cuesFired.push(10);
      }
      if (rem <= 5 && rem > 4.5 && !t.cuesFired.includes(5)) {
        speakCue('5 seconds');
        markCueFired(t.id, 5);
        t.cuesFired.push(5);
      }

      if (rem <= 0) {
        if (!finishedRef.current) {
          finishedRef.current = true;
          speakCue('Go!');
          playFinishBeep();
        }
        clearAllRestTimers();
        setTimer(null);
        return;
      }
      raf = window.setTimeout(tick, 250) as unknown as number;
    };
    tick();
    return () => { stopped = true; clearTimeout(raf); };
  }, [timer?.id, timer?.status]);

  if (!timer) return null;

  const isPaused = timer.status === 'paused';
  const total = timer.totalSeconds || 1;
  const progress = Math.max(0, Math.min(100, (remaining / total) * 100));
  const label = resolveLabel?.(timer.workoutExerciseId);

  const handlePauseResume = () => {
    if (isPaused) {
      const next = resumeCurrentRestTimer();
      if (next) {
        const rem = getTimerRemaining(next);
        RestTimerNative.startTimer({ seconds: rem }).catch(() => {});
      }
    } else {
      pauseCurrentRestTimer();
      RestTimerNative.stopTimer().catch(() => {});
    }
  };

  const handleSkip = () => {
    clearAllRestTimers();
    RestTimerNative.stopTimer().catch(() => {});
  };

  const handleRestart = () => {
    finishedRef.current = false;
    startRestTimer(timer.workoutExerciseId, timer.afterSetIndex, timer.totalSeconds);
    RestTimerNative.startTimer({ seconds: timer.totalSeconds }).catch(() => {});
  };

  const containerStyle: React.CSSProperties = {
    bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))`,
  };

  if (minimized || forceMinimized) {
    return (
      <div
        className="fixed left-1/2 z-40 -translate-x-1/2 px-3"
        style={containerStyle}
      >
        <button
          onClick={() => {
            if (forceMinimized) onMinimizedClick?.();
            else setMinimized(false);
          }}
          className="flex items-center gap-2 rounded-full border border-primary/40 bg-background/95 px-3 py-1.5 shadow-lg backdrop-blur-md hover:bg-secondary/70 transition-colors"
          aria-label={forceMinimized ? 'Open workout rest timer' : 'Expand rest timer'}
        >
          <span className={`relative flex h-2 w-2 ${isPaused ? '' : ''}`}>
            <span className={`absolute inline-flex h-full w-full rounded-full ${isPaused ? 'bg-muted-foreground/60' : 'bg-primary opacity-75 animate-ping'}`} />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${isPaused ? 'bg-muted-foreground' : 'bg-primary'}`} />
          </span>
          <Timer className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-bold tabular-nums text-foreground">{fmt(remaining)}</span>
          {!forceMinimized && <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2"
      style={containerStyle}
    >
      <div className="rounded-2xl border border-primary/30 bg-background/95 p-3 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Timer className="h-4 w-4 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-tight">
                {isPaused ? 'Rest paused' : 'Resting'}
              </p>
              {label && (
                <p className="text-xs text-foreground/80 truncate leading-tight">{label}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setMinimized(true)}
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            aria-label="Minimize rest timer"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-baseline justify-center gap-1 mb-2">
          <span className={`font-display text-3xl font-bold tabular-nums ${isPaused ? 'text-muted-foreground' : 'text-primary'}`}>
            {fmt(remaining)}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">/ {fmt(timer.totalSeconds)}</span>
        </div>

        <div className="w-full rounded-full overflow-hidden mb-3" style={{ height: 4, background: 'hsl(var(--muted) / 0.5)' }}>
          <div
            className="h-full rounded-full transition-[width] duration-200"
            style={{
              width: `${progress}%`,
              background: isPaused
                ? 'hsl(var(--muted-foreground))'
                : 'linear-gradient(90deg, #22c55e 0%, #4ade80 25%, #a855f7 50%, #c084fc 75%, #3b82f6 100%)',
              boxShadow: isPaused ? 'none' : '0 0 8px rgba(34,197,94,0.4), 0 0 16px rgba(168,85,247,0.3)',
            }}
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={handleRestart}
            className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Restart rest timer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restart
          </button>
          <button
            onClick={handlePauseResume}
            className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={handleSkip}
            className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Skip rest"
          >
            <X className="h-3.5 w-3.5" />
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
