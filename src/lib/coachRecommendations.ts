/**
 * Coach recommendations orchestrator.
 *
 * Combines progression, weekly volume trend, muscle-load guardrails, and a
 * fatigue/deload check into a single output that the Home card consumes.
 *
 * Fully offline / deterministic / local-only.
 */
import type { Exercise, Workout, WorkoutSet, WorkoutExercise } from '@/types/fitness';
import {
  getExercises,
  getWorkouts,
  getWorkoutExercises,
  getWorkoutSets,
} from './storage';
import {
  getSetMuscleCredits,
  classifyVolumeForCategory,
  type VolumeStatus,
} from './volumeInsights';
import { computeMuscleFatigue } from './recoveryFatigue';
import {
  summarizeExposure,
  recommendProgression,
  applyVolumeTrend,
  type ExposureSummary,
  type ProgressionRecommendation,
} from './progressionEngine';
import {
  recommendDeload,
  type DeloadRecommendation,
  type WeeklyVolumeSnapshot,
  type KeyLiftRPE,
} from './fatigueEngine';
import { THRESHOLDS } from './coachThresholds';
import {
  computeAdherence,
  type AdherenceStatus,
  type ConsistencyState,
} from './adherenceEngine';

export type { ProgressionRecommendation, DeloadRecommendation };
export type { AdherenceStatus, ConsistencyState };

export type CoachState = 'train' | 'adapt' | 'recover';

export interface CoachSnapshot {
  generatedAt: string;
  items: ProgressionRecommendation[];
  deload: DeloadRecommendation | null;
  /** V2: top-level interpreted training state derived from final snapshot. */
  state: CoachState;
  /** V2: short user-facing trend summary string. */
  trendSummary: string;
  /** V2: one-line summary the card can render as-is. */
  summaryLine: string;
  /** V3: adherence / behavior layer. */
  adherenceStatus: AdherenceStatus;
  consistencyState: ConsistencyState;
  weeklyBehaviorSummary: string;
  comebackMode: boolean;
}

const STORAGE_KEY = 'gym-coach-recs-v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const HIGH_STATUSES = new Set<VolumeStatus>(['high', 'very_high']);

function parseWorkoutTs(w: Workout): number {
  const [y, m, d] = w.date.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0).getTime();
}

interface WeeklyCredits {
  /** category id -> weekly sets credit */
  byCategory: Map<string, number>;
  /** exerciseId -> { sets, avgReps, avgRPE } aggregated for the week */
  byExercise: Map<
    string,
    { sets: number; reps: number[]; rpes: number[] }
  >;
}

/** Aggregate working-set credits for all workouts whose timestamp falls in [startMs, endMs). */
function aggregateWeek(
  startMs: number,
  endMs: number,
  workouts: Workout[],
  wes: WorkoutExercise[],
  sets: WorkoutSet[],
  exMap: Map<string, Exercise>,
): WeeklyCredits {
  const validWorkoutIds = new Set(
    workouts
      .filter((w) => {
        const ts = parseWorkoutTs(w);
        return ts >= startMs && ts < endMs;
      })
      .map((w) => w.id),
  );
  const weToEx = new Map<string, string>();
  const validWeIds = new Set<string>();
  for (const we of wes) {
    if (validWorkoutIds.has(we.workoutId)) {
      validWeIds.add(we.id);
      weToEx.set(we.id, we.exerciseId);
    }
  }
  const byCategory = new Map<string, number>();
  const byExercise = new Map<string, { sets: number; reps: number[]; rpes: number[] }>();
  for (const s of sets) {
    if (!validWeIds.has(s.workoutExerciseId)) continue;
    if (s.isCompleted !== true) continue;
    if (s.isWarmup || s.setTag === 'W') continue;
    const exId = weToEx.get(s.workoutExerciseId);
    if (!exId) continue;
    const ex = exMap.get(exId);
    if (!ex) continue;
    const credits = getSetMuscleCredits(ex);
    for (const [catId, w] of credits) {
      byCategory.set(catId, (byCategory.get(catId) ?? 0) + w);
    }
    const agg = byExercise.get(exId) ?? { sets: 0, reps: [], rpes: [] };
    agg.sets += 1;
    if (s.reps && s.reps > 0) agg.reps.push(s.reps);
    if (typeof s.rpe === 'number') agg.rpes.push(s.rpe);
    byExercise.set(exId, agg);
  }
  return { byCategory, byExercise };
}

/** Build per-exercise exposures (most recent first) within the lookback window. */
function buildExposuresByExercise(
  now: Date,
  workouts: Workout[],
  wes: WorkoutExercise[],
  sets: WorkoutSet[],
): Map<string, ExposureSummary[]> {
  const cutoff = now.getTime() - THRESHOLDS.exposureLookbackDays * DAY_MS;
  const validWorkouts = workouts
    .filter((w) => parseWorkoutTs(w) >= cutoff && parseWorkoutTs(w) <= now.getTime() + DAY_MS)
    .sort((a, b) => parseWorkoutTs(b) - parseWorkoutTs(a));

  const wesByWorkout = new Map<string, WorkoutExercise[]>();
  for (const we of wes) {
    const list = wesByWorkout.get(we.workoutId) ?? [];
    list.push(we);
    wesByWorkout.set(we.workoutId, list);
  }
  const setsByWe = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    const list = setsByWe.get(s.workoutExerciseId) ?? [];
    list.push(s);
    setsByWe.set(s.workoutExerciseId, list);
  }

  const out = new Map<string, ExposureSummary[]>();
  for (const w of validWorkouts) {
    const wesOfWorkout = wesByWorkout.get(w.id) ?? [];
    for (const we of wesOfWorkout) {
      const weSets = setsByWe.get(we.id) ?? [];
      const summary = summarizeExposure(w.date, weSets);
      if (!summary) continue;
      const list = out.get(we.exerciseId) ?? [];
      list.push(summary);
      out.set(we.exerciseId, list);
    }
  }
  return out;
}

function avg(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function computeCoachRecommendations(now: Date = new Date()): CoachSnapshot {
  const exercises = getExercises();
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const workouts = getWorkouts();
  const wes = getWorkoutExercises();
  const sets = getWorkoutSets();

  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const wkEnd = endOfToday.getTime();
  const thisWeekStart = wkEnd - 7 * DAY_MS;
  const lastWeekStart = wkEnd - 14 * DAY_MS;
  const twoWeeksAgoStart = wkEnd - 21 * DAY_MS;

  const thisWeek = aggregateWeek(thisWeekStart, wkEnd, workouts, wes, sets, exMap);
  const lastWeek = aggregateWeek(lastWeekStart, thisWeekStart, workouts, wes, sets, exMap);
  const twoWeeksAgo = aggregateWeek(
    twoWeeksAgoStart,
    lastWeekStart,
    workouts,
    wes,
    sets,
    exMap,
  );

  const exposuresByEx = buildExposuresByExercise(now, workouts, wes, sets);

  // --- Build progression items, then apply trend + guardrails ---
  const items: ProgressionRecommendation[] = [];
  /** Track each item's primary muscle category so we can cap set-increases per group. */
  const primaryCatByExId = new Map<string, string>();
  for (const [exId, exposures] of exposuresByEx) {
    const ex = exMap.get(exId);
    if (!ex) continue;
    const rec = recommendProgression(ex, exposures);
    if (!rec) continue;

    const credits = getSetMuscleCredits(ex);
    const primaryCat = credits[0]?.[0] ?? ex.categoryId;
    const primaryWeight = credits[0]?.[1] ?? 1;
    primaryCatByExId.set(exId, primaryCat);

    const thisCat = thisWeek.byCategory.get(primaryCat) ?? 0;
    const lastCat = lastWeek.byCategory.get(primaryCat) ?? 0;
    const trend =
      lastCat > 0 ? (thisCat - lastCat) / lastCat : thisCat > 0 ? 1 : 0;

    // Guardrail: would adding 1 more set push this muscle into high zone?
    const projected = thisCat + primaryWeight;
    const projectedStatus = classifyVolumeForCategory(primaryCat, projected);
    const guardrailHigh = HIGH_STATUSES.has(projectedStatus);

    applyVolumeTrend(rec, trend, guardrailHigh);
    items.push(rec);
  }

  // Filter trivial holds with no signal to reduce noise — keep only items that
  // actually change something or have a clear reason worth surfacing.
  const meaningful = items.filter((it) => {
    if (it.recommendationType !== 'hold') return true;
    return it.reasons.some(
      (r) => /regressed|rising|High RPE|blocked/i.test(r),
    );
  });

  // Rank: load_progression > rep_progression > set_increase > set_reduce
  //       > deload_adjustment > hold; tie-break by confidence.
  // Set increases are intentionally ranked BELOW load and rep progression so
  // Coach prefers intensity/rep changes before expanding workout duration.
  const rank: Record<string, number> = {
    load_progression: 6,
    rep_progression: 5,
    set_increase: 4,
    set_reduce: 3,
    deload_adjustment: 2,
    hold: 1,
  };
  const confRank = { high: 3, medium: 2, low: 1 } as const;
  meaningful.sort((a, b) => {
    const r = (rank[b.recommendationType] ?? 0) - (rank[a.recommendationType] ?? 0);
    if (r !== 0) return r;
    return confRank[b.confidence] - confRank[a.confidence];
  });

  // --- Guardrail: cap set-increase recommendations ---
  // Adding sets balloons workout duration, so keep set_increase rare:
  //   - at most 1 set_increase per primary muscle group, and
  //   - at most 2 set_increase recommendations across the whole snapshot.
  // Demoted items become 'hold' (load/weight reset to current) and keep a
  // short reason so the UI still explains why no extra set was prescribed.
  const MAX_SET_INCREASE_TOTAL = 2;
  const seenSetIncreaseCats = new Set<string>();
  let setIncreaseCount = 0;
  // Strongest candidates come first thanks to the sort above (confidence
  // tie-break), so the first match per group wins.
  const sortedSetIncreases = meaningful
    .filter((it) => it.recommendationType === 'set_increase')
    .sort((a, b) => confRank[b.confidence] - confRank[a.confidence]);
  const keptSetIncreaseIds = new Set<string>();
  for (const it of sortedSetIncreases) {
    if (setIncreaseCount >= MAX_SET_INCREASE_TOTAL) break;
    const cat = primaryCatByExId.get(it.exerciseId) ?? '';
    if (seenSetIncreaseCats.has(cat)) continue;
    seenSetIncreaseCats.add(cat);
    keptSetIncreaseIds.add(it.exerciseId);
    setIncreaseCount += 1;
  }
  for (const it of meaningful) {
    if (it.recommendationType !== 'set_increase') continue;
    if (keptSetIncreaseIds.has(it.exerciseId)) continue;
    // Demote: keep current sets, drop the "add a set" framing.
    it.recommendationType = 'hold';
    it.nextSets = it.currentSets;
    it.nextWeightKg = it.currentWeightKg;
    it.confidence = 'low';
    it.reasons = [
      'Holding sets — prefer load or rep progression before adding volume',
    ];
  }

  // --- Build deload snapshot ---
  const fatigue = computeMuscleFatigue(now);

  function snapshot(week: WeeklyCredits): WeeklyVolumeSnapshot {
    return {
      byCategory: Array.from(week.byCategory.entries()).map(([cid, v]) => ({
        categoryId: cid,
        weeklySets: v,
        status: classifyVolumeForCategory(cid, v),
      })),
    };
  }

  // Key lifts = top exercises by working-set count this week
  const keyLiftIds = Array.from(thisWeek.byExercise.entries())
    .sort((a, b) => b[1].sets - a[1].sets)
    .slice(0, 5)
    .map(([id]) => id);

  const keyLifts: KeyLiftRPE[] = keyLiftIds.map((id) => {
    const tw = thisWeek.byExercise.get(id);
    const lw = lastWeek.byExercise.get(id);
    return {
      exerciseId: id,
      exerciseName: exMap.get(id)?.name ?? id,
      thisWeekAvgRPE: tw ? avg(tw.rpes) : null,
      lastWeekAvgRPE: lw ? avg(lw.rpes) : null,
      performanceDelta:
        (tw && avg(tw.reps) ? (avg(tw.reps) as number) : 0) -
        (lw && avg(lw.reps) ? (avg(lw.reps) as number) : 0),
    };
  });

  const deload = recommendDeload(
    fatigue,
    [snapshot(thisWeek), snapshot(lastWeek), snapshot(twoWeeksAgo)],
    keyLifts,
  );

  // --- Final reconciliation ---
  // Deload is a high-priority override. When active, we MUST NOT surface
  // ordinary forward-progression items (load+, rep+, set_increase) in the
  // same snapshot — that would contradict the deload guidance. We keep only
  // deload-safe items: set_reduce, hold (with real reasons), or items the
  // engine explicitly marks as deload_adjustment.
  const DELOAD_SAFE = new Set<ProgressionRecommendation['recommendationType']>([
    'set_reduce',
    'hold',
    'deload_adjustment',
  ]);
  const reconciled = deload
    ? meaningful.filter((it) => DELOAD_SAFE.has(it.recommendationType))
    : meaningful;

  const trimmed = reconciled.slice(0, THRESHOLDS.maxRecommendations);

  // --- V2: enrich items (mainAction, topReasons, confidence touch-ups) ---
  const ACTION_LABEL: Record<ProgressionRecommendation['recommendationType'], string> = {
    load_progression: 'Add load',
    rep_progression: 'Add a rep',
    hold: 'Hold load',
    set_reduce: 'Reduce sets',
    set_increase: 'Add a set',
    deload_adjustment: 'Deload adjustment',
  };
  for (const it of trimmed) {
    it.mainAction = ACTION_LABEL[it.recommendationType];
    it.topReasons = it.reasons.slice(0, 3);
    // Confidence touch-ups: bump set_reduce to medium if driven by volume trend.
    if (
      it.recommendationType === 'set_reduce' &&
      it.confidence === 'low' &&
      it.reasons.some((r) => /Weekly volume up/i.test(r))
    ) {
      it.confidence = 'medium';
    }
    // Cap to low if a guardrail blocked the original intent.
    if (it.guardrailBlocked && it.confidence === 'high') it.confidence = 'medium';
  }

  // --- V2: derive top-level state ---
  let state: CoachState;
  if (deload) {
    state = 'recover';
  } else if (trimmed.length === 0) {
    // No actionable signal yet → neutral 'adapt', not an encouragement to push.
    state = 'adapt';
  } else {
    const forward = trimmed.filter(
      (it) =>
        (it.recommendationType === 'load_progression' ||
          it.recommendationType === 'rep_progression' ||
          it.recommendationType === 'set_increase') &&
        !it.guardrailBlocked,
    );
    const cautious = trimmed.filter(
      (it) =>
        it.recommendationType === 'hold' ||
        it.recommendationType === 'set_reduce' ||
        it.guardrailBlocked,
    );
    if (forward.length >= cautious.length && forward.length > 0) {
      state = 'train';
    } else {
      state = 'adapt';
    }
  }

  // --- V2: derive trend summary ---
  const totalThis = Array.from(thisWeek.byCategory.values()).reduce((a, b) => a + b, 0);
  const totalLast = Array.from(lastWeek.byCategory.values()).reduce((a, b) => a + b, 0);
  const totalTrend =
    totalLast > 0 ? (totalThis - totalLast) / totalLast : totalThis > 0 ? 1 : 0;
  const regressionSignals = trimmed.filter((it) =>
    it.reasons.some((r) => /regressed|rising|High RPE/i.test(r)),
  ).length;
  const forwardCount = trimmed.filter(
    (it) =>
      it.recommendationType === 'load_progression' ||
      it.recommendationType === 'rep_progression',
  ).length;

  let trendSummary: string;
  if (deload) {
    trendSummary = 'Fatigue building';
  } else if (regressionSignals >= 2) {
    trendSummary = 'Signals mixed';
  } else if (totalTrend >= 0.2) {
    trendSummary = 'Volume climbing';
  } else if (forwardCount >= 2) {
    trendSummary = 'Performance trending up';
  } else if (trimmed.length === 0 || trimmed.every((it) => it.recommendationType === 'hold')) {
    trendSummary = 'Stable but not ready to progress';
  } else {
    trendSummary = 'Steady progress';
  }

  // --- V3: adherence / behavior layer ---
  const adherence = computeAdherence(now, workouts, wes, sets);

  // --- V2: derive summary line (V3-aware) ---
  let summaryLine: string;
  if (deload) {
    summaryLine = 'Fatigue elevated — deload week recommended';
  } else if (adherence.comebackMode) {
    summaryLine = 'Welcome back — ease in and rebuild momentum';
  } else if (adherence.adherenceStatus === 'inactive') {
    summaryLine = 'Ready when you are — start light to ease back in';
  } else if (trimmed.length === 1) {
    const it = trimmed[0];
    summaryLine = `${it.exerciseName} • ${(it.mainAction ?? '').toLowerCase()}`;
  } else if (trimmed.length > 1) {
    summaryLine = 'Tuned suggestions ready for your next session';
  } else {
    summaryLine = 'No changes recommended — keep training as planned';
  }

  // V3: behavior-aware reinterpretation of top-level state.
  // Returning users or inconsistent weeks should never be told to "Train" hard.
  if (
    state === 'train' &&
    (adherence.adherenceStatus === 'returning' ||
      adherence.adherenceStatus === 'inactive' ||
      adherence.adherenceStatus === 'slipping')
  ) {
    state = 'adapt';
  }

  // V3: behavior context can replace the trend hint when more informative.
  if (!deload) {
    if (adherence.comebackMode) {
      trendSummary = 'Back after a short gap';
    } else if (adherence.adherenceStatus === 'inactive') {
      trendSummary = 'Rebuilding from a pause';
    } else if (adherence.adherenceStatus === 'slipping') {
      trendSummary = 'Consistency slipped this week';
    }
  }

  const snap: CoachSnapshot = {
    generatedAt: now.toISOString(),
    items: trimmed,
    deload,
    state,
    trendSummary,
    summaryLine,
    adherenceStatus: adherence.adherenceStatus,
    consistencyState: adherence.consistencyState,
    weeklyBehaviorSummary: adherence.weeklyBehaviorSummary,
    comebackMode: adherence.comebackMode,
  };

  // Cache locally (best-effort; failures are silent and never block UI).
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  } catch {
    /* ignore */
  }

  return snap;
}

export function loadCachedCoachSnapshot(): CoachSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CoachSnapshot;
  } catch {
    return null;
  }
}
