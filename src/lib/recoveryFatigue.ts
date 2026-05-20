// Recovery/Fatigue estimation per muscle group.
// Uses only completed (toggled) non-warmup sets within the last 96 hours.
import { getWorkouts, getExercises, getExercisesForWorkout, getSetsForWorkoutExercise } from './storage';

export type MuscleGroup = 'Chest' | 'Back' | 'Legs' | 'Shoulders' | 'Arms' | 'Core';

export const MUSCLE_GROUPS: MuscleGroup[] = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

// Map category IDs to muscle groups with a share weight.
// Each category contributes to a primary muscle (1.0) and optional secondaries.
const CATEGORY_TO_MUSCLES: Record<string, Partial<Record<MuscleGroup, number>>> = {
  'cat-chest':     { Chest: 1.0, Shoulders: 0.25, Arms: 0.10 },
  'cat-back':      { Back: 1.0, Arms: 0.25 },
  'cat-legs':      { Legs: 1.0, Core: 0.10 },
  'cat-shoulders': { Shoulders: 1.0, Arms: 0.10 },
  'cat-biceps':    { Arms: 1.0, Back: 0.10 },
  'cat-triceps':   { Arms: 1.0, Chest: 0.10 },
  'cat-core':      { Core: 1.0 },
  'cat-abs':       { Core: 1.0 },
  'cat-olympic':   { Legs: 1.0, Back: 0.33, Shoulders: 0.25, Core: 0.10 },
  'cat-cardio':    { Legs: 0.5, Core: 0.10 },
};

// Isolation exercises: name-keyword match → muscle-only mapping (overrides category spillover).
// Keys are lowercase substrings checked against exercise.name.
const ISOLATION_OVERRIDES: { match: string; muscles: Partial<Record<MuscleGroup, number>> }[] = [
  { match: 'leg curl',       muscles: { Legs: 1.0 } },
  { match: 'leg extension',  muscles: { Legs: 1.0 } },
  { match: 'calf raise',     muscles: { Legs: 1.0 } },
  { match: 'calf press',     muscles: { Legs: 1.0 } },
  { match: 'lateral raise',  muscles: { Shoulders: 1.0 } },
  { match: 'side raise',     muscles: { Shoulders: 1.0 } },
  { match: 'rear delt',      muscles: { Shoulders: 1.0 } },
  { match: 'rear cable',     muscles: { Shoulders: 1.0 } },
  { match: 'reverse fly',    muscles: { Shoulders: 1.0 } },
  { match: 'face pull',      muscles: { Shoulders: 1.0, Back: 0.33 } },
  { match: 'shrug',          muscles: { Back: 1.0 } },
  { match: 'bicep curl',     muscles: { Arms: 1.0 } },
  { match: 'preacher curl',  muscles: { Arms: 1.0 } },
  { match: 'hammer curl',    muscles: { Arms: 1.0 } },
  { match: 'tricep',         muscles: { Arms: 1.0 } },
  { match: 'pushdown',       muscles: { Arms: 1.0 } },
  { match: 'skull crusher',  muscles: { Arms: 1.0 } },
  { match: 'ab ',            muscles: { Core: 1.0 } },
  { match: 'crunch',         muscles: { Core: 1.0 } },
  { match: 'plank',          muscles: { Core: 1.0 } },
  { match: 'sit up',         muscles: { Core: 1.0 } },
  { match: 'sit-up',         muscles: { Core: 1.0 } },
  { match: 'leg raise',      muscles: { Core: 1.0 } },
  { match: 'prayer',         muscles: { Core: 1.0 } },
  { match: 'pec deck',       muscles: { Chest: 1.0 } },
  { match: 'chest fly',      muscles: { Chest: 1.0 } },
  { match: 'cable fly',      muscles: { Chest: 1.0 } },
];

function resolveMuscles(exerciseName: string, categoryId: string): Partial<Record<MuscleGroup, number>> | null {
  const n = (exerciseName || '').toLowerCase();
  for (const o of ISOLATION_OVERRIDES) {
    if (n.includes(o.match)) return o.muscles;
  }
  return CATEGORY_TO_MUSCLES[categoryId] ?? null;
}

export type FatigueBand = 'Low' | 'Moderate' | 'High' | 'Very High';

export interface MuscleFatigue {
  muscle: MuscleGroup;
  score: number;       // adjusted fatigue
  band: FatigueBand;
  retrainLabel: string; // "Ready" | "12h" | "2d"
  pct: number;          // 0-100: remaining recovery proportion (remaining/original)
  remainingHours: number;
  originalHours: number;
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
  for (let h = 1; h <= 168; h += 1) {
    let projected = 0;
    for (const s of contribs) {
      projected += s.raw * recencyDecay(s.ageHours + h);
    }
    if (projected * weeklyMod < 2.5) return h;
  }
  return 168;
}

function retrainLabel(hours: number): string {
  if (hours <= 0) return 'Ready';
  if (hours < 24) return `${Math.max(1, Math.round(hours))}h`;
  if (hours <= 36) return 'Tomorrow';
  const days = Math.round(hours / 24);
  return `${days}d`;
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
    // Establish session timestamp. `w.date` is the source of truth for when
    // the workout happened (user-editable via move). Prefer startTime/endTime
    // only when they fall on the same calendar date — otherwise the stored
    // timestamps are stale from before a move and would freeze the age.
    let ts = new Date(`${w.date}T12:00:00`).getTime();
    const candidate = w.endTime || w.startTime;
    if (candidate) {
      const cTs = new Date(candidate).getTime();
      if (!Number.isNaN(cTs)) {
        const sameDay = new Date(cTs).toISOString().slice(0, 10) === w.date;
        if (sameDay) ts = cTs;
      }
    }
    if (Number.isNaN(ts)) continue;
    const ageHours = (nowMs - ts) / (1000 * 60 * 60);
    if (ageHours < 0) continue;
    if (ageHours > 168) continue; // beyond 7 days irrelevant

    const wexs = getExercisesForWorkout(w.id);
    for (const we of wexs) {
      const ex = exById.get(we.exerciseId);
      if (!ex) continue;
      const muscleMap = resolveMuscles(ex.name, ex.categoryId);
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
