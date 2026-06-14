/**
 * Progression engine — deterministic, offline next-session recommendations
 * for a single exercise based on its recent exposures.
 *
 * Pure functions only. No storage / no React. The orchestrator in
 * coachRecommendations.ts gathers exposures and feeds them in here.
 *
 * V1 semantics:
 *   - `load_progression`  → add load at the same rep target
 *   - `rep_progression`   → keep load, add a rep (lower stakes than load+)
 *   - `hold`              → maintain prescription (signal unclear or fatigued)
 *   - `set_reduce`        → drop a set (volume trend up, or guardrail)
 *   - `set_increase`      → add a set (volume trend down, guardrail allows)
 *   - `deload_adjustment` → reserved for orchestrator/deload-aware adjustments
 */
import type { Exercise, WorkoutSet } from '@/types/fitness';
import { THRESHOLDS } from './coachThresholds';

export interface ExposureSummary {
  /** Sorted ascending: oldest set first. */
  dateISO: string;
  workingSets: number;
  avgReps: number;
  topWeightKg: number | null;
  avgRPE: number | null;
}

export type ProgressionType =
  | 'load_progression'
  | 'rep_progression'
  | 'hold'
  | 'set_reduce'
  | 'set_increase'
  | 'deload_adjustment';

export interface ProgressionRecommendation {
  exerciseId: string;
  exerciseName: string;
  recommendationType: ProgressionType;
  currentSets: number;
  nextSets: number;
  currentRepInfo: string;
  nextRepInfo: string;
  currentWeightKg: number | null;
  nextWeightKg: number | null;
  confidence: 'low' | 'medium' | 'high';
  reasons: string[];
  guardrailBlocked: boolean;
  createdAt: string;
  /** V2: short user-facing action label (set by orchestrator). */
  mainAction?: string;
  /** V2: 1–3 concise reasons surfaced in the UI (set by orchestrator). */
  topReasons?: string[];
}

/** Build an exposure summary from a single workout's working sets for one exercise. */
export function summarizeExposure(
  dateISO: string,
  sets: WorkoutSet[],
): ExposureSummary | null {
  const working = sets.filter(
    (s) => s.isCompleted === true && !s.isWarmup && s.setTag !== 'W',
  );
  if (working.length === 0) return null;

  const repsList = working.map((s) => s.reps ?? 0).filter((r) => r > 0);
  const avgReps =
    repsList.length > 0
      ? repsList.reduce((a, b) => a + b, 0) / repsList.length
      : 0;

  const weights = working.map((s) => s.weightKg ?? 0).filter((w) => w > 0);
  const topWeightKg = weights.length > 0 ? Math.max(...weights) : null;

  const rpes = working
    .map((s) => s.rpe)
    .filter((r): r is number => typeof r === 'number');
  const avgRPE =
    rpes.length > 0 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;

  return {
    dateISO,
    workingSets: working.length,
    avgReps,
    topWeightKg,
    avgRPE,
  };
}

function roundIncrement(currentKg: number): number {
  if (currentKg < 20) return 1.25;
  return 2.5;
}

function fmtRepRange(min: number | null, max: number | null, fallback: number): string {
  if (min && max && min !== max) return `${min}–${max}`;
  if (max) return `${max}`;
  if (min) return `${min}`;
  return `${Math.round(fallback)}`;
}

/**
 * Core progression rule. Returns null when there is not enough history to
 * say anything meaningful.
 *
 * `exposures` is expected sorted descending (most recent first).
 */
export function recommendProgression(
  exercise: Exercise,
  exposures: ExposureSummary[],
): ProgressionRecommendation | null {
  if (exposures.length === 0) return null;

  // Sparse history → stay silent. Avoids loud "progression ready" calls
  // built off a single workout.
  if (exposures.length < THRESHOLDS.minExposuresForAnyProgression) return null;

  const last = exposures[0];
  const prior = exposures[1] ?? null;

  if (exercise.type === 'CARDIO') return null;
  if (exercise.setType !== 'WEIGHT_REPS' && exercise.setType !== 'WEIGHT_ONLY') {
    return null;
  }

  const repsMin = exercise.defaultRepsMin;
  const repsMax = exercise.defaultRepsMax;
  const targetTop = repsMax ?? Math.max(8, Math.round(last.avgReps + 1));

  const reasons: string[] = [];
  let type: ProgressionType = 'hold';
  const nextSets = last.workingSets;
  let nextWeightKg = last.topWeightKg;
  let nextRepsLabel = fmtRepRange(repsMin, repsMax, last.avgReps);
  let confidence: 'low' | 'medium' | 'high' = 'low';

  const rpe = last.avgRPE;
  const rpeRising =
    rpe != null && prior?.avgRPE != null && rpe - prior.avgRPE >= THRESHOLDS.rpeRiseDelta;
  const regressed = !!prior && last.avgReps + 0.5 < prior.avgReps;
  const fatigued =
    (rpe != null && rpe >= THRESHOLDS.rpeFatigueHard) || rpeRising || regressed;

  if (fatigued) {
    type = 'hold';
    if (regressed) reasons.push('Reps regressed vs last session');
    if (rpeRising) reasons.push('Effort rising at similar load');
    if (rpe != null && rpe >= THRESHOLDS.rpeFatigueHard) reasons.push('High RPE last session');
    confidence = 'medium';
  } else if (
    last.topWeightKg != null &&
    last.avgReps >= targetTop &&
    exposures.length >= THRESHOLDS.minExposuresForLoadIncrease
  ) {
    // Load progression — strongest signal, needs enough history
    const inc = roundIncrement(last.topWeightKg);
    nextWeightKg = Math.round((last.topWeightKg + inc) * 100) / 100;
    nextRepsLabel = fmtRepRange(repsMin, repsMax, last.avgReps);
    type = 'load_progression';
    reasons.push(`Hit top of rep range (${Math.round(last.avgReps)}× ≥ ${targetTop})`);
    confidence = exposures.length >= 4 ? 'high' : 'medium';
  } else if (last.avgReps < targetTop && prior && last.avgReps >= prior.avgReps - 0.5) {
    // Rep progression — same load, push reps. Lower-stakes nudge.
    // Require at least a stable/improving rep trend vs prior session.
    type = 'rep_progression';
    nextWeightKg = last.topWeightKg;
    nextRepsLabel = `${Math.min(targetTop, Math.round(last.avgReps + 1))}${
      repsMax ? ` / target ${targetTop}` : ''
    }`;
    reasons.push('Add a rep at the same load next session');
    confidence = 'low';
  } else {
    type = 'hold';
    reasons.push('Maintain current prescription');
    confidence = 'low';
  }

  return {
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    recommendationType: type,
    currentSets: last.workingSets,
    nextSets,
    currentRepInfo: `${Math.round(last.avgReps)}`,
    nextRepInfo: nextRepsLabel,
    currentWeightKg: last.topWeightKg,
    nextWeightKg,
    confidence,
    reasons,
    guardrailBlocked: false,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Apply weekly volume trend & guardrail to a progression rec in-place.
 *
 * IMPORTANT: when this materially changes set count, also rewrite the
 * recommendationType so downstream ranking/UI shows the real intent
 * (e.g. don't keep calling it "load_progression" when we just cut a set).
 */
export function applyVolumeTrend(
  rec: ProgressionRecommendation,
  trendPct: number,
  guardrailHigh: boolean,
): void {
  if (trendPct >= THRESHOLDS.volumeTrendPct) {
    // Weekly volume climbing — reduce sets next session
    if (rec.nextSets > 1) {
      rec.nextSets = rec.currentSets - 1;
      // Set reduction supersedes any forward-progression label so the user
      // doesn't see "progression ready" while we're actually backing off.
      rec.recommendationType = 'set_reduce';
      // Cancel a load bump — we're cutting volume, not adding stress.
      rec.nextWeightKg = rec.currentWeightKg;
      rec.reasons.push(
        `Weekly volume up >${Math.round(THRESHOLDS.volumeTrendPct * 100)}% — drop a set`,
      );
    }
  } else if (trendPct <= -THRESHOLDS.volumeTrendPct) {
    if (guardrailHigh) {
      rec.guardrailBlocked = true;
      rec.reasons.push('Set increase blocked — muscle already heavily loaded');
    } else {
      rec.nextSets = rec.currentSets + 1;
      // Only relabel if we weren't already doing a load bump. A real
      // load_progression is a stronger signal and should stay primary.
      if (
        rec.recommendationType !== 'load_progression' &&
        rec.recommendationType !== 'rep_progression'
      ) {
        rec.recommendationType = 'set_increase';
      }
      rec.reasons.push(
        `Weekly volume down >${Math.round(THRESHOLDS.volumeTrendPct * 100)}% — add a set`,
      );
    }
  }
}
