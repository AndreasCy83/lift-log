/**
 * Centralized tunable thresholds for the offline coach engines.
 * Keep magic numbers here so they can be tuned in one place.
 */
export const THRESHOLDS = {
  // Progression
  minExposuresForLoadIncrease: 2,
  rpeRiseDelta: 1.0,
  rpeFatigueHard: 9.0,

  // Weekly volume trend (week-over-week change that triggers ± 1 set)
  volumeTrendPct: 0.15,

  // Guardrail: block extra set if the muscle's classified volume is one of these
  highVolumeStatuses: ['high', 'very_high'] as const,

  // Fatigue / deload
  deload: {
    /** How many of the last N weeks must show "sustained" high category volume. */
    sustainedHighWeeks: 2,
    /** Min number of muscles in high/very_high to count a week as 'sustained high'. */
    sustainedHighMusclesPerWeek: 2,
    /** Min very-high muscles RIGHT NOW to count as immediate fatigue signal. */
    veryHighMusclesNow: 2,
    /** Week-over-week avg RPE rise on key lifts that signals fatigue. */
    keyLiftRpeRise: 0.7,
    /** Suggested deload volume reduction range. */
    suggestedVolumeReductionPct: 45,
    suggestedRPETarget: '5–6',
    /** Minimum total fatigue triggers needed to recommend a deload week. */
    minTriggers: 2,
  },

  // Coach window
  exposureLookbackDays: 28,
  maxRecommendations: 6,
} as const;
