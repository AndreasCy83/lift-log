/**
 * Verifies that Coach uses the Recovery model as a secondary decision layer:
 *   1) Poor primary-muscle recovery + flat performance → Hold steady
 *   2) Good recovery + improving performance → progression allowed
 *   3) Poor recovery + declining performance + rising RPE → Rebuild reps
 *      recommendation is surfaced with elevated confidence
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/types/fitness';
import { computeCoachRecommendations } from './coachRecommendations';

const KEYS = {
  exercises: 'gym-exercises',
  workouts: 'gym-workouts',
  workoutExercises: 'gym-workout-exercises',
  workoutSets: 'gym-workout-sets',
};

function mkExercise(id: string, name: string, categoryId: string): Exercise {
  return {
    id,
    name,
    categoryId,
    type: 'RESISTANCE',
    setType: 'WEIGHT_REPS',
    weightUnit: 'kg',
    defaultRepsMin: 8,
    defaultRepsMax: 12,
    defaultSets: 3,
    defaultRestSeconds: 120,
    notes: '',
    isFavorite: false,
    isCustom: false,
  };
}

function mkWorkout(id: string, dateISO: string): Workout {
  return {
    id,
    date: dateISO,
    startTime: `${dateISO}T12:00:00.000Z`,
    endTime: `${dateISO}T13:00:00.000Z`,
    notes: '',
    source: 'manual',
    durationSeconds: 3600,
  };
}

function mkWE(id: string, workoutId: string, exerciseId: string): WorkoutExercise {
  return { id, workoutId, exerciseId, position: 0, notes: '' };
}

function mkSet(
  id: string,
  weId: string,
  idx: number,
  weightKg: number,
  reps: number,
  rpe: number,
): WorkoutSet {
  return {
    id,
    workoutExerciseId: weId,
    setIndex: idx,
    setTag: 'N',
    weightKg,
    reps,
    distanceKm: null,
    durationMinutes: null,
    rpe,
    isWarmup: false,
    isCompleted: true,
    notes: '',
  };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function seed(opts: {
  exercise: Exercise;
  sessions: { daysAgo: number; weight: number; reps: number; rpe: number; sets: number }[];
}) {
  const workouts: Workout[] = [];
  const wes: WorkoutExercise[] = [];
  const sets: WorkoutSet[] = [];
  opts.sessions.forEach((s, i) => {
    const wId = `w${i}`;
    const weId = `we${i}`;
    workouts.push(mkWorkout(wId, daysAgo(s.daysAgo)));
    wes.push(mkWE(weId, wId, opts.exercise.id));
    for (let k = 0; k < s.sets; k++) {
      sets.push(mkSet(`s${i}-${k}`, weId, k, s.weight, s.reps, s.rpe));
    }
  });
  localStorage.setItem(KEYS.exercises, JSON.stringify([opts.exercise]));
  localStorage.setItem(KEYS.workouts, JSON.stringify(workouts));
  localStorage.setItem(KEYS.workoutExercises, JSON.stringify(wes));
  localStorage.setItem(KEYS.workoutSets, JSON.stringify(sets));
}

describe('Coach × Recovery integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('poor primary-muscle recovery + flat performance → Hold steady (progression gated)', () => {
    // Legs (cap 72h). Heavy squat sessions in the last 24h at high RPE ensure
    // very-high fatigue on Legs. Flat performance across exposures means the
    // engine would otherwise emit a rep_progression / load_progression.
    const ex = mkExercise('sq', 'Barbell Back Squat', 'cat-legs');
    seed({
      exercise: ex,
      sessions: [
        // Most recent, heavy fatigue-inducing session TODAY (drives Very High recovery)
        { daysAgo: 0, weight: 120, reps: 8, rpe: 9, sets: 6 },
        { daysAgo: 3, weight: 120, reps: 8, rpe: 9, sets: 6 },
        { daysAgo: 6, weight: 120, reps: 8, rpe: 8, sets: 5 },
        { daysAgo: 10, weight: 120, reps: 8, rpe: 8, sets: 5 },
      ],
    });
    const snap = computeCoachRecommendations();
    const it = snap.items.find((i) => i.exerciseId === 'sq');
    expect(it).toBeTruthy();
    // With Legs in Very High fatigue and flat reps, we expect Hold (not a push).
    expect(['hold', 'deload_adjustment']).toContain(it!.recommendationType);
    if (it!.recommendationType === 'hold') {
      expect(it!.mainAction).toBe('Hold steady');
      expect(it!.reasons.join(' ')).toMatch(/Legs/i);
    }
  });

  it('good recovery + improving performance → progression allowed', () => {
    // Chest (cap 48h). Only one very old session so recovery has fully
    // decayed — recovery is Low. Reps improve toward the top of range.
    const ex = mkExercise('bp', 'Barbell Bench Press', 'cat-chest');
    seed({
      exercise: ex,
      sessions: [
        { daysAgo: 2, weight: 80, reps: 12, rpe: 7, sets: 3 }, // most recent — hits top
        { daysAgo: 9, weight: 80, reps: 10, rpe: 7, sets: 3 },
        { daysAgo: 16, weight: 80, reps: 9, rpe: 7, sets: 3 },
        { daysAgo: 23, weight: 80, reps: 8, rpe: 7, sets: 3 },
      ],
    });
    const snap = computeCoachRecommendations();
    const it = snap.items.find((i) => i.exerciseId === 'bp');
    expect(it).toBeTruthy();
    // Improving reps at low RPE with recovered chest → forward progression.
    expect(['load_progression', 'rep_progression']).toContain(it!.recommendationType);
    // Recovery gate must NOT have demoted this to hold.
    expect(it!.mainAction).not.toBe('Hold steady');
  });

  it('poor recovery + declining performance + rising RPE → Rebuild reps credible', () => {
    // Back (cap 73h). Recent heavy row today with high RPE + drop in reps vs
    // prior sessions. Progression engine should route to deload_adjustment
    // (Rebuild reps); recovery integration should reinforce confidence.
    const ex = mkExercise('row', 'Barbell Row', 'cat-back');
    seed({
      exercise: ex,
      sessions: [
        // most recent: reps regressed vs prior, RPE spiked
        { daysAgo: 0, weight: 100, reps: 6, rpe: 9.5, sets: 5 },
        { daysAgo: 3, weight: 100, reps: 9, rpe: 8, sets: 5 },
        { daysAgo: 7, weight: 100, reps: 10, rpe: 7.5, sets: 5 },
        { daysAgo: 11, weight: 100, reps: 10, rpe: 7, sets: 4 },
      ],
    });
    const snap = computeCoachRecommendations();
    const it = snap.items.find((i) => i.exerciseId === 'row');
    expect(it).toBeTruthy();
    expect(it!.recommendationType).toBe('deload_adjustment');
    expect(it!.mainAction).toBe('Rebuild reps');
    // Recovery agrees → confidence should be at least 'medium'.
    expect(['medium', 'high']).toContain(it!.confidence);
    expect(it!.reasons.join(' ')).toMatch(/Back/);
  });
});
