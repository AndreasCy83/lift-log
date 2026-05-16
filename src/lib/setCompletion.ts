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

/**
 * Is a numeric field "present"? 0 counts as a real entered value;
 * only null/undefined/NaN are treated as missing.
 */
function present(v: number | null | undefined): boolean {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Does this row have ANY entered data (partial or complete)?
 * Used for finish-workout warning only.
 */
export function hasRequiredSetData(
  set: Pick<WorkoutSet, 'weightKg' | 'reps' | 'distanceKm' | 'durationMinutes'>,
  setType: SetType | undefined,
): boolean {
  const w = present(set.weightKg);
  const r = present(set.reps);
  const d = present(set.distanceKm);
  const t = present(set.durationMinutes);
  switch (setType) {
    case 'WEIGHT_REPS':
      return w || r;
    case 'WEIGHT_TIME':
      return w || t;
    case 'WEIGHT_ONLY':
      return w;
    case 'REPS_DISTANCE':
      return r || d;
    case 'REPS_TIME':
      return r || t;
    default:
      return w || r || d || t;
  }
}

/**
 * Strict required-data check for ALLOWING a set to be toggled ON.
 * RPE is always optional and never required.
 * 0 is a valid entered value; only empty/null/undefined/NaN is missing.
 */
export function getMissingRequiredFields(
  set: Pick<WorkoutSet, 'weightKg' | 'reps' | 'distanceKm' | 'durationMinutes'>,
  setType: SetType | undefined,
): string[] {
  const w = present(set.weightKg);
  const r = present(set.reps);
  const d = present(set.distanceKm);
  const t = present(set.durationMinutes);
  const missing: string[] = [];
  switch (setType) {
    case 'WEIGHT_REPS':
      if (!w) missing.push('weight');
      if (!r) missing.push('reps');
      break;
    case 'WEIGHT_TIME':
      if (!w) missing.push('weight');
      if (!t) missing.push('duration');
      break;
    case 'WEIGHT_ONLY':
      if (!w) missing.push('weight');
      break;
    case 'REPS_DISTANCE':
      if (!r) missing.push('reps');
      if (!d) missing.push('distance');
      break;
    case 'REPS_TIME':
      if (!r) missing.push('reps');
      if (!t) missing.push('duration');
      break;
    default:
      if (!w && !r && !d && !t) missing.push('values');
  }
  return missing;
}

export function canCompleteSet(
  set: Pick<WorkoutSet, 'weightKg' | 'reps' | 'distanceKm' | 'durationMinutes'>,
  setType: SetType | undefined,
): boolean {
  return getMissingRequiredFields(set, setType).length === 0;
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
