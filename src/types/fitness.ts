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

export type WorkoutSource = 'manual' | 'routine';

export interface Workout {
  id: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  notes: string;
  /** Origin of the workout. 'routine' workouts must NOT have manual first-set autofill applied on top. */
  source?: WorkoutSource;
  /** ID of the routine that generated this workout, if source === 'routine'. */
  sourceRoutineId?: string | null;
}

export interface WorkoutExercise {
  id: string;
  workoutId: string;
  exerciseId: string;
  position: number;
  notes: string;
  defaultRestSeconds?: number | null;
}

export type SetTag = 'N' | 'W' | 'D' | 'F'; // Normal, Warmup, Dropset, Failure

export interface WorkoutSet {
  id: string;
  workoutExerciseId: string;
  setIndex: number;
  setTag: SetTag;
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  rpe: number | null;
  isWarmup: boolean;
  isCompleted: boolean;
  notes: string;
  restSeconds?: number | null;
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

export type RoutinePopulationMode = 'copy_previous' | 'predefined' | 'blank';

export interface RoutinePredefinedRow {
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  restSeconds: number | null;
}

export interface RoutineExercise {
  id: string;
  routineId: string;
  exerciseId: string;
  position: number;
  /** How sets are populated when this routine runs */
  populationMode?: RoutinePopulationMode;
  // Predefined-mode fields (used only when populationMode === 'predefined')
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  restSeconds: number | null;
  /** Predefined set type override; falls back to exercise.setType */
  predefinedSetType?: SetType | null;
  /** Per-row predefined set data; when present, takes precedence over sets/repsMin/repsMax. */
  predefinedRows?: RoutinePredefinedRow[];
  supersetGroup: string | null;
}

export interface BMIEntry {
  date: string;
  bmi: number;
  weightKg: number;
  heightCm: number;
}

export type GoalType =
  | 'MAX_WEIGHT'
  | 'MAX_REPS'
  | 'MAX_VOLUME'
  | 'MAX_WEIGHT_FOR_REPS'
  | 'MAX_WORKOUT_VOLUME'
  | 'MAX_WORKOUT_REPS'
  | 'TOTAL_VOLUME'
  | 'TOTAL_REPS'
  | 'ESTIMATED_1RM';

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  MAX_WEIGHT: 'Max Weight',
  MAX_REPS: 'Max Reps',
  MAX_VOLUME: 'Max Volume (single set)',
  MAX_WEIGHT_FOR_REPS: 'Max Weight for Reps',
  MAX_WORKOUT_VOLUME: 'Max Workout Volume',
  MAX_WORKOUT_REPS: 'Max Workout Reps',
  TOTAL_VOLUME: 'Total Volume',
  TOTAL_REPS: 'Total Reps',
  ESTIMATED_1RM: 'Estimated 1RM',
};

export interface ExerciseGoal {
  id: string;
  exerciseId: string;
  goalType: GoalType;
  targetValue: number;
  /** For MAX_WEIGHT_FOR_REPS: the rep count to hit at a given weight */
  targetReps?: number;
  startDate?: string;
  endDate?: string;
  createdAt: string;
}
