/**
 * Centralized tunable thresholds for the offline coach engines.
 * Keep magic numbers here so they can be tuned in one place.
 *
 * V1 calibration note: thresholds are intentionally conservative so the Coach
 * speaks less often, but with higher confidence. Prefer "hold" over noisy
 * suggestions when signal is weak.
 */
export const THRESHOLDS = {
  // Progression
  /** Require at least N exposures in the lookback window before suggesting a load increase. */
  minExposuresForLoadIncrease: 3,
  /** Require at least N exposures before suggesting any progression (load or rep). */
  minExposuresForAnyProgression: 2,
  rpeRiseDelta: 1.0,
  rpeFatigueHard: 9.0,

  // Weekly volume trend (week-over-week change that triggers ± 1 set)
  volumeTrendPct: 0.20,

  // Guardrail: block extra set if the muscle's classified volume is one of these
  highVolumeStatuses: ['high', 'very_high'] as const,

  // Fatigue / deload
  deload: {
    /** How many of the last N weeks must show "sustained" high category volume. */
    sustainedHighWeeks: 3,
    /** Min number of muscles in high/very_high to count a week as 'sustained high'. */
    sustainedHighMusclesPerWeek: 3,
    /** Min very-high muscles RIGHT NOW to count as immediate fatigue signal. */
    veryHighMusclesNow: 3,
    /** Week-over-week avg RPE rise on key lifts that signals fatigue. */
    keyLiftRpeRise: 0.8,
    /** Min number of fatigued key lifts needed for that trigger to count. */
    fatiguedKeyLiftsForTrigger: 3,
    /** Suggested deload volume reduction range. */
    suggestedVolumeReductionPct: 45,
    suggestedRPETarget: '5–6',
    /** Minimum total fatigue triggers needed to recommend a deload week. */
    minTriggers: 2,
  },

  // Coach window
  exposureLookbackDays: 28,
  /** Max items surfaced in a single snapshot — keep the card high-signal. */
  maxRecommendations: 4,
} as const;
