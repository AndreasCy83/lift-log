/**
 * Volume insights: estimated weekly hypertrophy volume per muscle group.
 *
 * Pure, offline calculations on the local workout/set data model.
 * - Uses a rolling 14-day window; weekly = total / 2.
 * - Counts only completed sets (isCompleted === true), excludes warmups.
 * - Ignores RPE/RIR entirely.
 * - setTag multiplier: W=0 (warmup), D=0.5 (deload), F=1.0 (failure),
 *   N=1.0 (normal). Missing tag is treated as Normal (1.0).
 * - Compound lifts contribute partial credit to secondary muscles via a
 *   keyword-based exercise→muscle weight mapping. The FULL keyword map is
 *   scanned and the first match wins. If no keyword matches at all, we
 *   fall back to a single credit on the exercise's primary category.
 */
import type { SetTag, WorkoutSet, Exercise } from '@/types/fitness';
import { getExercises, getWorkouts, getWorkoutExercises, getWorkoutSets } from '@/lib/storage';

export type VolumeStatus =
  | 'none'
  | 'below'
  | 'maintenance'
  | 'productive'
  | 'progressive'
  | 'high'
  | 'very_high';

export interface MuscleVolume {
  categoryId: string;
  weeklySets: number;
  status: VolumeStatus;
}

export interface VolumeSummary {
  weeklyByCategory: MuscleVolume[];
  totalWeeklySets: number;
  totalStatus: VolumeStatus;
  hasAny: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Per-set credit multiplier based on the user's set tag.
 * - W = warmup → 0 (excluded from working volume)
 * - D = deload → 0.5 (counts as a partial working set)
 * - F = failure → 1.0
 * - N = normal → 1.0
 * - missing/unknown tag → 1.0 (treat as Normal)
 */
export function getSetMultiplier(tag: SetTag | undefined): number {
  switch (tag) {
    case 'W': return 0;     // warmup
    case 'D': return 0.5;   // deload
    case 'F': return 1.0;   // failure
    case 'N': return 1.0;   // normal
    default:  return 1.0;   // missing tag → treat as normal
  }
}

/**
 * Keyword-based contribution weights. Each entry maps a lowercase substring
 * found in the exercise name to a list of {categoryId, weight} credits.
 *
 * Matching rules:
 *   1. Iterate through the ENTIRE map and return the FIRST matching keyword.
 *   2. Never fall back inside the loop — only after exhausting the map.
 *   3. Order entries from more specific → more generic so specific compounds
 *      win over generic substrings (e.g. "close-grip bench" before "bench press").
 */
const KEYWORD_MAP: Array<{ kw: string; credits: Array<[string, number]> }> = [
  // --- Specific compounds first (must precede their generic substrings) ---
  { kw: 'close-grip bench',    credits: [['cat-triceps', 1.0], ['cat-chest', 0.5]] },
  { kw: 'incline press',       credits: [['cat-chest', 1.0], ['cat-shoulders', 0.5], ['cat-triceps', 0.4]] },
  { kw: 'bench press',         credits: [['cat-chest', 1.0], ['cat-triceps', 0.5], ['cat-shoulders', 0.3]] },
  { kw: 'chest press',         credits: [['cat-chest', 1.0], ['cat-triceps', 0.4], ['cat-shoulders', 0.3]] },
  { kw: 'shoulder press',      credits: [['cat-shoulders', 1.0], ['cat-triceps', 0.5]] },
  { kw: 'overhead press',      credits: [['cat-shoulders', 1.0], ['cat-triceps', 0.5]] },
  { kw: 'military press',      credits: [['cat-shoulders', 1.0], ['cat-triceps', 0.5]] },
  { kw: 'arnold press',        credits: [['cat-shoulders', 1.0], ['cat-triceps', 0.4]] },
  { kw: 'lateral raise',       credits: [['cat-shoulders', 1.0]] },
  { kw: 'front raise',         credits: [['cat-shoulders', 1.0]] },
  { kw: 'rear delt',           credits: [['cat-shoulders', 0.8], ['cat-back', 0.4]] },
  { kw: 'face pull',           credits: [['cat-shoulders', 0.8], ['cat-back', 0.4]] },
  { kw: 'upright row',         credits: [['cat-shoulders', 1.0], ['cat-back', 0.3]] },

  // Chest
  { kw: 'incline',             credits: [['cat-chest', 1.0], ['cat-shoulders', 0.4], ['cat-triceps', 0.3]] },
  { kw: 'decline',             credits: [['cat-chest', 1.0], ['cat-triceps', 0.4]] },
  { kw: 'push-up',             credits: [['cat-chest', 1.0], ['cat-triceps', 0.4], ['cat-shoulders', 0.3]] },
  { kw: 'pushup',              credits: [['cat-chest', 1.0], ['cat-triceps', 0.4], ['cat-shoulders', 0.3]] },
  { kw: 'dip',                 credits: [['cat-chest', 1.0], ['cat-triceps', 0.6], ['cat-shoulders', 0.3]] },
  { kw: 'fly',                 credits: [['cat-chest', 1.0]] },
  { kw: 'crossover',           credits: [['cat-chest', 1.0]] },

  // Back
  { kw: 'deadlift',            credits: [['cat-back', 1.0], ['cat-legs', 0.6]] },
  { kw: 'pull-up',             credits: [['cat-back', 1.0], ['cat-biceps', 0.5]] },
  { kw: 'pullup',              credits: [['cat-back', 1.0], ['cat-biceps', 0.5]] },
  { kw: 'chin-up',             credits: [['cat-back', 1.0], ['cat-biceps', 0.6]] },
  { kw: 'chinup',              credits: [['cat-back', 1.0], ['cat-biceps', 0.6]] },
  { kw: 'lat pulldown',        credits: [['cat-back', 1.0], ['cat-biceps', 0.4]] },
  { kw: 'pulldown',            credits: [['cat-back', 1.0], ['cat-biceps', 0.4]] },
  { kw: 'row',                 credits: [['cat-back', 1.0], ['cat-biceps', 0.4]] },
  { kw: 'shrug',               credits: [['cat-back', 1.0]] },

  // Legs
  { kw: 'romanian',            credits: [['cat-legs', 1.0], ['cat-back', 0.4]] },
  { kw: 'rdl',                 credits: [['cat-legs', 1.0], ['cat-back', 0.4]] },
  { kw: 'split squat',         credits: [['cat-legs', 1.0]] },
  { kw: 'squat',               credits: [['cat-legs', 1.0]] },
  { kw: 'leg press',           credits: [['cat-legs', 1.0]] },
  { kw: 'leg extension',       credits: [['cat-legs', 1.0]] },
  { kw: 'leg curl',            credits: [['cat-legs', 1.0]] },
  { kw: 'lunge',               credits: [['cat-legs', 1.0]] },
  { kw: 'step-up',             credits: [['cat-legs', 1.0]] },
  { kw: 'hip thrust',          credits: [['cat-legs', 1.0]] },
  { kw: 'glute bridge',        credits: [['cat-legs', 1.0]] },
  { kw: 'calf',                credits: [['cat-legs', 0.8]] },
  { kw: 'hamstring',           credits: [['cat-legs', 1.0]] },
  { kw: 'quad',                credits: [['cat-legs', 1.0]] },

  // Biceps
  { kw: 'curl',                credits: [['cat-biceps', 1.0]] },

  // Triceps
  { kw: 'pushdown',            credits: [['cat-triceps', 1.0]] },
  { kw: 'tricep',              credits: [['cat-triceps', 1.0]] },
  { kw: 'skullcrusher',        credits: [['cat-triceps', 1.0]] },
  { kw: 'kickback',            credits: [['cat-triceps', 1.0]] },

  // Core / abs
  { kw: 'crunch',              credits: [['cat-abs', 1.0]] },
  { kw: 'sit-up',              credits: [['cat-abs', 1.0]] },
  { kw: 'plank',               credits: [['cat-core', 1.0], ['cat-abs', 0.5]] },
  { kw: 'leg raise',           credits: [['cat-abs', 1.0]] },
  { kw: 'ab ',                 credits: [['cat-abs', 1.0]] },
  { kw: 'abs',                 credits: [['cat-abs', 1.0]] },
];

/**
 * Resolve the muscle-credit list for an exercise.
 *
 * - Cardio exercises return [] (no hypertrophy volume contribution).
 * - Scan the full KEYWORD_MAP; the first matching keyword wins.
 * - If NO keyword matches, fall back to a single 1.0 credit on the
 *   exercise's own primary category. The fallback is only reached after
 *   the loop completes — never from inside it.
 */
export function getSetMuscleCredits(exercise: Exercise): Array<[string, number]> {
  if (exercise.type === 'CARDIO') return [];

  const name = exercise.name.toLowerCase();
  let matched: Array<[string, number]> | null = null;
  for (const { kw, credits } of KEYWORD_MAP) {
    if (name.includes(kw)) {
      matched = credits;
      break;
    }
  }
  if (matched) return matched;

  // No keyword matched anywhere in the map — fall back to primary category.
  return [[exercise.categoryId, 1.0]];
}

export function classifyVolume(weeklySets: number): VolumeStatus {
  if (weeklySets <= 0) return 'none';
  if (weeklySets < 4) return 'below';
  if (weeklySets < 8) return 'maintenance';
  if (weeklySets < 12) return 'productive';
  if (weeklySets <= 20) return 'progressive';
  if (weeklySets <= 24) return 'high';
  return 'very_high';
}

export const STATUS_LABEL: Record<VolumeStatus, string> = {
  none: 'No data',
  below: 'Needs More Volume',
  maintenance: 'Maintenance Volume',
  productive: 'Growth Ready',
  progressive: 'Growth Zone',
  high: 'High Volume',
  very_high: 'Peak Volume',
};

/** Tailwind classes for status chip color. */
export const STATUS_CHIP_CLASS: Record<VolumeStatus, string> = {
  none:        'bg-muted/40 text-muted-foreground',
  below:       'bg-emerald-500/15 text-emerald-400',
  maintenance: 'bg-emerald-500/15 text-emerald-400',
  productive:  'bg-yellow-500/15 text-yellow-400',
  progressive: 'bg-orange-500/15 text-orange-400',
  high:        'bg-orange-500/20 text-orange-300',
  very_high:   'bg-red-500/20 text-red-400',
};

export const STATUS_BAR_COLOR: Record<VolumeStatus, string> = {
  none:        'bg-muted',
  below:       'bg-emerald-500',
  maintenance: 'bg-emerald-500',
  productive:  'bg-yellow-500',
  progressive: 'bg-orange-500',
  high:        'bg-orange-400',
  very_high:   'bg-red-500',
};

export function computeVolumeSummary(now: Date = new Date()): VolumeSummary {
  const exercises = getExercises();
  const exMap = new Map<string, Exercise>(exercises.map(e => [e.id, e]));
  const workouts = getWorkouts();
  const wes = getWorkoutExercises();
  const sets = getWorkoutSets();

  const cutoff = now.getTime() - 14 * DAY_MS;
  const validWorkoutIds = new Set(
    workouts.filter(w => {
      // Parse YYYY-MM-DD as local noon to avoid TZ drift
      const [y, m, d] = w.date.split('-').map(Number);
      const ts = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0).getTime();
      return ts >= cutoff && ts <= now.getTime() + DAY_MS;
    }).map(w => w.id),
  );

  const weByExercise = new Map<string, string>(); // weId -> exerciseId
  const validWeIds = new Set<string>();
  for (const we of wes) {
    if (validWorkoutIds.has(we.workoutId)) {
      validWeIds.add(we.id);
      weByExercise.set(we.id, we.exerciseId);
    }
  }

  const credits = new Map<string, number>(); // categoryId -> 14d credits

  for (const s of sets) {
    if (!validWeIds.has(s.workoutExerciseId)) continue;
    if (s.isCompleted !== true) continue;
    if (s.isWarmup) continue;
    const mult = getSetMultiplier(s.setTag);
    if (mult <= 0) continue;
    const exId = weByExercise.get(s.workoutExerciseId);
    if (!exId) continue;
    const ex = exMap.get(exId);
    if (!ex) continue;
    const muscleCredits = getSetMuscleCredits(ex);
    for (const [catId, w] of muscleCredits) {
      credits.set(catId, (credits.get(catId) ?? 0) + mult * w);
    }
  }

  const weeklyByCategory: MuscleVolume[] = Array.from(credits.entries())
    .map(([catId, total14d]) => {
      const weekly = total14d / 2;
      return {
        categoryId: catId,
        weeklySets: weekly,
        status: classifyVolume(weekly),
      };
    })
    .filter(v => v.weeklySets > 0)
    .sort((a, b) => b.weeklySets - a.weeklySets);

  const totalWeeklySets = weeklyByCategory.reduce((a, c) => a + c.weeklySets, 0);

  // Total-body status:
  // Explicitly the AVERAGE weekly sets across muscles that received any
  // qualifying volume in the 14-day window. We do not sum across muscles
  // (that would over-state intensity for full-body splits) and we do not
  // weight by anything beyond muscle membership. If no muscle has volume,
  // the status is 'none' and the empty state is rendered instead.
  let totalStatus: VolumeStatus = 'none';
  if (weeklyByCategory.length > 0) {
    const avg = totalWeeklySets / weeklyByCategory.length;
    totalStatus = classifyVolume(avg);
  }

  return {
    weeklyByCategory,
    totalWeeklySets,
    totalStatus,
    hasAny: weeklyByCategory.length > 0 && totalWeeklySets > 0,
  };
}
