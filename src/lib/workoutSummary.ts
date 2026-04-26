/**
 * Computes post-workout celebration summary data from storage.
 * Pure read functions — no side effects.
 */
import {
  getWorkouts,
  getExercisesForWorkout,
  getSetsForWorkoutExercise,
  getExercises,
  getCategories,
  getWorkoutExercises,
  getWorkoutSets,
  getRoutines,
} from '@/lib/storage';
import type { Workout, WorkoutSet, Exercise } from '@/types/fitness';

export interface MuscleFocus {
  categoryId: string;
  name: string;
  color: string;
  sets: number;
  volumeKg: number;
  /** Share of total volume (0..1). Falls back to share of sets when no weight. */
  share: number;
}

export interface HighlightRecord {
  exerciseName: string;
  weightKg: number;
  reps: number;
}

export interface WorkoutCelebrationData {
  workout: Workout;
  routineName: string | null;
  exerciseCount: number;
  totalSets: number;
  totalReps: number;
  totalVolumeKg: number;
  durationSec: number;
  muscleFocus: MuscleFocus[];
  /** Heaviest single set in this workout. */
  heaviestSet: HighlightRecord | null;
  /** Exercise with biggest volume contribution this workout. */
  topVolumeExercise: { name: string; volumeKg: number } | null;
  /** Personal records set in this workout (estimated 1RM beat all-time). */
  personalRecords: HighlightRecord[];
  // Motivational context
  workoutNumberAllTime: number;
  workoutsThisWeek: number;
  workoutsThisMonth: number;
  /** Consecutive weeks with at least one workout, ending this week. */
  weekStreak: number;
  // Lifetime
  lifetimeWorkouts: number;
  lifetimeVolumeKg: number;
  lifetimeDurationSec: number;
}

function startOfWeek(d: Date): Date {
  // Monday-start week
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

function parseLocalDate(yyyymmdd: string): Date {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function workoutSetsVolume(set: WorkoutSet): number {
  if (set.weightKg && set.reps && set.weightKg > 0 && set.reps > 0) {
    return set.weightKg * set.reps;
  }
  return 0;
}

function workoutVolumeAndStats(workoutId: string): { volume: number; sets: number; reps: number } {
  const wes = getWorkoutExercises().filter(we => we.workoutId === workoutId);
  const allSets = getWorkoutSets();
  let volume = 0;
  let sets = 0;
  let reps = 0;
  for (const we of wes) {
    const ws = allSets.filter(s => s.workoutExerciseId === we.id);
    for (const s of ws) {
      // Count any set with meaningful data
      const meaningful =
        (typeof s.weightKg === 'number' && s.weightKg > 0) ||
        (typeof s.reps === 'number' && s.reps > 0);
      if (!meaningful) continue;
      sets += 1;
      reps += s.reps ?? 0;
      volume += workoutSetsVolume(s);
    }
  }
  return { volume, sets, reps };
}

export function computeCelebrationData(workoutId: string): WorkoutCelebrationData | null {
  const workouts = getWorkouts();
  const workout = workouts.find(w => w.id === workoutId);
  if (!workout) return null;

  const exercises = getExercises();
  const categories = getCategories();
  const exMap = new Map<string, Exercise>(exercises.map(e => [e.id, e]));
  const catMap = new Map(categories.map(c => [c.id, c]));

  const wes = getExercisesForWorkout(workout.id);
  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;

  // Per-exercise & per-category aggregation
  const perExerciseVolume = new Map<string, { name: string; volume: number }>();
  const perCategory = new Map<string, { sets: number; volume: number }>();
  let heaviestSet: HighlightRecord | null = null;

  // For PR detection we need history excluding this workout
  const allSets = getWorkoutSets();
  const allWes = getWorkoutExercises();
  const allWorkouts = workouts;

  const personalRecords: HighlightRecord[] = [];

  for (const we of wes) {
    const ex = exMap.get(we.exerciseId);
    const exName = ex?.name ?? 'Exercise';
    const sets = getSetsForWorkoutExercise(we.id).filter(s =>
      (typeof s.weightKg === 'number' && s.weightKg > 0) ||
      (typeof s.reps === 'number' && s.reps > 0)
    );
    if (sets.length === 0) continue;

    let exVolume = 0;
    let exSetCount = 0;
    let bestE1rm = 0;
    let bestSetForEx: { weightKg: number; reps: number } | null = null;

    for (const s of sets) {
      totalSets += 1;
      exSetCount += 1;
      totalReps += s.reps ?? 0;
      const v = workoutSetsVolume(s);
      totalVolume += v;
      exVolume += v;

      if (s.weightKg && s.reps && s.weightKg > 0 && s.reps > 0) {
        if (!heaviestSet || s.weightKg > heaviestSet.weightKg) {
          heaviestSet = { exerciseName: exName, weightKg: s.weightKg, reps: s.reps };
        }
        const e1rm = s.weightKg * (1 + s.reps / 30);
        if (e1rm > bestE1rm) {
          bestE1rm = e1rm;
          bestSetForEx = { weightKg: s.weightKg, reps: s.reps };
        }
      }
    }

    perExerciseVolume.set(we.exerciseId, { name: exName, volume: exVolume });

    if (ex) {
      const cur = perCategory.get(ex.categoryId) ?? { sets: 0, volume: 0 };
      cur.sets += exSetCount;
      cur.volume += exVolume;
      perCategory.set(ex.categoryId, cur);
    }

    // PR: compare bestE1rm to historical bestE1rm for this exercise (excluding this workout)
    if (bestSetForEx && bestE1rm > 0 && ex) {
      const otherWes = allWes.filter(x => x.exerciseId === we.exerciseId && x.workoutId !== workout.id);
      let historyBest = 0;
      for (const ow of otherWes) {
        const oss = allSets.filter(s => s.workoutExerciseId === ow.id);
        for (const s of oss) {
          if (s.weightKg && s.reps && s.weightKg > 0 && s.reps > 0) {
            const e = s.weightKg * (1 + s.reps / 30);
            if (e > historyBest) historyBest = e;
          }
        }
      }
      if (bestE1rm > historyBest + 0.0001) {
        personalRecords.push({ exerciseName: exName, weightKg: bestSetForEx.weightKg, reps: bestSetForEx.reps });
      }
    }
  }

  // Muscle focus
  const totalCatVolume = Array.from(perCategory.values()).reduce((a, c) => a + c.volume, 0);
  const totalCatSets = Array.from(perCategory.values()).reduce((a, c) => a + c.sets, 0);
  const muscleFocus: MuscleFocus[] = Array.from(perCategory.entries())
    .map(([catId, v]) => {
      const cat = catMap.get(catId);
      const share =
        totalCatVolume > 0 ? v.volume / totalCatVolume : totalCatSets > 0 ? v.sets / totalCatSets : 0;
      // Lazy import to avoid circular
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getCategoryColor } = require('@/lib/categoryColors') as typeof import('@/lib/categoryColors');
      return {
        categoryId: catId,
        name: cat?.name ?? 'Other',
        color: getCategoryColor(catId),
        sets: v.sets,
        volumeKg: v.volume,
        share,
      };
    })
    .sort((a, b) => b.share - a.share);

  // Top volume exercise
  let topVolumeExercise: WorkoutCelebrationData['topVolumeExercise'] = null;
  for (const v of perExerciseVolume.values()) {
    if (!topVolumeExercise || v.volume > topVolumeExercise.volumeKg) {
      topVolumeExercise = { name: v.name, volumeKg: v.volume };
    }
  }
  if (topVolumeExercise && topVolumeExercise.volumeKg <= 0) topVolumeExercise = null;

  // Lifetime + ordering stats
  const finishedWorkouts = allWorkouts
    .filter(w => w.endTime || w.id === workout.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const workoutNumberAllTime = finishedWorkouts.findIndex(w => w.id === workout.id) + 1
    || finishedWorkouts.length + 1;

  const wDate = parseLocalDate(workout.date);
  const weekStart = startOfWeek(wDate);
  const monthStart = new Date(wDate.getFullYear(), wDate.getMonth(), 1);
  const weekStartStr = ymd(weekStart);
  const monthStartStr = ymd(monthStart);
  const wDateStr = workout.date;

  const workoutsThisWeek = finishedWorkouts.filter(w => w.date >= weekStartStr && w.date <= wDateStr).length;
  const workoutsThisMonth = finishedWorkouts.filter(w => w.date >= monthStartStr && w.date <= wDateStr).length;

  // Week streak: consecutive weeks (including this one) with ≥1 workout, walking backwards.
  const weeksWithWorkout = new Set(
    finishedWorkouts.map(w => ymd(startOfWeek(parseLocalDate(w.date))))
  );
  let weekStreak = 0;
  let cursor = new Date(weekStart);
  while (weeksWithWorkout.has(ymd(cursor))) {
    weekStreak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }

  // Lifetime totals (across all stored workouts)
  let lifetimeVolume = 0;
  let lifetimeDuration = 0;
  for (const w of allWorkouts) {
    if (w.id === workout.id) {
      lifetimeVolume += totalVolume;
    } else {
      lifetimeVolume += workoutVolumeAndStats(w.id).volume;
    }
    if (typeof w.durationSeconds === 'number' && w.durationSeconds > 0) {
      lifetimeDuration += w.durationSeconds;
    }
  }

  // Routine name
  let routineName: string | null = null;
  if (workout.sourceRoutineId) {
    const r = getRoutines().find(x => x.id === workout.sourceRoutineId);
    routineName = r?.name ?? null;
  }

  return {
    workout,
    routineName,
    exerciseCount: wes.length,
    totalSets,
    totalReps,
    totalVolumeKg: totalVolume,
    durationSec: workout.durationSeconds ?? 0,
    muscleFocus,
    heaviestSet,
    topVolumeExercise,
    personalRecords,
    workoutNumberAllTime,
    workoutsThisWeek,
    workoutsThisMonth,
    weekStreak,
    lifetimeWorkouts: allWorkouts.length,
    lifetimeVolumeKg: lifetimeVolume,
    lifetimeDurationSec: lifetimeDuration,
  };
}

export function formatDurationShort(sec: number): string {
  if (!sec || sec <= 0) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}
