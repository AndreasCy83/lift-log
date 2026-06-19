/**
 * Exercise-specific hypertrophy rep targets for Coach recommendations.
 *
 * Rationale: not every exercise belongs in 8–12. Isolation work (lateral raises,
 * arm machines, calves, abs) progresses better at higher reps; heavy compounds
 * tolerate slightly lower reps. This module returns a practical hypertrophy
 * range per exercise, honoring user-customized ranges when present.
 */
import type { Exercise } from '@/types/fitness';

export interface RepRange {
  min: number;
  max: number;
}

/** Seed defaults applied generically across the library (cat-* default). */
const SEED_DEFAULT_MIN = 8;
const SEED_DEFAULT_MAX = 12;

/** Heuristic name patterns that override category defaults. */
const NAME_PATTERNS: Array<{ test: RegExp; range: RepRange }> = [
  // Calves — tolerate high-rep work
  { test: /\bcalf|calves\b/i, range: { min: 10, max: 15 } },
  // Lateral / rear delts and small isolation
  { test: /\blateral raise|side raise|rear delt|rear-delt|reverse fly|face pull\b/i, range: { min: 12, max: 20 } },
  // Direct arm isolation
  { test: /\bcurl\b/i, range: { min: 10, max: 15 } },
  { test: /\b(pushdown|kickback|skullcrusher|skull crusher|overhead extension|tricep extension|triceps extension)\b/i, range: { min: 10, max: 15 } },
  // Forearms / wrists
  { test: /\bwrist|forearm|reverse curl|hammer curl\b/i, range: { min: 12, max: 20 } },
  // Heavy compound lower body
  { test: /\b(deadlift|back squat|front squat|barbell row|bench press|overhead press|military press)\b/i, range: { min: 6, max: 10 } },
];

/** Default hypertrophy ranges per muscle category. */
const CATEGORY_RANGES: Record<string, RepRange> = {
  'cat-chest': { min: 8, max: 12 },
  'cat-back': { min: 8, max: 12 },
  'cat-legs': { min: 8, max: 12 },
  'cat-shoulders': { min: 10, max: 15 },
  'cat-biceps': { min: 10, max: 15 },
  'cat-triceps': { min: 10, max: 15 },
  'cat-core': { min: 12, max: 20 },
  'cat-abs': { min: 12, max: 20 },
  'cat-olympic': { min: 3, max: 6 },
};

/**
 * Returns the effective hypertrophy rep range for an exercise.
 *
 * Precedence:
 *   1. User-customized range on the exercise (anything other than the seed 8–12 default).
 *   2. Name-based override (lateral raise, calf, curl, big compound, ...).
 *   3. Category default.
 *   4. Fallback 8–12.
 */
export function getHypertrophyRepRange(exercise: Exercise): RepRange {
  const min = exercise.defaultRepsMin;
  const max = exercise.defaultRepsMax;
  const isUserCustomized =
    min != null &&
    max != null &&
    !(min === SEED_DEFAULT_MIN && max === SEED_DEFAULT_MAX);
  if (isUserCustomized) {
    return { min: min as number, max: max as number };
  }

  for (const { test, range } of NAME_PATTERNS) {
    if (test.test(exercise.name)) return range;
  }

  return CATEGORY_RANGES[exercise.categoryId] ?? { min: 8, max: 12 };
}
