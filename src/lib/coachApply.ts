/**
 * Coach "Apply" helper.
 *
 * Turns a final, reconciled Coach recommendation into a planned prescription
 * on the user's next scheduled occurrence of that exercise.
 *
 * Matching rules (strict):
 *   - exact match on exerciseId only (never name-based)
 *   - only future-dated workouts (date >= today)
 *   - only WorkoutExercises with at least one non-completed set, OR with
 *     zero sets at all (we'll seed sets)
 *   - never touch completed workouts / completed sets
 *
 * If no future occurrence is found, a "pending override" is stored under
 * gym-coach-pending-overrides. WorkoutSession / routine runner can consume
 * this later (not wired here — that integration is out of scope).
 *
 * Applied state is keyed by a stable signature derived from the
 * recommendation's payload, so editing the recommendation invalidates the
 * applied marker automatically.
 */
import type { WorkoutSet } from '@/types/fitness';
import type { ProgressionRecommendation } from './progressionEngine';
import {
  generateId,
  getWorkouts,
  getExercisesForWorkout,
  getSetsForWorkoutExercise,
  updateWorkoutSet,
  addWorkoutSet,
  deleteWorkoutSet,
  getExercises,
} from './storage';

const APPLIED_KEY = 'gym-coach-applied-recs-v1';
const PENDING_KEY = 'gym-coach-pending-overrides-v1';
const WE_APPLIED_KEY = 'gym-coach-we-applied-v1';

export interface CoachPrescription {
  exerciseId: string;
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  repInfo: string;
  weightKg: number | null;
  source: 'coach';
  appliedAt: string;
}

export type ApplyOutcome =
  | { kind: 'applied'; workoutId: string; exerciseName: string; whenISO: string }
  | { kind: 'pending'; exerciseName: string }
  | { kind: 'needs_confirm'; workoutExerciseId: string; workoutId: string; exerciseName: string; whenISO: string };

/** Stable per-recommendation signature so applied state survives recompute. */
export function recommendationKey(rec: ProgressionRecommendation): string {
  return [
    'coach',
    rec.exerciseId,
    rec.recommendationType,
    rec.nextSets,
    rec.nextRepInfo,
    rec.nextWeightKg ?? '_',
  ].join(':');
}

/* ----------------------------- applied state ----------------------------- */

function readApplied(): Record<string, string> {
  try {
    const raw = localStorage.getItem(APPLIED_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}
function writeApplied(map: Record<string, string>) {
  try { localStorage.setItem(APPLIED_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}
export function isRecommendationApplied(rec: ProgressionRecommendation): boolean {
  return !!readApplied()[recommendationKey(rec)];
}
function markApplied(rec: ProgressionRecommendation) {
  const m = readApplied();
  m[recommendationKey(rec)] = new Date().toISOString();
  writeApplied(m);
}

/* --------------------------- pending overrides --------------------------- */

function readPending(): Record<string, CoachPrescription> {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CoachPrescription>) : {};
  } catch {
    return {};
  }
}
function writePending(map: Record<string, CoachPrescription>) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}
export function getPendingCoachOverride(exerciseId: string): CoachPrescription | null {
  return readPending()[exerciseId] ?? null;
}
export function clearPendingCoachOverride(exerciseId: string) {
  const m = readPending();
  if (m[exerciseId]) { delete m[exerciseId]; writePending(m); }
}

/* ----------------------------- rep parsing ------------------------------- */

/** "8–12" / "8-12" / "12" / "12 / target 12" → { min, max } */
export function parseRepInfo(info: string): { min: number | null; max: number | null } {
  if (!info) return { min: null, max: null };
  const cleaned = info.replace(/\s+/g, '');
  const range = cleaned.match(/(\d+)[–-](\d+)/);
  if (range) {
    const a = parseInt(range[1], 10);
    const b = parseInt(range[2], 10);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }
  }
  const single = cleaned.match(/(\d+)/);
  if (single) {
    const n = parseInt(single[1], 10);
    if (Number.isFinite(n)) return { min: n, max: n };
  }
  return { min: null, max: null };
}

/* --------------------------- workout matching ---------------------------- */

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** First future workout (date >= today) containing exerciseId with at least
 *  one not-yet-completed working set, ordered by date ascending. */
export function findNextPlannedWorkoutExercise(exerciseId: string):
  | { workoutId: string; workoutExerciseId: string; dateISO: string }
  | null {
  const today = todayISO();
  const future = getWorkouts()
    .filter((w) => w.date >= today && !w.endTime) // not finished
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  for (const w of future) {
    const wes = getExercisesForWorkout(w.id);
    for (const we of wes) {
      if (we.exerciseId !== exerciseId) continue;
      const sets = getSetsForWorkoutExercise(we.id);
      const hasIncomplete = sets.length === 0 || sets.some((s) => !s.isCompleted);
      if (hasIncomplete) {
        return { workoutId: w.id, workoutExerciseId: we.id, dateISO: w.date };
      }
    }
  }
  return null;
}

/** A planned set is "user-edited" if any non-warmup incomplete set already
 *  carries an explicit weight or reps value. */
export function hasUserEditedPlannedValues(workoutExerciseId: string): boolean {
  const sets = getSetsForWorkoutExercise(workoutExerciseId);
  return sets.some(
    (s) =>
      !s.isCompleted &&
      !s.isWarmup &&
      s.setTag !== 'W' &&
      ((s.weightKg != null && s.weightKg > 0) ||
        (s.reps != null && s.reps > 0)),
  );
}

/* ------------------------------- apply ----------------------------------- */

function buildPrescription(rec: ProgressionRecommendation): CoachPrescription {
  const { min, max } = parseRepInfo(rec.nextRepInfo);
  return {
    exerciseId: rec.exerciseId,
    sets: Math.max(1, rec.nextSets),
    repsMin: min,
    repsMax: max,
    repInfo: rec.nextRepInfo,
    weightKg: rec.nextWeightKg,
    source: 'coach',
    appliedAt: new Date().toISOString(),
  };
}

function writePrescriptionToWE(workoutExerciseId: string, p: CoachPrescription) {
  const existing = getSetsForWorkoutExercise(workoutExerciseId);
  // Preserve completed and warmup sets; only manage normal incomplete sets.
  const keepers = existing.filter(
    (s) => s.isCompleted || s.isWarmup || s.setTag === 'W',
  );
  const editable = existing.filter(
    (s) => !s.isCompleted && !s.isWarmup && s.setTag !== 'W',
  );

  const targetReps = p.repsMax ?? p.repsMin ?? null;
  const desired = p.sets;

  // Update or add up to `desired` editable sets.
  const baseIndex = keepers.length;
  for (let i = 0; i < desired; i += 1) {
    const slot = editable[i];
    if (slot) {
      const updated: WorkoutSet = {
        ...slot,
        weightKg: p.weightKg,
        reps: targetReps,
        isCompleted: false,
      };
      updateWorkoutSet(updated);
    } else {
      const fresh: WorkoutSet = {
        id: generateId(),
        workoutExerciseId,
        setIndex: baseIndex + i,
        setTag: 'N',
        weightKg: p.weightKg,
        reps: targetReps,
        distanceKm: null,
        durationMinutes: null,
        rpe: null,
        isWarmup: false,
        isCompleted: false,
        notes: '',
      };
      addWorkoutSet(fresh);
    }
  }
  // Remove any extra editable sets beyond desired count.
  for (let i = desired; i < editable.length; i += 1) {
    deleteWorkoutSet(editable[i].id);
  }
}

/** Apply a Coach recommendation. Pass `force=true` to overwrite user edits
 *  after a confirm step. */
export function applyCoachRecommendation(
  rec: ProgressionRecommendation,
  opts: { force?: boolean } = {},
): ApplyOutcome {
  const exName =
    getExercises().find((e) => e.id === rec.exerciseId)?.name ?? rec.exerciseName;
  const target = findNextPlannedWorkoutExercise(rec.exerciseId);
  const p = buildPrescription(rec);

  if (!target) {
    const m = readPending();
    m[rec.exerciseId] = p;
    writePending(m);
    markApplied(rec);
    return { kind: 'pending', exerciseName: exName };
  }

  if (!opts.force && hasUserEditedPlannedValues(target.workoutExerciseId)) {
    return {
      kind: 'needs_confirm',
      workoutExerciseId: target.workoutExerciseId,
      workoutId: target.workoutId,
      exerciseName: exName,
      whenISO: target.dateISO,
    };
  }

  writePrescriptionToWE(target.workoutExerciseId, p);
  // If we just landed on a real session, drop any stale pending override.
  clearPendingCoachOverride(rec.exerciseId);
  markApplied(rec);
  return {
    kind: 'applied',
    workoutId: target.workoutId,
    exerciseName: exName,
    whenISO: target.dateISO,
  };
}
