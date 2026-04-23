/**
 * Live workout session timer (independent from the rest timer system).
 *
 * Persisted in localStorage so the timer survives app close/reopen.
 * Elapsed time is derived from timestamps to avoid drift while the app is closed.
 *
 * Safeguard: a session whose total active elapsed time exceeds MAX_ACTIVE_MS is
 * considered abandoned and cleared without saving an inflated duration.
 */

const STORAGE_KEY = 'activeWorkoutSession';
export const SESSION_CHANGED_EVENT = 'workout-session-changed';

/** 8 hours of active (non-paused) time before we treat the session as abandoned. */
const MAX_ACTIVE_MS = 8 * 60 * 60 * 1000;

export type SessionStatus = 'running' | 'paused' | 'expired';

export interface ActiveWorkoutSession {
  workoutId: string;
  /** ms epoch when the session was started. */
  startedAt: number;
  /** ms epoch when the session was last paused (null if currently running). */
  pausedAt: number | null;
  /** Accumulated paused milliseconds across previous pause/resume cycles. */
  accumulatedPausedMs: number;
  status: SessionStatus;
}

function read(): ActiveWorkoutSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ActiveWorkoutSession;
  } catch {
    return null;
  }
}

function write(s: ActiveWorkoutSession | null) {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
  try {
    window.dispatchEvent(new CustomEvent(SESSION_CHANGED_EVENT));
  } catch {
    /* noop */
  }
}

/** Compute active elapsed milliseconds (excluding paused time). */
export function getElapsedMs(s: ActiveWorkoutSession, now: number = Date.now()): number {
  const endRef = s.status === 'paused' && s.pausedAt != null ? s.pausedAt : now;
  const total = endRef - s.startedAt - (s.accumulatedPausedMs ?? 0);
  return Math.max(0, total);
}

export function getActiveSession(): ActiveWorkoutSession | null {
  return read();
}

export function getSessionForWorkout(workoutId: string): ActiveWorkoutSession | null {
  const s = read();
  return s && s.workoutId === workoutId ? s : null;
}

/**
 * Start a session for the given workout. If a session already exists for the
 * same workout, return it as-is (resume). If a session exists for a different
 * workout, replace it (the previous one is treated as abandoned).
 */
export function startSession(workoutId: string): ActiveWorkoutSession {
  const existing = read();
  if (existing && existing.workoutId === workoutId && existing.status !== 'expired') {
    return existing;
  }
  const next: ActiveWorkoutSession = {
    workoutId,
    startedAt: Date.now(),
    pausedAt: null,
    accumulatedPausedMs: 0,
    status: 'running',
  };
  write(next);
  return next;
}

export function pauseSession(): ActiveWorkoutSession | null {
  const s = read();
  if (!s || s.status !== 'running') return s;
  const next: ActiveWorkoutSession = {
    ...s,
    pausedAt: Date.now(),
    status: 'paused',
  };
  write(next);
  return next;
}

export function resumeSession(): ActiveWorkoutSession | null {
  const s = read();
  if (!s || s.status !== 'paused' || s.pausedAt == null) return s;
  const pausedFor = Date.now() - s.pausedAt;
  const next: ActiveWorkoutSession = {
    ...s,
    pausedAt: null,
    accumulatedPausedMs: (s.accumulatedPausedMs ?? 0) + Math.max(0, pausedFor),
    status: 'running',
  };
  write(next);
  return next;
}

/**
 * End the session and return the final elapsed seconds. Clears persisted state.
 * Returns null if no session is active.
 */
export function endSession(): number | null {
  const s = read();
  if (!s) return null;
  const elapsedSec = Math.round(getElapsedMs(s) / 1000);
  write(null);
  return elapsedSec;
}

/** Clear without finalizing (e.g. workout deleted). */
export function clearSession() {
  write(null);
}

/**
 * Safeguard: if active elapsed time exceeds MAX_ACTIVE_MS, drop the session so
 * a forgotten timer never records an absurd duration.
 * Call on app start / resume.
 * @returns true if a session was expired and cleared.
 */
export function expireIfStale(): boolean {
  const s = read();
  if (!s) return false;
  if (getElapsedMs(s) > MAX_ACTIVE_MS) {
    write(null);
    return true;
  }
  return false;
}

/** Format a number of seconds as HH:MM:SS. */
export function formatHMS(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
