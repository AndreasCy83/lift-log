// Recovery/Fatigue estimation per muscle group.
// Uses only completed (toggled) non-warmup sets within the last 96 hours.
import { getWorkouts, getExercises, getExercisesForWorkout, getSetsForWorkoutExercise } from './storage';

export type MuscleGroup = 'Chest' | 'Back' | 'Legs' | 'Shoulders' | 'Arms' | 'Core';

export const MUSCLE_GROUPS: MuscleGroup[] = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

// Map category IDs to muscle groups with a share weight.
// Each category contributes to a primary muscle (1.0) and optional secondaries.
const CATEGORY_TO_MUSCLES: Record<string, Partial<Record<MuscleGroup, number>>> = {
  'cat-chest':     { Chest: 1.0, Shoulders: 0.5, Arms: 0.25 },
  'cat-back':      { Back: 1.0, Arms: 0.5 },
  'cat-legs':      { Legs: 1.0, Core: 0.25 },
  'cat-shoulders': { Shoulders: 1.0, Arms: 0.25 },
  'cat-biceps':    { Arms: 1.0, Back: 0.25 },
  'cat-triceps':   { Arms: 1.0, Chest: 0.25 },
  'cat-core':      { Core: 1.0 },
  'cat-abs':       { Core: 1.0 },
  'cat-olympic':   { Legs: 1.0, Back: 0.5, Shoulders: 0.5, Core: 0.25 },
  'cat-cardio':    { Legs: 0.5, Core: 0.25 },
};

export type FatigueBand = 'Low' | 'Moderate' | 'High' | 'Very High';

export interface MuscleFatigue {
  muscle: MuscleGroup;
  score: number;       // adjusted fatigue
  band: FatigueBand;
  retrainLabel: string; // "Ready now" | "In ~12h" | etc.
  pct: number;          // 0-100 for the bar
}

function effortMultiplier(rpe: number | null | undefined): number {
  if (rpe == null) return 1.0;
  if (rpe <= 6) return 0.85;
  if (rpe <= 7) return 0.95;
  if (rpe <= 8) return 1.05;
  if (rpe <= 9) return 1.15;
  return 1.25;
}

function loadMultiplier(weightKg: number | null, reps: number | null, rpe: number | null | undefined): number {
  const hasWeight = !!weightKg && weightKg > 0;
  const isHeavyLowRep = hasWeight && !!reps && reps > 0 && reps <= 5 && (rpe ?? 0) >= 8;
  if (isHeavyLowRep) return 1.10;
  const isLight = !hasWeight || (!!reps && reps >= 20);
  if (isLight) return 0.90;
  return 1.00;
}

function recencyDecay(hours: number): number {
  if (hours < 0) return 1.0;
  if (hours <= 24) return 1.0;
  if (hours <= 48) return 0.70;
  if (hours <= 72) return 0.40;
  if (hours <= 96) return 0.15;
  return 0.05;
}

function weeklyModifier(weeklySets: number): number {
  if (weeklySets < 8) return 0.90;
  if (weeklySets <= 14) return 1.00;
  if (weeklySets <= 20) return 1.10;
  return 1.20;
}

function bandFor(score: number): FatigueBand {
  if (score < 2.5) return 'Low';
  if (score < 5.0) return 'Moderate';
  if (score < 7.5) return 'High';
  return 'Very High';
}

// Project hours forward until decayed score drops below "Ready now" (2.5).
function estimateRetrainHours(currentScore: number, contribs: { raw: number; ageHours: number }[], weeklyMod: number): number {
  if (currentScore < 2.5) return 0;
  for (let h = 6; h <= 120; h += 6) {
    let projected = 0;
    for (const s of contribs) {
      projected += s.raw * recencyDecay(s.ageHours + h);
    }
    if (projected * weeklyMod < 2.5) return h;
  }
  return 120;
}

function retrainLabel(hours: number): string {
  if (hours <= 0) return 'Ready now';
  if (hours <= 12) return 'In ~12h';
  if (hours <= 24) return 'Tomorrow';
  if (hours <= 48) return 'In ~48h';
  if (hours <= 72) return 'In ~3d';
  return 'In 4+ days';
}

export function computeMuscleFatigue(now: Date = new Date()): MuscleFatigue[] {
  const workouts = getWorkouts();
  const exercises = getExercises();
  const exById = new Map(exercises.map(e => [e.id, e]));

  // raw fatigue contributions per muscle (already decayed) + raw-by-age for projection
  const rawByMuscle: Record<MuscleGroup, { raw: number; ageHours: number }[]> = {
    Chest: [], Back: [], Legs: [], Shoulders: [], Arms: [], Core: [],
  };
  const weeklyCount: Record<MuscleGroup, number> = {
    Chest: 0, Back: 0, Legs: 0, Shoulders: 0, Arms: 0, Core: 0,
  };

  const nowMs = now.getTime();

  for (const w of workouts) {
    // Establish a session timestamp.
    const tsStr = w.endTime || w.startTime || `${w.date}T12:00:00`;
    const ts = new Date(tsStr).getTime();
    if (Number.isNaN(ts)) continue;
    const ageHours = (nowMs - ts) / (1000 * 60 * 60);
    if (ageHours < 0) continue;
    if (ageHours > 168) continue; // beyond 7 days irrelevant

    const wexs = getExercisesForWorkout(w.id);
    for (const we of wexs) {
      const ex = exById.get(we.exerciseId);
      if (!ex) continue;
      const muscleMap = CATEGORY_TO_MUSCLES[ex.categoryId];
      if (!muscleMap) continue;
      const sets = getSetsForWorkoutExercise(we.id).filter(s => s.isCompleted === true && !s.isWarmup);
      for (const s of sets) {
        const base = 1.0;
        const eff = effortMultiplier(s.rpe);
        const load = loadMultiplier(s.weightKg, s.reps, s.rpe);
        for (const [muscle, share] of Object.entries(muscleMap) as [MuscleGroup, number][]) {
          const raw = base * eff * load * share;
          // weekly count (last 7d, primary or secondary contributes if share >= 0.5)
          if (ageHours <= 168 && share >= 0.5) weeklyCount[muscle] += 1;
          if (ageHours <= 96) {
            rawByMuscle[muscle].push({ raw, ageHours });
          }
        }
      }
    }
  }

  const out: MuscleFatigue[] = MUSCLE_GROUPS.map(m => {
    const contribs = rawByMuscle[m];
    const decayed = contribs.reduce((sum, c) => sum + c.raw * recencyDecay(c.ageHours), 0);
    const wMod = weeklyModifier(weeklyCount[m]);
    const adjusted = decayed * wMod;
    const hours = estimateRetrainHours(adjusted, contribs, wMod);
    const pct = Math.min(100, Math.round((adjusted / 10) * 100));
    return {
      muscle: m,
      score: adjusted,
      band: bandFor(adjusted),
      retrainLabel: retrainLabel(hours),
      pct,
    };
  });

  return out;
}

export function getTopFatigued(limit = 4): MuscleFatigue[] {
  const all = computeMuscleFatigue();
  // Sort by score desc, but keep at least entries with score > 0 first.
  return [...all].sort((a, b) => b.score - a.score).slice(0, limit);
}
