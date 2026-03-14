export type ExerciseType = 'RESISTANCE' | 'CARDIO';

export type SetType = 'WEIGHT_REPS' | 'WEIGHT_TIME' | 'REPS_DISTANCE' | 'REPS_TIME' | 'WEIGHT_ONLY';

export type WeightUnit = 'kg' | 'lb';

export const SET_TYPE_LABELS: Record<SetType, string> = {
  WEIGHT_REPS: 'Weight + Reps',
  WEIGHT_TIME: 'Weight + Time',
  REPS_DISTANCE: 'Reps + Distance',
  REPS_TIME: 'Reps + Time',
  WEIGHT_ONLY: 'Weight Only',
};

export interface UserProfile {
  id: string;
  name: string;
  heightCm: number;
  currentWeightKg: number;
  goalWeightKg: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WeightEntry {
  date: string;
  weightKg: number;
}

export interface ExerciseCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface Exercise {
  id: string;
  name: string;
  categoryId: string;
  type: ExerciseType;
  setType: SetType;
  weightUnit: WeightUnit;
  defaultRepsMin: number | null;
  defaultRepsMax: number | null;
  defaultSets: number | null;
  defaultRestSeconds: number | null;
  notes: string;
  isFavorite: boolean;
  isCustom: boolean;
}

export interface Workout {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  notes: string;
}

export interface WorkoutExercise {
  id: string;
  workoutId: string;
  exerciseId: string;
  position: number;
  notes: string;
}

export interface WorkoutSet {
  id: string;
  workoutExerciseId: string;
  setIndex: number;
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  rpe: number | null;
  isWarmup: boolean;
  isCompleted: boolean;
  notes: string;
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

export interface RoutineExercise {
  id: string;
  routineId: string;
  exerciseId: string;
  position: number;
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  restSeconds: number | null;
  supersetGroup: string | null;
}

export interface BMIEntry {
  date: string;
  bmi: number;
  weightKg: number;
  heightCm: number;
}
