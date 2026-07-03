import { describe, it, expect, beforeEach } from 'vitest';
import {
  addExercise,
  addRoutine,
  addRoutineExercise,
  getExercisesForWorkout,
  getSetsForWorkoutExercise,
  getWorkoutByDate,
} from './storage';
import { createWorkoutFromRoutine } from './routineRunner';
import { applyCoachRecommendation } from './coachApply';
import type { ProgressionRecommendation } from './progressionEngine';
import type { Exercise, Routine } from '@/types/fitness';

const EX_ID = 'ex-machine-chest-press';
const ROUTINE_ID = 'routine-push-day';

function seed() {
  localStorage.clear();
  const ex: Exercise = {
    id: EX_ID,
    name: 'Machine Chest Press',
    categoryId: 'cat-chest',
    type: 'RESISTANCE',
    setType: 'WEIGHT_REPS',
    weightUnit: 'kg',
    defaultRepsMin: 8,
    defaultRepsMax: 8,
    defaultSets: 3,
    defaultRestSeconds: 90,
    notes: '',
    isFavorite: false,
    isCustom: false,
  };
  addExercise(ex);

  const routine: Routine = {
    id: ROUTINE_ID,
    name: 'Push Day',
    description: '',
    isActive: true,
  };
  addRoutine(routine);
  addRoutineExercise({
    id: 're-1',
    routineId: ROUTINE_ID,
    exerciseId: EX_ID,
    position: 0,
    populationMode: 'predefined',
    sets: 3,
    repsMin: 8,
    repsMax: 8,
    restSeconds: 90,
    supersetGroup: null,
    predefinedRows: [
      { weightKg: 40, reps: 8, distanceKm: null, durationMinutes: null, restSeconds: 90, setTag: 'W' },
      { weightKg: 60, reps: 8, distanceKm: null, durationMinutes: null, restSeconds: 90, setTag: 'N' },
      { weightKg: 60, reps: 8, distanceKm: null, durationMinutes: null, restSeconds: 90, setTag: 'N' },
      { weightKg: 60, reps: 8, distanceKm: null, durationMinutes: null, restSeconds: 90, setTag: 'N' },
    ],
  });
}

function repRec(): ProgressionRecommendation {
  return {
    exerciseId: EX_ID,
    exerciseName: 'Machine Chest Press',
    recommendationType: 'rep_progression',
    currentSets: 3,
    nextSets: 3,
    currentRepInfo: '8',
    nextRepInfo: '9',
    currentWeightKg: 60,
    nextWeightKg: 60,
    confidence: 'medium',
    reasons: ['Test'],
    guardrailBlocked: false,
    createdAt: new Date().toISOString(),
  };
}

function runRoutine() {
  createWorkoutFromRoutine(
    { id: ROUTINE_ID, name: 'Push Day', description: '', isActive: true },
    new Date(),
  );
  const dateStr = new Date().toISOString().slice(0, 10);
  const w = getWorkoutByDate(dateStr)!;
  const we = getExercisesForWorkout(w.id).find((x) => x.exerciseId === EX_ID)!;
  return getSetsForWorkoutExercise(we.id);
}

describe('Coach apply → routine run', () => {
  beforeEach(seed);

  it('applies Increase reps 8→9 to working sets, leaves warmups untouched', () => {
    applyCoachRecommendation(repRec()); // no future workout → pending override stored
    const sets = runRoutine();
    const warmups = sets.filter((s) => s.setTag === 'W' || s.isWarmup);
    const working = sets.filter((s) => s.setTag !== 'W' && !s.isWarmup);
    expect(warmups.length).toBe(1);
    expect(warmups[0].reps).toBe(8);        // warmup untouched
    expect(warmups[0].weightKg).toBe(40);
    expect(working.length).toBe(3);
    for (const s of working) {
      expect(s.reps).toBe(9);               // Coach override applied
      expect(s.weightKg).toBe(60);
    }
  });

  it('preserves the Coach override across a same-day rerun of the routine', () => {
    applyCoachRecommendation(repRec());
    runRoutine();       // first run
    const sets = runRoutine(); // rebuild same-day workout
    const working = sets.filter((s) => s.setTag !== 'W' && !s.isWarmup);
    expect(working.length).toBe(3);
    for (const s of working) {
      expect(s.reps).toBe(9);
      expect(s.weightKg).toBe(60);
    }
    const warmup = sets.find((s) => s.setTag === 'W')!;
    expect(warmup.reps).toBe(8);
  });
});
