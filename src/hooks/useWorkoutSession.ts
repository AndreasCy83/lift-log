import { useEffect, useState, useCallback } from 'react';
import {
  ActiveWorkoutSession,
  SESSION_CHANGED_EVENT,
  getSessionForWorkout,
  getActiveSession,
  getElapsedMs,
  startSession,
  pauseSession,
  resumeSession,
  endSession,
} from '@/lib/workoutSession';

interface UseWorkoutSessionResult {
  session: ActiveWorkoutSession | null;
  elapsedSec: number;
  isRunning: boolean;
  isPaused: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  /** Stop and clear; returns final elapsed seconds (or null if no session). */
  end: () => number | null;
}

/**
 * Subscribe to the persisted live workout session for a given workoutId.
 * Ticks every 1s while running, derives elapsed from persisted timestamps.
 */
export function useWorkoutSession(workoutId: string | null | undefined): UseWorkoutSessionResult {
  const [session, setSession] = useState<ActiveWorkoutSession | null>(() =>
    workoutId ? getSessionForWorkout(workoutId) : null
  );
  const [, setTick] = useState(0);

  // Refresh from storage on mount + when storage changes (other tabs / explicit events)
  useEffect(() => {
    const sync = () => {
      setSession(workoutId ? getSessionForWorkout(workoutId) : null);
    };
    sync();
    window.addEventListener(SESSION_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SESSION_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [workoutId]);

  // 1s tick while running so the displayed time updates
  useEffect(() => {
    if (!session || session.status !== 'running') return;
    const id = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, [session?.status, session?.workoutId]);

  const start = useCallback(() => {
    if (!workoutId) return;
    setSession(startSession(workoutId));
  }, [workoutId]);

  const pause = useCallback(() => {
    setSession(pauseSession());
  }, []);

  const resume = useCallback(() => {
    setSession(resumeSession());
  }, []);

  const end = useCallback(() => {
    const sec = endSession();
    setSession(null);
    return sec;
  }, []);

  const elapsedSec = session ? Math.floor(getElapsedMs(session) / 1000) : 0;

  return {
    session,
    elapsedSec,
    isRunning: session?.status === 'running',
    isPaused: session?.status === 'paused',
    start,
    pause,
    resume,
    end,
  };
}

/**
 * Lightweight hook for any page that needs to know whether ANY workout session
 * is currently live (used by BottomNav to intercept navigation).
 */
export function useAnyActiveSession(): ActiveWorkoutSession | null {
  const [session, setSession] = useState<ActiveWorkoutSession | null>(() => getActiveSession());
  useEffect(() => {
    const sync = () => setSession(getActiveSession());
    window.addEventListener(SESSION_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(SESSION_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return session;
}
