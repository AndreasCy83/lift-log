/**
 * Adherence / behavior engine (Coach V3).
 *
 * Lightweight, offline, deterministic. Derives a small behavior layer from the
 * user's recent workout history so the coach can interpret signals with the
 * user's actual rhythm and recent lapses in mind. No streak shaming, no
 * gamification — supportive framing only.
 */
import type { Workout, WorkoutExercise, WorkoutSet } from '@/types/fitness';

export type AdherenceStatus = 'on_track' | 'slipping' | 'returning' | 'inactive';
export type ConsistencyState = 'steady' | 'mixed' | 'rebuilding';

export interface AdherenceSnapshot {
  adherenceStatus: AdherenceStatus;
  consistencyState: ConsistencyState;
  weeklyBehaviorSummary: string;
  comebackMode: boolean;
  /** Diagnostics — useful for tests / debugging. */
  daysSinceLastWorkout: number | null;
  sessionsLast7d: number;
  sessionsPrev21d: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseWorkoutTs(w: Workout): number {
  const [y, m, d] = w.date.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0).getTime();
}

/**
 * Compute adherence / behavior snapshot from local workout history.
 *
 * A workout "counts" if it has at least one completed working (non-warmup) set.
 */
export function computeAdherence(
  now: Date,
  workouts: Workout[],
  wes: WorkoutExercise[],
  sets: WorkoutSet[],
): AdherenceSnapshot {
  // Which workouts have ≥1 completed working set?
  const weToWorkout = new Map<string, string>();
  for (const we of wes) weToWorkout.set(we.id, we.workoutId);
  const qualifying = new Set<string>();
  for (const s of sets) {
    if (s.isCompleted !== true) continue;
    if (s.isWarmup || s.setTag === 'W') continue;
    const wid = weToWorkout.get(s.workoutExerciseId);
    if (wid) qualifying.add(wid);
  }

  // Distinct workout-day timestamps (noon-aligned) for qualifying workouts.
  const dayTsSet = new Set<number>();
  for (const w of workouts) {
    if (!qualifying.has(w.id)) continue;
    dayTsSet.add(parseWorkoutTs(w));
  }
  const dayTimestamps = Array.from(dayTsSet).sort((a, b) => b - a);

  const nowMs = now.getTime();
  const last7Cutoff = nowMs - 7 * DAY_MS;
  const last28Cutoff = nowMs - 28 * DAY_MS;
  const prev21Cutoff = nowMs - 7 * DAY_MS; // upper bound for "previous"
  const prev21Lower = nowMs - 28 * DAY_MS;

  const sessionsLast7d = dayTimestamps.filter((t) => t > last7Cutoff && t <= nowMs)
    .length;
  const sessionsPrev21d = dayTimestamps.filter(
    (t) => t > prev21Lower && t <= prev21Cutoff,
  ).length;

  const lastTs = dayTimestamps[0] ?? null;
  const daysSinceLastWorkout =
    lastTs == null ? null : Math.max(0, Math.floor((nowMs - lastTs) / DAY_MS));

  // Baseline sessions/week from the prior 3 weeks. Falls back to 0 if empty.
  const baselinePerWeek = sessionsPrev21d / 3;

  // Detect a "returning" pattern: a recent session preceded by a meaningful gap.
  let returning = false;
  if (lastTs != null && daysSinceLastWorkout != null && daysSinceLastWorkout <= 3) {
    const secondLastTs = dayTimestamps[1] ?? null;
    if (secondLastTs == null) {
      // First-ever (or first in a long time) session — only treat as returning
      // if there's no prior history within 28 days other than this one.
      const priorWithin28 = dayTimestamps
        .slice(1)
        .filter((t) => t > last28Cutoff).length;
      if (priorWithin28 === 0 && sessionsPrev21d === 0) returning = true;
    } else {
      const gapDays = Math.floor((lastTs - secondLastTs) / DAY_MS);
      if (gapDays >= 10) returning = true;
    }
  }

  // Adherence status
  let adherenceStatus: AdherenceStatus;
  if (daysSinceLastWorkout == null || daysSinceLastWorkout > 14) {
    adherenceStatus = 'inactive';
  } else if (returning) {
    adherenceStatus = 'returning';
  } else if (baselinePerWeek >= 1) {
    if (sessionsLast7d >= baselinePerWeek * 0.8) {
      adherenceStatus = 'on_track';
    } else if (sessionsLast7d < baselinePerWeek * 0.6) {
      adherenceStatus = 'slipping';
    } else {
      adherenceStatus = 'on_track';
    }
  } else {
    // No real baseline yet — be lenient.
    adherenceStatus = sessionsLast7d >= 2 ? 'on_track' : 'slipping';
  }

  // Consistency state
  let consistencyState: ConsistencyState;
  if (adherenceStatus === 'returning' || adherenceStatus === 'inactive') {
    consistencyState = 'rebuilding';
  } else if (adherenceStatus === 'slipping') {
    consistencyState = 'mixed';
  } else {
    consistencyState = 'steady';
  }

  // Weekly behavior summary — calm, supportive phrasing only.
  let weeklyBehaviorSummary: string;
  if (adherenceStatus === 'inactive') {
    weeklyBehaviorSummary = 'No recent sessions — ease back in when ready';
  } else if (adherenceStatus === 'returning') {
    weeklyBehaviorSummary = 'Back after a short gap — rebuilding momentum';
  } else if (adherenceStatus === 'slipping') {
    weeklyBehaviorSummary = 'Training rhythm slipped this week';
  } else if (sessionsLast7d <= 1) {
    weeklyBehaviorSummary = 'Light week so far';
  } else if (baselinePerWeek > 0 && sessionsLast7d >= baselinePerWeek * 1.1) {
    weeklyBehaviorSummary = 'Consistency strong this week';
  } else {
    weeklyBehaviorSummary = 'Steady training rhythm this week';
  }

  const comebackMode = adherenceStatus === 'returning';

  return {
    adherenceStatus,
    consistencyState,
    weeklyBehaviorSummary,
    comebackMode,
    daysSinceLastWorkout,
    sessionsLast7d,
    sessionsPrev21d,
  };
}
