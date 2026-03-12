import { ExerciseCategory, Exercise } from '@/types/fitness';

export const DEFAULT_CATEGORIES: ExerciseCategory[] = [
  { id: 'cat-chest', name: 'Chest', sortOrder: 0 },
  { id: 'cat-back', name: 'Back', sortOrder: 1 },
  { id: 'cat-legs', name: 'Legs', sortOrder: 2 },
  { id: 'cat-shoulders', name: 'Shoulders', sortOrder: 3 },
  { id: 'cat-arms', name: 'Arms', sortOrder: 4 },
  { id: 'cat-core', name: 'Core', sortOrder: 5 },
  { id: 'cat-olympic', name: 'Olympic', sortOrder: 6 },
  { id: 'cat-cardio', name: 'Cardio', sortOrder: 7 },
];

export const DEFAULT_EXERCISES: Exercise[] = [
  // Chest
  { id: 'ex-bench', name: 'Bench Press', categoryId: 'cat-chest', type: 'RESISTANCE', defaultRepsMin: 6, defaultRepsMax: 12, defaultSets: 4, defaultRestSeconds: 120, notes: '', isFavorite: false, isCustom: false },
  { id: 'ex-incline-bench', name: 'Incline Bench Press', categoryId: 'cat-chest', type: 'RESISTANCE', defaultRepsMin: 8, defaultRepsMax: 12, defaultSets: 3, defaultRestSeconds: 90, notes: '', isFavorite: false, isCustom: false },
  { id: 'ex-dumbbell-fly', name: 'Dumbbell Fly', categoryId: 'cat-chest', type: 'RESISTANCE', defaultRepsMin: 10, defaultRepsMax: 15, defaultSets: 3, defaultRestSeconds: 60, notes: '', isFavorite: false, isCustom: false },
  { id: 'ex-chest-dip', name: 'Chest Dip', categoryId: 'cat-chest', type: 'RESISTANCE', defaultRepsMin: 8, defaultRepsMax: 15, defaultSets: 3, defaultRestSeconds: 90, notes: '', isFavorite: false, isCustom: false },
  { id: 'ex-pushup', name: 'Push-Up', categoryId: 'cat-chest', type: 'RESISTANCE', defaultRepsMin: 10, defaultRepsMax: 25, defaultSets: 3, defaultRestSeconds: 60, notes: '', isFavorite: false, isCustom: false },
  // Back
  { id: 'ex-deadlift', name: 'Deadlift', categoryId: 'cat-back', type: 'RESISTANCE', defaultRepsMin: 3, defaultRepsMax: 8, defaultSets: 4, defaultRestSeconds: 180, notes: '', isFavorite: false, isCustom: false },
  { id: 'ex-barbell-row', name: 'Barbell Row', categoryId: 'cat-back', type: 'RESISTANCE', defaultRepsMin: 6, defaultRepsMax: 12, defaultSets: 4, defaultRestSeconds: 120, notes: '', isFavorite: false, isCustom: false },
  { id: 'ex-pullup', name: 'Pull-Up', categoryId: 'cat-back', type: 'RESISTANCE', defaultRepsMin: 5, defaultRepsMax: 12, defaultSets: 3, defaultRestSeconds: 90, notes: '', isFavorite: false, isCustom: false },
  { id: 'ex-lat-pulldown', name: 'Lat Pulldown', categoryId: 'cat-back', type: 'RESISTANCE', defaultRepsMin: 8, defaultRepsMax: 12, defaultSets: 3, defaultRestSeconds: 90, notes: '', isFavorite: false, isCustom: false },
  { id: 'ex-seated-row', name: 'Seated Cable Row', categoryId: 'cat-back', type: 'RESISTANCE', defaultRepsMin: 8, defaultRepsMax: 12, defaultSets: 3, defaultRestSeconds: 90, notes: '', isFavorite: false, isCustom: false },
  // Legs
  { id: 'ex-squat', name: 'Barbell Squat', categoryId: 'cat-legs', type: 'RESISTANCE', defaultRepsMin: 5, defaultRepsMax: 10, defaultSets: 4, defaultRestSeconds: 180, notes: '', isFavorite: false, isCustom: false },
  { id: 'ex-leg-press', name: 'Leg Press', categoryId: 'cat-legs', type: 'RESISTANCE', defaultRepsMin: 8, defaultRepsMax: 15, defaultSets: 3, defaultRestSeconds: 120, notes: '', isFavorite: false, isCustom: false },
  { id: 'ex-rdl', name: 'Romanian Deadlift', categoryId: 'cat-legs', type: 'RESISTANCE', defaultRepsMin: 8, defaultRepsMax: 12, defaultSets: 3, defaultRestSeconds: 120, notes: '', isFavorite: false, isCustom: false },
  { id: 'ex-lunge', name: 'Walking Lunge', categoryId: 'cat-legs', type: 'RESISTANCE', defaultRepsMin: 10, defaultRepsMax: 15, defaultSets: 3, defaultRestSeconds: 90, notes: '', isFavorite: false, isCustom: false },
  { id: 'ex-leg-curl', name: 'Leg Curl', categoryId: 'cat-legs', type: 'RESISTANCE', defaultRepsMin: 10, defaultRepsMax: 15, defaultSets: 3, defaultRestSeconds: 60, notes: '', isFavorite: false, isCustom: false },
  { id: 'ex-calf-raise', name: 'Calf Raise', categoryId: 'cat-legs', type: 'RESISTANCE', defaultRepsMin: 12, defaultRepsMax: 20, defaultSets: 4, defaultRestSeconds: 60, notes: '', isFavorite: false, isCustom: false },
  // Shoulders
  { id: 'ex-ohp', name: 'Overhead Press', categoryId: 'cat-shoulders', type: 'RESISTANCE', defaultRepsMin: 6, defaultRepsMax: 10, defaultSets: 4, defaultRestSeconds: 120, notes: '', isFavorite: false, isCustom: false },
  { id: 'ex-lateral-raise', name: 'Lateral Raise', categoryId: 'cat-shoulders', type: 'RESISTANCE', defaultRepsMin: 12, defaultRepsMax: 20, defaultSets: 3, defaultRestSeconds: 60, notes: '', isFavorite: false, isCustom: false },
  { id: 'ex-face-pull', name: 'Face Pull', categoryId: 'cat-shoulders', type: 'RESISTANCE', defaultRepsMin: 12, defaultRepsMax: 20, defaultSets: 3, defaultRestSeconds: 60, notes: '', isFavorite: false, isCustom: false },
  // Arms
  { id: 'ex-curl', name: 'Barbell Curl', categoryId: 'cat-arms', type: 'RESISTANCE', defaultRepsMin: 8, defaultRepsMax: 12, defaultSets: 3, defaultRestSeconds: 60, notes: '', isFavorite: false, isCustom: false },
  { id: 'ex-tricep-pushdown', name: 'Tricep Pushdown', categoryId: 'cat-arms', type: 'RESISTANCE', defaultRepsMin: 10, defaultRepsMax: 15, defaultSets: 3, defaultRestSeconds: 60, notes: '', isFavorite: false, isCustom: false },
  { id: 'ex-hammer-curl', name: 'Hammer Curl', categoryId: 'cat-arms', type: 'RESISTANCE', defaultRepsMin: 10, defaultRepsMax: 15, defaultSets: 3, defaultRestSeconds: 60, notes: '', isFavorite: false, isCustom: false },
  // Core
  { id: 'ex-plank', name: 'Plank', categoryId: 'cat-core', type: 'RESISTANCE', defaultRepsMin: null, defaultRepsMax: null, defaultSets: 3, defaultRestSeconds: 60, notes: 'Hold for time', isFavorite: false, isCustom: false },
  { id: 'ex-crunch', name: 'Cable Crunch', categoryId: 'cat-core', type: 'RESISTANCE', defaultRepsMin: 12, defaultRepsMax: 20, defaultSets: 3, defaultRestSeconds: 60, notes: '', isFavorite: false, isCustom: false },
  { id: 'ex-hanging-leg-raise', name: 'Hanging Leg Raise', categoryId: 'cat-core', type: 'RESISTANCE', defaultRepsMin: 8, defaultRepsMax: 15, defaultSets: 3, defaultRestSeconds: 60, notes: '', isFavorite: false, isCustom: false },
  // Olympic
  { id: 'ex-clean', name: 'Power Clean', categoryId: 'cat-olympic', type: 'RESISTANCE', defaultRepsMin: 2, defaultRepsMax: 5, defaultSets: 5, defaultRestSeconds: 180, notes: '', isFavorite: false, isCustom: false },
  { id: 'ex-snatch', name: 'Snatch', categoryId: 'cat-olympic', type: 'RESISTANCE', defaultRepsMin: 1, defaultRepsMax: 3, defaultSets: 5, defaultRestSeconds: 180, notes: '', isFavorite: false, isCustom: false },
  // Cardio
  { id: 'ex-treadmill', name: 'Treadmill Run', categoryId: 'cat-cardio', type: 'CARDIO', defaultRepsMin: null, defaultRepsMax: null, defaultSets: 1, defaultRestSeconds: null, notes: '', isFavorite: false, isCustom: false },
  { id: 'ex-cycling', name: 'Stationary Bike', categoryId: 'cat-cardio', type: 'CARDIO', defaultRepsMin: null, defaultRepsMax: null, defaultSets: 1, defaultRestSeconds: null, notes: '', isFavorite: false, isCustom: false },
  { id: 'ex-rowing', name: 'Rowing Machine', categoryId: 'cat-cardio', type: 'CARDIO', defaultRepsMin: null, defaultRepsMax: null, defaultSets: 1, defaultRestSeconds: null, notes: '', isFavorite: false, isCustom: false },
];
