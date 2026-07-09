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
  getLatestSetsForExercise,
} from './storage';

/**
 * Return the ordered per-set reps of the most recent completed working
 * sets for an exercise. Used as a fallback rep baseline when the planned
 * workout has no existing per-set rep values (blank template) so we can
 * still preserve the user's actual pattern (e.g. 19/14) instead of
 * flattening to a single target value.
 */
function getPreviousWorkingSetReps(exerciseId: string): number[] {
  const sets = getLatestSetsForExercise(exerciseId)
    .filter((s) => s.isCompleted && !s.isWarmup && s.setTag !== 'W')
    .sort((a, b) => a.setIndex - b.setIndex);
  return sets
    .map((s) => (typeof s.reps === 'number' && s.reps > 0 ? s.reps : null))
    .filter((r): r is number => r != null);
}

const APPLIED_KEY = 'gym-coach-applied-recs-v1';
const PENDING_KEY = 'gym-coach-pending-overrides-v1';
const WE_APPLIED_KEY = 'gym-coach-we-applied-v1';
const DEFERRED_KEY = 'gym-coach-deferred-recs-v1';

/** Fixed "Review Later" window. Single source of truth, no user picker. */
export const COACH_DEFER_DAYS = 12;
const COACH_DEFER_MS = COACH_DEFER_DAYS * 24 * 60 * 60 * 1000;

export interface CoachPrescription {
  exerciseId: string;
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  repInfo: string;
  weightKg: number | null;
  /**
   * Baseline rep target this recommendation is relative to (parsed from
   * rec.currentRepInfo). Used to apply the rep change as a per-set DELTA
   * so a staggered/descending working-set pattern (e.g. 12/10/8) is
   * preserved rather than flattened to one identical rep value.
   */
  baselineReps: number | null;
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

/* --------------------------- deferred state ----------------------------- */
/** Shared "Review Later" state keyed by recommendation signature.
 *  Tied to recommendationKey() so meaningful payload changes invalidate
 *  the deferral automatically. */

interface DeferredEntry {
  /** ISO timestamp when defer was set. */
  at: string;
  /** ISO timestamp when defer expires. */
  until: string;
}

function readDeferred(): Record<string, DeferredEntry> {
  try {
    const raw = localStorage.getItem(DEFERRED_KEY);
    return raw ? (JSON.parse(raw) as Record<string, DeferredEntry>) : {};
  } catch {
    return {};
  }
}
function writeDeferred(map: Record<string, DeferredEntry>) {
  try { localStorage.setItem(DEFERRED_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

/** True if rec is currently within its defer window. Expired entries are
 *  garbage-collected on read. */
export function isRecommendationDeferred(rec: ProgressionRecommendation): boolean {
  const key = recommendationKey(rec);
  const map = readDeferred();
  const entry = map[key];
  if (!entry) return false;
  const now = Date.now();
  if (new Date(entry.until).getTime() <= now) {
    delete map[key];
    writeDeferred(map);
    return false;
  }
  return true;
}

/** Mark a recommendation as "Review Later" for COACH_DEFER_DAYS. */
export function deferRecommendation(rec: ProgressionRecommendation): DeferredEntry {
  const now = Date.now();
  const entry: DeferredEntry = {
    at: new Date(now).toISOString(),
    until: new Date(now + COACH_DEFER_MS).toISOString(),
  };
  const map = readDeferred();
  map[recommendationKey(rec)] = entry;
  writeDeferred(map);
  return entry;
}

export function clearDeferredRecommendation(rec: ProgressionRecommendation) {
  const map = readDeferred();
  const key = recommendationKey(rec);
  if (map[key]) { delete map[key]; writeDeferred(map); }
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

/* --------------------- per-WorkoutExercise applied state --------------------- */

interface WEAppliedEntry {
  exerciseId: string;
  prescription: CoachPrescription;
}
function readWEApplied(): Record<string, WEAppliedEntry> {
  try {
    const raw = localStorage.getItem(WE_APPLIED_KEY);
    return raw ? (JSON.parse(raw) as Record<string, WEAppliedEntry>) : {};
  } catch {
    return {};
  }
}
function writeWEApplied(map: Record<string, WEAppliedEntry>) {
  try { localStorage.setItem(WE_APPLIED_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}
export function getCoachAppliedToWE(workoutExerciseId: string): CoachPrescription | null {
  return readWEApplied()[workoutExerciseId]?.prescription ?? null;
}
export function isWECoachApplied(workoutExerciseId: string): boolean {
  return !!readWEApplied()[workoutExerciseId];
}
export function clearCoachAppliedToWE(workoutExerciseId: string) {
  const m = readWEApplied();
  if (m[workoutExerciseId]) { delete m[workoutExerciseId]; writeWEApplied(m); }
}
function markWEApplied(workoutExerciseId: string, exerciseId: string, p: CoachPrescription) {
  const m = readWEApplied();
  m[workoutExerciseId] = { exerciseId, prescription: p };
  writeWEApplied(m);
}
export { markWEApplied as markCoachAppliedToWE };

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
  const cur = parseRepInfo(rec.currentRepInfo);
  const baselineReps = cur.max ?? cur.min ?? null;
  return {
    exerciseId: rec.exerciseId,
    sets: Math.max(1, rec.nextSets),
    repsMin: min,
    repsMax: max,
    repInfo: rec.nextRepInfo,
    weightKg: rec.nextWeightKg,
    baselineReps,
    source: 'coach',
    appliedAt: new Date().toISOString(),
  };
}

export { buildPrescription };

/**
 * Compute the new prescribed reps for a single working set, preserving the
 * existing per-set rep structure. The recommendation is applied as a DELTA
 * relative to the baseline it was computed against, so a staggered pattern
 * like 12/10/8 with "+1 rep" becomes 13/11/9 rather than 13/13/13.
 */
function computeSetReps(
  existingReps: number | null | undefined,
  targetReps: number | null,
  baselineReps: number | null,
): number | null {
  const hasExisting = existingReps != null && existingReps > 0;
  // Delta mode: both target and baseline known.
  if (targetReps != null && baselineReps != null) {
    const delta = targetReps - baselineReps;
    if (hasExisting) return Math.max(1, (existingReps as number) + delta);
    // No existing per-set value: fall back to the flat target.
    return Math.max(1, targetReps);
  }
  // Target known but no baseline (nothing to diff against): only seed empty
  // sets; never overwrite an existing per-set rep value.
function computeSetReps(
  existingReps: number | null | undefined,
  targetReps: number | null,
  baselineReps: number | null,
  previousReps?: number | null,
): number | null {
  const hasExisting = existingReps != null && existingReps > 0;
  // Prefer the planned value if the user already has one; otherwise fall
  // back to the most recent completed session's per-set reps so a staggered
  // pattern (e.g. 19/14) is preserved instead of collapsing to a flat target.
  const anchor: number | null = hasExisting
    ? (existingReps as number)
    : previousReps != null && previousReps > 0
      ? previousReps
      : null;

  // Delta mode: apply the (target - baseline) change to whatever anchor we have.
  if (targetReps != null && baselineReps != null) {
    const delta = targetReps - baselineReps;
    if (anchor != null) return Math.max(1, anchor + delta);
    return Math.max(1, targetReps);
  }
  // Target known but no baseline: only seed empty sets; never overwrite an
  // existing per-set rep value.
  if (targetReps != null) {
    if (hasExisting) return existingReps as number;
    return anchor ?? targetReps;
  }
  return anchor;
}

export function writePrescriptionToWE(workoutExerciseId: string, p: CoachPrescription) {
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
  const prev = getPreviousWorkingSetReps(p.exerciseId);

  // Update or add up to `desired` editable sets.
  const baseIndex = keepers.length;
  for (let i = 0; i < desired; i += 1) {
    const slot = editable[i];
    const prevAtIdx = prev[i] ?? prev[prev.length - 1] ?? null;
    if (slot) {
      const updated: WorkoutSet = {
        ...slot,
        weightKg: p.weightKg,
        reps: computeSetReps(slot.reps, targetReps, p.baselineReps, prevAtIdx),
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
        reps: computeSetReps(null, targetReps, p.baselineReps, prevAtIdx),
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


/**
 * Override every non-warmup, incomplete working set on a freshly-populated
 * WorkoutExercise with a pending Coach prescription. Does NOT add, remove,
 * or reorder sets — set count is authoritatively driven by the routine
 * template / previous session. Coach only overrides load and reps.
 *
 * This is what makes an applied Coach recommendation win over both routine
 * template defaults AND copied-forward previous values when a routine is run.
 * The pending override is intentionally NOT cleared here so that repeated
 * routine runs (e.g. re-running today's routine) keep applying it until Coach
 * itself recomputes and overwrites it.
 */
export function applyPendingOverrideOnCreate(
  workoutExerciseId: string,
  exerciseId: string,
): boolean {
  const pending = getPendingCoachOverride(exerciseId);
  if (!pending) return false;
  const targetReps = pending.repsMax ?? pending.repsMin ?? null;
  const sets = getSetsForWorkoutExercise(workoutExerciseId)
    .slice()
    .sort((a, b) => a.setIndex - b.setIndex);
  const prev = getPreviousWorkingSetReps(exerciseId);
  let touched = false;
  let editableIdx = 0;
  for (const s of sets) {
    if (s.isCompleted || s.isWarmup || s.setTag === 'W') continue;
    const prevAtIdx = prev[editableIdx] ?? prev[prev.length - 1] ?? null;
    updateWorkoutSet({
      ...s,
      weightKg: pending.weightKg,
      reps: computeSetReps(s.reps, targetReps, pending.baselineReps, prevAtIdx),
    });
    touched = true;
    editableIdx += 1;
  }
  if (touched) markWEApplied(workoutExerciseId, exerciseId, pending);
  return touched;
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

  // Always persist a pending override so subsequent routine runs (which
  // rebuild today's workout from scratch) still surface the Coach change.
  const pendingMap = readPending();
  pendingMap[rec.exerciseId] = p;
  writePending(pendingMap);

  if (!target) {
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
  markWEApplied(target.workoutExerciseId, rec.exerciseId, p);
  markApplied(rec);
  return {
    kind: 'applied',
    workoutId: target.workoutId,
    exerciseName: exName,
    whenISO: target.dateISO,
  };
}
