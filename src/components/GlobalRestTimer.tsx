import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import FloatingRestTimer from './FloatingRestTimer';
import {
  getCurrentRestTimer,
  REST_TIMERS_CHANGED_EVENT,
  type ActiveRestTimer,
} from '@/lib/restTimerState';
import { getActiveSession } from '@/lib/workoutSession';
import { getWorkouts } from '@/lib/storage';

/**
 * Global minimized rest-timer pill rendered above the bottom navigation.
 * Only shown on non-workout routes. Tapping it returns the user to the
 * active workout screen, where the full FloatingRestTimer is mounted.
 */
export default function GlobalRestTimer() {
  const location = useLocation();
  const navigate = useNavigate();
  const [timer, setTimer] = useState<ActiveRestTimer | null>(() => getCurrentRestTimer());

  useEffect(() => {
    const sync = () => setTimer(getCurrentRestTimer());
    sync();
    window.addEventListener(REST_TIMERS_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(REST_TIMERS_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (!timer) return null;
  // Workout page renders its own FloatingRestTimer with full controls.
  if (location.pathname.startsWith('/workout/')) return null;

  const handleTap = () => {
    const session = getActiveSession();
    let date: string | undefined;
    if (session) {
      const w = getWorkouts().find(x => x.id === session.workoutId);
      date = w?.date;
    }
    if (!date) {
      // Fallback: today's workout date.
      date = new Date().toISOString().slice(0, 10);
    }
    navigate(`/workout/${date}`);
  };

  return (
    <FloatingRestTimer
      bottomOffset={72}
      forceMinimized
      onMinimizedClick={handleTap}
    />
  );
}
