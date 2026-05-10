/**
 * Single source of truth for whether a workout set should be counted in any
 * app metric (totals, history, PRs, goals, stats, summaries).
 *
 * Rules (per product spec):
 *  - A set is "counted" iff its toggle is ON (`isCompleted === true`).
 *  - Untoggled rows never contribute to any saved/derived metric, even if
 *    values were typed in.
 *  - "Draft" rows = not toggled AND completely blank (no weight/reps/distance/duration).
 *    They must NOT be treated as a meaningful pending set when finishing the workout.
 *  - "Meaningful pending" rows = untoggled rows that have ANY entered data,
 *    whether partial or complete. Used only to decide whether to warn on Finish Workout.
 */
import type { WorkoutSet, SetType } from '@/types/fitness';

/** Universal completion check — use this everywhere instead of bespoke filters. */
export function isCountedSet(set: Pick<WorkoutSet, 'isCompleted'>): boolean {
  return set.isCompleted === true;
}

function n(v: number | null | undefined): number {
  return typeof v === 'number' && v > 0 ? v : 0;
}

/**
 * Does this row have ANY entered data (partial or complete)?
 * Used for finish-workout warning only.
 */
export function hasRequiredSetData(
  set: Pick<WorkoutSet, 'weightKg' | 'reps' | 'distanceKm' | 'durationMinutes'>,
  setType: SetType | undefined,
): boolean {
  const w = n(set.weightKg);
  const r = n(set.reps);
  const d = n(set.distanceKm);
  const t = n(set.durationMinutes);
  switch (setType) {
    case 'WEIGHT_REPS':
      return w > 0 || r > 0;
    case 'WEIGHT_TIME':
      return w > 0 || t > 0;
    case 'WEIGHT_ONLY':
      return w > 0;
    case 'REPS_DISTANCE':
      return r > 0 || d > 0;
    case 'REPS_TIME':
      return r > 0 || t > 0;
    default:
      // Fallback: any positive value counts as "has data".
      return w > 0 || r > 0 || d > 0 || t > 0;
  }
}

/** A draft row = not toggled AND completely blank. */
export function isDraftSet(
  set: Pick<WorkoutSet, 'isCompleted' | 'weightKg' | 'reps' | 'distanceKm' | 'durationMinutes'>,
  setType: SetType | undefined,
): boolean {
  if (isCountedSet(set)) return false;
  return !hasRequiredSetData(set, setType);
}

/** Untoggled, but has any entered data — triggers finish-workout warning. */
export function isMeaningfulPendingSet(
  set: Pick<WorkoutSet, 'isCompleted' | 'weightKg' | 'reps' | 'distanceKm' | 'durationMinutes'>,
  setType: SetType | undefined,
): boolean {
  if (isCountedSet(set)) return false;
  return hasRequiredSetData(set, setType);
}
