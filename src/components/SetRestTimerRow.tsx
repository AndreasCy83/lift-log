import { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Play, Pause } from 'lucide-react';
import {
  getActiveTimers, startRestTimer, clearRestTimer,
  getTimerRemaining, markCueFired, type ActiveRestTimer
} from '@/lib/restTimerState';
import { speakCue, playFinishBeep } from '@/lib/ttsVoice';

interface Props {
  workoutExerciseId: string;
  afterSetIndex: number;
  restSeconds: number | null;
  onTap: () => void;
  /** Called when timer finishes */
  onFinish?: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SetRestTimerRow({ workoutExerciseId, afterSetIndex, restSeconds, onTap, onFinish }: Props) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ActiveRestTimer | null>(null);
  const finishedRef = useRef(false);

  // Check for existing active timer on mount / resume
  const syncFromStorage = useCallback(() => {
    const timers = getActiveTimers();
    const active = timers.find(
      t => t.workoutExerciseId === workoutExerciseId && t.afterSetIndex === afterSetIndex
    );
    if (active) {
      const rem = getTimerRemaining(active);
      if (rem > 0) {
        timerRef.current = active;
        setRemaining(rem);
        setIsRunning(true);
        finishedRef.current = false;
      } else {
        clearRestTimer(workoutExerciseId, afterSetIndex);
        timerRef.current = null;
        setRemaining(null);
        setIsRunning(false);
      }
    }
  }, [workoutExerciseId, afterSetIndex]);

  useEffect(() => {
    syncFromStorage();
    // Listen for app resume (Capacitor)
    const handleVisibility = () => {
      if (!document.hidden) syncFromStorage();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [syncFromStorage]);

  // Countdown loop using requestAnimationFrame + timestamp
  useEffect(() => {
    if (!isRunning || !timerRef.current) return;

    const tick = () => {
      const timer = timerRef.current;
      if (!timer) return;
      const rem = getTimerRemaining(timer);
      setRemaining(rem);

      // Voice cues - fire once
      if (rem === 10 && !timer.cuesFired.includes(10)) {
        speakCue('10 seconds');
        markCueFired(timer.id, 10);
        timer.cuesFired.push(10);
      }
      if (rem === 5 && !timer.cuesFired.includes(5)) {
        speakCue('5 seconds');
        markCueFired(timer.id, 5);
        timer.cuesFired.push(5);
      }

      if (rem <= 0) {
        if (!finishedRef.current) {
          finishedRef.current = true;
          speakCue('Go');
          playFinishBeep();
          onFinish?.();
        }
        clearRestTimer(workoutExerciseId, afterSetIndex);
        timerRef.current = null;
        setIsRunning(false);
        setRemaining(null);
        return;
      }
      rafRef.current = requestAnimationFrame(() => {
        setTimeout(tick, 250); // Check ~4x per second
      });
    };

    tick();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isRunning, workoutExerciseId, afterSetIndex, onFinish]);

  const handleStartPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) {
      // Pause - clear the timer from storage, keep remaining for display
      clearRestTimer(workoutExerciseId, afterSetIndex);
      timerRef.current = null;
      setIsRunning(false);
    } else {
      // Start/resume
      const sec = remaining ?? restSeconds ?? 90;
      if (sec > 0) {
        finishedRef.current = false;
        const timer = startRestTimer(workoutExerciseId, afterSetIndex, sec);
        timerRef.current = timer;
        setRemaining(sec);
        setIsRunning(true);
      }
    }
  };

  const hasRest = restSeconds !== null && restSeconds > 0;
  const showCountdown = isRunning && remaining !== null && remaining > 0;

  return (
    <button
      onClick={onTap}
      className={`w-full flex items-center justify-center gap-2 py-1 my-0.5 rounded transition-colors
        ${showCountdown
          ? 'bg-primary/10 border border-primary/30'
          : 'hover:bg-secondary/50'
        }`}
    >
      {showCountdown ? (
        <>
          <span className="text-xs font-bold text-primary tabular-nums">{formatTime(remaining!)}</span>
          <button
            onClick={handleStartPause}
            className="p-0.5 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
          >
            <Pause className="h-3 w-3" />
          </button>
        </>
      ) : hasRest ? (
        <>
          <Timer className="h-3 w-3 text-primary/60" />
          <span className="text-[11px] text-primary/60 font-medium">{formatTime(restSeconds!)}</span>
          <button
            onClick={handleStartPause}
            className="p-0.5 rounded-full bg-secondary text-muted-foreground hover:text-primary transition-colors"
          >
            <Play className="h-3 w-3" />
          </button>
        </>
      ) : (
        <>
          <Timer className="h-3 w-3 text-muted-foreground/30" />
          <span className="text-[10px] text-muted-foreground/40">Set rest</span>
        </>
      )}
    </button>
  );
}
