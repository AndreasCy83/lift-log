/**
 * Manages active rest timer state via localStorage so timers survive background/resume.
 * Uses timestamp-based approach for accurate countdown after app resume.
 */

const ACTIVE_TIMERS_KEY = 'gym-active-rest-timers';
const LAST_REST_KEY = 'gym-last-rest-seconds';

export interface ActiveRestTimer {
  /** workoutExerciseId + setIndex to identify which separator */
  id: string;
  workoutExerciseId: string;
  afterSetIndex: number;
  totalSeconds: number;
  endAt: number; // Date.now() + totalSeconds * 1000
  /** Track which voice cues have fired */
  cuesFired: number[];
}

export function getActiveTimers(): ActiveRestTimer[] {
  try {
    const raw = localStorage.getItem(ACTIVE_TIMERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** Custom event dispatched whenever active timers change so UI can re-sync. */
export const REST_TIMERS_CHANGED_EVENT = 'rest-timers-changed';

function saveActiveTimers(timers: ActiveRestTimer[]) {
  localStorage.setItem(ACTIVE_TIMERS_KEY, JSON.stringify(timers));
  try {
    window.dispatchEvent(new CustomEvent(REST_TIMERS_CHANGED_EVENT));
  } catch {}
}

export function startRestTimer(
  workoutExerciseId: string,
  afterSetIndex: number,
  totalSeconds: number
): ActiveRestTimer {
  // Enforce single active timer at the workout level: latest started wins.
  // Clear ALL existing timers regardless of exercise/set.
  const timer: ActiveRestTimer = {
    id: `${workoutExerciseId}-${afterSetIndex}`,
    workoutExerciseId,
    afterSetIndex,
    totalSeconds,
    endAt: Date.now() + totalSeconds * 1000,
    cuesFired: [],
  };
  saveActiveTimers([timer]);
  return timer;
}

/** Clear every active rest timer (e.g. on workout finish). */
export function clearAllRestTimers() {
  saveActiveTimers([]);
}

export function clearRestTimer(workoutExerciseId: string, afterSetIndex: number) {
  const timers = getActiveTimers().filter(
    t => !(t.workoutExerciseId === workoutExerciseId && t.afterSetIndex === afterSetIndex)
  );
  saveActiveTimers(timers);
}

export function clearAllTimersForExercise(workoutExerciseId: string) {
  saveActiveTimers(getActiveTimers().filter(t => t.workoutExerciseId !== workoutExerciseId));
}

export function getTimerRemaining(timer: ActiveRestTimer): number {
  return Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
}

export function markCueFired(timerId: string, cueSecond: number) {
  const timers = getActiveTimers();
  const t = timers.find(x => x.id === timerId);
  if (t && !t.cuesFired.includes(cueSecond)) {
    t.cuesFired.push(cueSecond);
    saveActiveTimers(timers);
  }
}

/** Store last-used rest seconds per exercise */
export function getLastUsedRestSeconds(exerciseId: string): number | null {
  try {
    const raw = localStorage.getItem(LAST_REST_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    return map[exerciseId] ?? null;
  } catch { return null; }
}

export function saveLastUsedRestSeconds(exerciseId: string, seconds: number) {
  try {
    const raw = localStorage.getItem(LAST_REST_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[exerciseId] = seconds;
    localStorage.setItem(LAST_REST_KEY, JSON.stringify(map));
  } catch {}
}
