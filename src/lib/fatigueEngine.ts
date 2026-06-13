/**
 * Fatigue engine — detects when the user appears to be accumulating systemic
 * fatigue and recommends a deload week.
 *
 * Pure logic only. Inputs are pre-computed muscle fatigue + weekly volume
 * snapshots; we don't re-read storage here.
 */
import type { MuscleFatigue } from './recoveryFatigue';
import type { VolumeStatus } from './volumeInsights';
import { THRESHOLDS } from './coachThresholds';

export interface WeeklyVolumeSnapshot {
  /** Per-category classified status for that week. */
  byCategory: Array<{ categoryId: string; weeklySets: number; status: VolumeStatus }>;
}

export interface KeyLiftRPE {
  exerciseId: string;
  exerciseName: string;
  thisWeekAvgRPE: number | null;
  lastWeekAvgRPE: number | null;
  performanceDelta: number; // avgReps this week - avgReps last week
}

export interface DeloadRecommendation {
  recommendationType: 'deload_week';
  fatigueScore: number;
  triggers: string[];
  suggestedVolumeReductionPercent: number;
  suggestedRPETarget: string;
  affectedKeyLifts: string[];
  explanation: string;
  createdAt: string;
}

const HIGH = new Set(THRESHOLDS.highVolumeStatuses);

function isSustainedHighWeek(week: WeeklyVolumeSnapshot): boolean {
  const count = week.byCategory.filter((b) => HIGH.has(b.status as any)).length;
  return count >= THRESHOLDS.deload.sustainedHighMusclesPerWeek;
}

export function recommendDeload(
  fatigue: MuscleFatigue[],
  weeklyHistory: WeeklyVolumeSnapshot[],
  keyLifts: KeyLiftRPE[],
): DeloadRecommendation | null {
  const triggers: string[] = [];
  const affected: string[] = [];

  // Trigger 1: many muscles currently in very-high fatigue
  const veryHighNow = fatigue.filter((m) => m.band === 'Very High').length;
  if (veryHighNow >= THRESHOLDS.deload.veryHighMusclesNow) {
    triggers.push(`${veryHighNow} muscles in very-high fatigue`);
  }

  // Trigger 2: sustained high weekly volume for 2+ weeks
  const recentWeeks = weeklyHistory.slice(0, THRESHOLDS.deload.sustainedHighWeeks);
  if (
    recentWeeks.length >= THRESHOLDS.deload.sustainedHighWeeks &&
    recentWeeks.every(isSustainedHighWeek)
  ) {
    triggers.push(`Sustained high volume for ${recentWeeks.length} weeks`);
  }

  // Trigger 3: rising RPE on key lifts with flat/declining performance
  const fatiguedLifts = keyLifts.filter((k) => {
    if (k.thisWeekAvgRPE == null || k.lastWeekAvgRPE == null) return false;
    const rpeRise = k.thisWeekAvgRPE - k.lastWeekAvgRPE;
    return rpeRise >= THRESHOLDS.deload.keyLiftRpeRise && k.performanceDelta <= 0;
  });
  if (fatiguedLifts.length >= 2) {
    triggers.push(`Rising effort on ${fatiguedLifts.length} key lifts`);
    fatiguedLifts.slice(0, 4).forEach((k) => affected.push(k.exerciseName));
  }

  if (triggers.length < THRESHOLDS.deload.minTriggers) return null;

  const fatigueScore =
    fatigue.reduce((acc, m) => acc + m.score, 0) + triggers.length;

  return {
    recommendationType: 'deload_week',
    fatigueScore: Math.round(fatigueScore * 10) / 10,
    triggers,
    suggestedVolumeReductionPercent: THRESHOLDS.deload.suggestedVolumeReductionPct,
    suggestedRPETarget: THRESHOLDS.deload.suggestedRPETarget,
    affectedKeyLifts: affected,
    explanation:
      'Fatigue indicators are stacking up across multiple muscles and key lifts. A lighter week now will pay dividends after.',
    createdAt: new Date().toISOString(),
  };
}
