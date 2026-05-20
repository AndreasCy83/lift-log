import { format } from 'date-fns';
import {
  generateId, getExercisesForRoutine, getExercises, getLatestSetsForExercise,
  addWorkout, addWorkoutExercise, addWorkoutSet, getWorkoutByDate, deleteWorkout,
  getExercisesForWorkout,
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

function predefinedSet(
  weId: string,
  setIndex: number,
  re: RoutineExercise,
  setType: import('@/types/fitness').SetType | undefined,
  row?: import('@/types/fitness').RoutinePredefinedRow,
): WorkoutSet {
  const fallbackRest = re.restSeconds ?? null;
  const tag: SetTag = row?.setTag ?? 'N';
  const base: WorkoutSet = {
    id: generateId(),
    workoutExerciseId: weId,
    setIndex,
    weightKg: null,
    reps: null,
    distanceKm: null,
    durationMinutes: null,
    rpe: null,
    setTag: tag,
    isWarmup: tag === 'W',
    isCompleted: false,
    notes: '',
    restSeconds: row?.restSeconds ?? fallbackRest,
  };

  // Legacy path: no per-row data
  if (!row) {
    return { ...base, reps: re.repsMin ?? null };
  }

  // Per-row, branch by setType
  switch (setType) {
    case 'WEIGHT_REPS':
      return { ...base, weightKg: row.weightKg, reps: row.reps };
    case 'REPS_DISTANCE':
      return { ...base, reps: row.reps, distanceKm: row.distanceKm };
    case 'REPS_TIME':
      return { ...base, reps: row.reps, durationMinutes: row.durationMinutes };
    case 'WEIGHT_TIME':
      return { ...base, weightKg: row.weightKg, durationMinutes: row.durationMinutes };
    case 'WEIGHT_ONLY':
      return { ...base, weightKg: row.weightKg };
    default:
      return { ...base, reps: row.reps, weightKg: row.weightKg };
  }
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

    // predefined — prefer per-row setType-aware data when present
    const setType = master?.setType;
    if (re.predefinedRows && re.predefinedRows.length > 0) {
      re.predefinedRows.forEach((row, i) => {
        addWorkoutSet(predefinedSet(weId, i, re, setType, row));
      });
    } else {
      const setsCount = Math.max(1, (re.sets ?? 1));
      for (let i = 0; i < setsCount; i++) {
        addWorkoutSet(predefinedSet(weId, i, re, setType));
      }
    }
  });

  return dateStr;
}

/** Appends a routine's exercises into an existing workout WITHOUT removing current exercises. */
export function appendRoutineToWorkout(routine: Routine, workoutId: string): number {
  const entries = getExercisesForRoutine(routine.id);
  if (entries.length === 0) return 0;
  const allExercises = getExercises();

  const { getExercisesForWorkout } = require('@/lib/storage') as typeof import('@/lib/storage');
  const startPos = getExercisesForWorkout(workoutId).length;

  const previousSetsMap = new Map<string, WorkoutSet[]>();
  entries.forEach(re => {
    if ((re.populationMode ?? 'predefined') === 'copy_previous') {
      previousSetsMap.set(re.exerciseId, getLatestSetsForExercise(re.exerciseId));
    }
  });

  entries.forEach((re, idx) => {
    const master: Exercise | undefined = allExercises.find(e => e.id === re.exerciseId);
    const weId = generateId();
    const mode = re.populationMode ?? 'predefined';

    addWorkoutExercise({
      id: weId,
      workoutId,
      exerciseId: re.exerciseId,
      position: startPos + idx,
      notes: '',
      defaultRestSeconds: re.restSeconds ?? master?.defaultRestSeconds ?? null,
    });

    if (mode === 'blank') return;

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

    const setType = master?.setType;
    if (re.predefinedRows && re.predefinedRows.length > 0) {
      re.predefinedRows.forEach((row, i) => {
        addWorkoutSet(predefinedSet(weId, i, re, setType, row));
      });
    } else {
      const setsCount = Math.max(1, (re.sets ?? 1));
      for (let i = 0; i < setsCount; i++) {
        addWorkoutSet(predefinedSet(weId, i, re, setType));
      }
    }
  });

  return entries.length;
}
