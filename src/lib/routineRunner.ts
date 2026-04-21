import { format } from 'date-fns';
import {
  generateId, getExercisesForRoutine, getExercises, getLatestSetsForExercise,
  addWorkout, addWorkoutExercise, addWorkoutSet, getWorkoutByDate, deleteWorkout,
} from '@/lib/storage';
import type { Routine, RoutineExercise, WorkoutSet, Exercise, SetTag } from '@/types/fitness';

function blankSet(weId: string, setIndex: number, restSeconds: number | null): WorkoutSet {
  return {
    id: generateId(),
    workoutExerciseId: weId,
    setIndex,
    weightKg: null,
    reps: null,
    distanceKm: null,
    durationMinutes: null,
    rpe: null,
    setTag: 'N',
    isWarmup: false,
    isCompleted: false,
    notes: '',
    restSeconds,
  };
}

function predefinedSet(weId: string, setIndex: number, re: RoutineExercise): WorkoutSet {
  return {
    id: generateId(),
    workoutExerciseId: weId,
    setIndex,
    weightKg: null,
    reps: re.repsMin ?? null,
    distanceKm: null,
    durationMinutes: null,
    rpe: null,
    setTag: 'N',
    isWarmup: false,
    isCompleted: false,
    notes: '',
    restSeconds: re.restSeconds ?? null,
  };
}

function copiedSet(weId: string, setIndex: number, src: WorkoutSet, fallbackRest: number | null): WorkoutSet {
  // Full row-by-row copy — every field comes from THIS specific previous set row.
  // Each call returns a brand-new object literal so rows can never share references.
  const srcReps = typeof src.reps === 'number' ? src.reps : null;
  const srcWeight = typeof src.weightKg === 'number' ? src.weightKg : null;
  const srcDistance = typeof src.distanceKm === 'number' ? src.distanceKm : null;
  const srcDuration = typeof src.durationMinutes === 'number' ? src.durationMinutes : null;
  const srcTag: SetTag = (src.setTag === 'W' || src.setTag === 'D' || src.setTag === 'F' || src.setTag === 'N')
    ? src.setTag
    : (src.isWarmup ? 'W' : 'N');
  const srcRest = typeof src.restSeconds === 'number' ? src.restSeconds : fallbackRest;
  return {
    id: generateId(),
    workoutExerciseId: weId,
    setIndex,
    weightKg: srcWeight,
    reps: srcReps,
    distanceKm: srcDistance,
    durationMinutes: srcDuration,
    rpe: null,
    setTag: srcTag,
    isWarmup: srcTag === 'W',
    isCompleted: false,
    notes: '',
    restSeconds: srcRest,
  };
}

/** Creates a workout for the given date from the routine, honoring each entry's populationMode. */
export function createWorkoutFromRoutine(routine: Routine, date: Date): string {
  const dateStr = format(date, 'yyyy-MM-dd');
  const entries = getExercisesForRoutine(routine.id);
  const allExercises = getExercises();

  // Resolve all previous sets BEFORE deleting today's workout
  const previousSetsMap = new Map<string, WorkoutSet[]>();
  entries.forEach(re => {
    if ((re.populationMode ?? 'predefined') === 'copy_previous') {
      previousSetsMap.set(re.exerciseId, getLatestSetsForExercise(re.exerciseId));
    }
  });

  // Now safe to replace today's workout
  const existing = getWorkoutByDate(dateStr);
  if (existing) deleteWorkout(existing.id);

  const workoutId = generateId();
  addWorkout({
    id: workoutId,
    date: dateStr,
    startTime: date.toISOString(),
    endTime: null,
    notes: `From ${routine.name}`,
  });

  entries.forEach((re, idx) => {
    const master: Exercise | undefined = allExercises.find(e => e.id === re.exerciseId);
    const weId = generateId();
    const mode = re.populationMode ?? 'predefined';

    addWorkoutExercise({
      id: weId,
      workoutId,
      exerciseId: re.exerciseId,
      position: idx,
      notes: '',
      defaultRestSeconds: re.restSeconds ?? master?.defaultRestSeconds ?? null,
    });

    if (mode === 'blank') {
      return;
    }

    if (mode === 'copy_previous') {
      const previous = previousSetsMap.get(re.exerciseId) ?? [];
      if (previous.length === 0) {
        addWorkoutSet(blankSet(weId, 0, re.restSeconds ?? master?.defaultRestSeconds ?? null));
        return;
      }
      previous.forEach((src, i) =>
        addWorkoutSet(copiedSet(weId, i, src, re.restSeconds ?? master?.defaultRestSeconds ?? null))
      );
      return;
    }

    // predefined
    const setsCount = Math.max(1, (re.sets ?? 1));
    for (let i = 0; i < setsCount; i++) {
      addWorkoutSet(predefinedSet(weId, i, re));
    }
  });

  return dateStr;
}
