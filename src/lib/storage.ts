import {
  UserProfile, Exercise, ExerciseCategory, Workout, WorkoutExercise,
  WorkoutSet, Routine, RoutineExercise, BMIEntry, WeightEntry, ExerciseGoal
} from '@/types/fitness';
import type { WeightUnitSetting } from '@/lib/units';
import { DEFAULT_CATEGORIES, DEFAULT_EXERCISES } from '@/data/seedData';

const STORAGE_KEYS = {
  profile: 'gym-profile',
  categories: 'gym-categories',
  exercises: 'gym-exercises',
  workouts: 'gym-workouts',
  workoutExercises: 'gym-workout-exercises',
  workoutSets: 'gym-workout-sets',
  routines: 'gym-routines',
  routineExercises: 'gym-routine-exercises',
  bmiHistory: 'gym-bmi-history',
  weightHistory: 'gym-weight-history',
  settings: 'gym-settings',
  exerciseGoals: 'gym-exercise-goals',
};

export function resetExerciseDefaults() {
  localStorage.removeItem(STORAGE_KEYS.exercises);
  localStorage.removeItem(STORAGE_KEYS.categories);
}

function get<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function set<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function generateId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Profile
export function getProfile(): UserProfile | null {
  return get<UserProfile | null>(STORAGE_KEYS.profile, null);
}
export function saveProfile(p: UserProfile) { set(STORAGE_KEYS.profile, p); }

// Categories
export function getCategories(): ExerciseCategory[] {
  const cats = get<ExerciseCategory[]>(STORAGE_KEYS.categories, []);
  if (cats.length === 0) { set(STORAGE_KEYS.categories, DEFAULT_CATEGORIES); return DEFAULT_CATEGORIES; }
  // Ensure all default categories exist (non-destructive merge)
  const existingIds = new Set(cats.map(c => c.id));
  const missing = DEFAULT_CATEGORIES.filter(dc => !existingIds.has(dc.id));
  if (missing.length > 0) {
    const merged = [...cats, ...missing];
    set(STORAGE_KEYS.categories, merged);
    return merged;
  }
  return cats;
}

// One-time cleanup: remove ghost UUID categories and remap exercises with UUID categoryIds to cat-abs
export function cleanupUuidCategories() {
  if (localStorage.getItem('categoryMigration_v2')) return;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i;
  const validIds = new Set(DEFAULT_CATEGORIES.map(c => c.id));

  // Clean categories: remove any with UUID-style IDs
  const cats = get<ExerciseCategory[]>(STORAGE_KEYS.categories, []);
  const uuidCatIds = new Set(cats.filter(c => !validIds.has(c.id) && UUID_RE.test(c.id)).map(c => c.id));
  if (uuidCatIds.size > 0) {
    set(STORAGE_KEYS.categories, cats.filter(c => !uuidCatIds.has(c.id)));
  }

  // Remap ALL exercises whose categoryId is a UUID (not a known default) → cat-abs
  const exs = get<Exercise[]>(STORAGE_KEYS.exercises, []);
  let changed = false;
  const fixed = exs.map(ex => {
    if (!validIds.has(ex.categoryId) && UUID_RE.test(ex.categoryId)) {
      changed = true;
      return { ...ex, categoryId: 'cat-abs' };
    }
    return ex;
  });
  if (changed) set(STORAGE_KEYS.exercises, fixed);

  localStorage.setItem('categoryMigration_v2', 'true');
}

// One-time migration: fix broken categoryIds on stored exercises
export function migrateCategoryIds() {
  const migrated = localStorage.getItem('categoryIdsMigrated_v1');
  if (migrated) return;

  const exercises = getExercises();
  const validCategoryIds = new Set(DEFAULT_CATEGORIES.map(c => c.id));

  const fixed = exercises.map(ex => {
    if (validCategoryIds.has(ex.categoryId)) return ex;
    const seedMatch = DEFAULT_EXERCISES.find(s => s.name === ex.name);
    if (seedMatch) return { ...ex, categoryId: seedMatch.categoryId };
    return ex;
  });

  saveExercises(fixed);
  localStorage.setItem('categoryIdsMigrated_v1', 'true');
}

// Re-seed: insert any missing DEFAULT_EXERCISES by ID
export function reseedMissingExercises() {
  const exs = getExercises();
  const existingIds = new Set(exs.map(e => e.id));
  const missing = DEFAULT_EXERCISES.filter(de => !existingIds.has(de.id));
  if (missing.length > 0) {
    saveExercises([...exs, ...missing]);
  }
}
export function saveCategories(cats: ExerciseCategory[]) { set(STORAGE_KEYS.categories, cats); }

// Exercises
export function getExercises(): Exercise[] {
  const exs = get<Exercise[]>(STORAGE_KEYS.exercises, []);
  if (exs.length === 0) { set(STORAGE_KEYS.exercises, DEFAULT_EXERCISES); return DEFAULT_EXERCISES; }
  // Migrate old exercises missing new fields
  return exs.map(ex => ({
    ...ex,
    setType: ex.setType ?? (ex.type === 'CARDIO' ? 'REPS_DISTANCE' : 'WEIGHT_REPS'),
    weightUnit: ex.weightUnit ?? 'kg',
  }));
}
export function saveExercises(exs: Exercise[]) { set(STORAGE_KEYS.exercises, exs); }
export function addExercise(ex: Exercise) { const all = getExercises(); all.push(ex); saveExercises(all); }

// Exercise usage frequency map (exerciseId → count)
export function getExerciseUsageFrequency(): Record<string, number> {
  const wes = getWorkoutExercises();
  const freq: Record<string, number> = {};
  for (const we of wes) {
    freq[we.exerciseId] = (freq[we.exerciseId] || 0) + 1;
  }
  return freq;
}
export function toggleFavorite(id: string) {
  const all = getExercises();
  const idx = all.findIndex(e => e.id === id);
  if (idx >= 0) { all[idx].isFavorite = !all[idx].isFavorite; saveExercises(all); }
}

// Workouts
export function getWorkouts(): Workout[] { return get<Workout[]>(STORAGE_KEYS.workouts, []); }
export function saveWorkouts(w: Workout[]) { set(STORAGE_KEYS.workouts, w); }
export function getWorkoutByDate(date: string): Workout | undefined {
  return getWorkouts().find(w => w.date === date);
}
export function addWorkout(w: Workout) { const all = getWorkouts(); all.push(w); saveWorkouts(all); }
export function updateWorkout(w: Workout) {
  const all = getWorkouts();
  const idx = all.findIndex(x => x.id === w.id);
  if (idx >= 0) all[idx] = w;
  saveWorkouts(all);
}
export function deleteWorkout(id: string) {
  const weIds = getWorkoutExercises().filter(we => we.workoutId === id).map(we => we.id);
  saveWorkoutSets(getWorkoutSets().filter(s => !weIds.includes(s.workoutExerciseId)));
  saveWorkoutExercises(getWorkoutExercises().filter(we => we.workoutId !== id));
  saveWorkouts(getWorkouts().filter(w => w.id !== id));
}

export function copyWorkoutToDate(workoutId: string, targetDate: string) {
  const workout = getWorkouts().find(w => w.id === workoutId);
  if (!workout) return;
  // Remove existing workout on target date
  const existing = getWorkouts().find(w => w.date === targetDate);
  if (existing) deleteWorkout(existing.id);
  const newWorkoutId = generateId();
  addWorkout({ ...workout, id: newWorkoutId, date: targetDate, startTime: new Date().toISOString(), endTime: null });
  const wExercises = getExercisesForWorkout(workoutId);
  wExercises.forEach(we => {
    const newWeId = generateId();
    addWorkoutExercise({ ...we, id: newWeId, workoutId: newWorkoutId });
    const sets = getSetsForWorkoutExercise(we.id);
    sets.forEach(s => {
      addWorkoutSet({ ...s, id: generateId(), workoutExerciseId: newWeId, isCompleted: false });
    });
  });
}

export function moveWorkoutToDate(workoutId: string, targetDate: string) {
  const existing = getWorkouts().find(w => w.date === targetDate);
  if (existing) deleteWorkout(existing.id);
  const workout = getWorkouts().find(w => w.id === workoutId);
  if (!workout) return;
  updateWorkout({ ...workout, date: targetDate });
}

// WorkoutExercises
export function getWorkoutExercises(): WorkoutExercise[] { return get<WorkoutExercise[]>(STORAGE_KEYS.workoutExercises, []); }
export function saveWorkoutExercises(we: WorkoutExercise[]) { set(STORAGE_KEYS.workoutExercises, we); }
export function getExercisesForWorkout(workoutId: string): WorkoutExercise[] {
  return getWorkoutExercises().filter(we => we.workoutId === workoutId).sort((a, b) => a.position - b.position);
}
export function addWorkoutExercise(we: WorkoutExercise) { const all = getWorkoutExercises(); all.push(we); saveWorkoutExercises(all); }
export function updateWorkoutExercise(we: WorkoutExercise) { saveWorkoutExercises(getWorkoutExercises().map(x => x.id === we.id ? we : x)); }
export function removeWorkoutExercise(id: string) {
  saveWorkoutExercises(getWorkoutExercises().filter(we => we.id !== id));
  saveWorkoutSets(getWorkoutSets().filter(s => s.workoutExerciseId !== id));
}

// WorkoutSets
export function getWorkoutSets(): WorkoutSet[] {
  return get<WorkoutSet[]>(STORAGE_KEYS.workoutSets, []).map(s => ({ ...s, setTag: s.setTag ?? 'N' }));
}
export function saveWorkoutSets(s: WorkoutSet[]) { set(STORAGE_KEYS.workoutSets, s); }
export function getSetsForWorkoutExercise(weId: string): WorkoutSet[] {
  return getWorkoutSets().filter(s => s.workoutExerciseId === weId).sort((a, b) => a.setIndex - b.setIndex);
}
export function addWorkoutSet(s: WorkoutSet) { const all = getWorkoutSets(); all.push(s); saveWorkoutSets(all); }
export function updateWorkoutSet(s: WorkoutSet) {
  const all = getWorkoutSets();
  const idx = all.findIndex(x => x.id === s.id);
  if (idx >= 0) all[idx] = s;
  saveWorkoutSets(all);
}
export function deleteWorkoutSet(id: string) {
  saveWorkoutSets(getWorkoutSets().filter(s => s.id !== id));
}

// Routines
export function getRoutines(): Routine[] { return get<Routine[]>(STORAGE_KEYS.routines, []); }
export function saveRoutines(r: Routine[]) { set(STORAGE_KEYS.routines, r); }
export function addRoutine(r: Routine) { const all = getRoutines(); all.push(r); saveRoutines(all); }
export function updateRoutine(r: Routine) {
  const all = getRoutines();
  const idx = all.findIndex(x => x.id === r.id);
  if (idx >= 0) all[idx] = r;
  saveRoutines(all);
}
export function deleteRoutine(id: string) {
  saveRoutines(getRoutines().filter(r => r.id !== id));
  saveRoutineExercises(getRoutineExercises().filter(re => re.routineId !== id));
}

// RoutineExercises
export function getRoutineExercises(): RoutineExercise[] { return get<RoutineExercise[]>(STORAGE_KEYS.routineExercises, []); }
export function saveRoutineExercises(re: RoutineExercise[]) { set(STORAGE_KEYS.routineExercises, re); }
export function getExercisesForRoutine(routineId: string): RoutineExercise[] {
  return getRoutineExercises().filter(re => re.routineId === routineId).sort((a, b) => a.position - b.position);
}
export function addRoutineExercise(re: RoutineExercise) { const all = getRoutineExercises(); all.push(re); saveRoutineExercises(all); }
export function removeRoutineExercise(id: string) {
  saveRoutineExercises(getRoutineExercises().filter(re => re.id !== id));
}

// BMI History
export function getBMIHistory(): BMIEntry[] { return get<BMIEntry[]>(STORAGE_KEYS.bmiHistory, []); }
export function addBMIEntry(entry: BMIEntry) { const all = getBMIHistory(); all.push(entry); set(STORAGE_KEYS.bmiHistory, all); }

// Weight History
export function getWeightHistory(): WeightEntry[] { return get<WeightEntry[]>(STORAGE_KEYS.weightHistory, []); }
export function addWeightEntry(entry: WeightEntry) { const all = getWeightHistory(); all.push(entry); set(STORAGE_KEYS.weightHistory, all); }

// Settings
export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  units: 'metric' | 'imperial';
  weightUnit: WeightUnitSetting;
  defaultRestSeconds: number;
  keepScreenOn: boolean;
}
export function getSettings(): AppSettings {
  const s = get<AppSettings>(STORAGE_KEYS.settings, {
    theme: 'dark', units: 'metric', weightUnit: 'kg', defaultRestSeconds: 90, keepScreenOn: true
  });
  return { ...s, weightUnit: s.weightUnit ?? 'kg' };
}
export function saveSettings(s: AppSettings) { set(STORAGE_KEYS.settings, s); }

// Utility: calculate stats
function hasMeaningfulSetData(set: WorkoutSet): boolean {
  return [set.weightKg, set.reps, set.distanceKm, set.durationMinutes].some(
    (value) => typeof value === 'number' && value > 0,
  );
}

export function getExerciseHistory(exerciseId: string) {
  const workouts = getWorkouts().sort((a, b) => b.date.localeCompare(a.date));
  const wes = getWorkoutExercises().filter((we) => we.exerciseId === exerciseId);
  const allSets = getWorkoutSets();

  return workouts
    .map((w) => {
      const we = wes.find((x) => x.workoutId === w.id);
      if (!we) return null;

      const sessionSets = allSets
        .filter((s) => s.workoutExerciseId === we.id && !s.isWarmup)
        .sort((a, b) => a.setIndex - b.setIndex);

      const completedSets = sessionSets.filter((s) => s.isCompleted && hasMeaningfulSetData(s));
      const fallbackSets = sessionSets.filter(hasMeaningfulSetData);
      const sets = completedSets.length > 0 ? completedSets : fallbackSets;

      if (sets.length === 0) return null;
      return { date: w.date, sets, exerciseNotes: we.notes || '' };
    })
    .filter(Boolean) as { date: string; sets: WorkoutSet[]; exerciseNotes: string }[];
}

export function getPersonalRecord(exerciseId: string): { weight: number; reps: number; date: string } | null {
  const history = getExerciseHistory(exerciseId);
  let best: { weight: number; reps: number; date: string } | null = null;

  for (const session of history) {
    for (const s of session.sets) {
      const hasValidWeight = typeof s.weightKg === 'number' && s.weightKg > 0;
      const hasValidReps = typeof s.reps === 'number' && s.reps > 0;
      if (!hasValidWeight || !hasValidReps) continue;

      const e1rm = s.weightKg * (1 + s.reps / 30); // Epley
      const bestE1rm = best ? best.weight * (1 + best.reps / 30) : 0;

      if (e1rm > bestE1rm) {
        best = { weight: s.weightKg, reps: s.reps, date: session.date };
      }
    }
  }

  return best;
}

// Exercise Goals
export function getExerciseGoals(): ExerciseGoal[] { return get<ExerciseGoal[]>(STORAGE_KEYS.exerciseGoals, []); }
export function getGoalsForExercise(exerciseId: string): ExerciseGoal[] {
  return getExerciseGoals().filter(g => g.exerciseId === exerciseId);
}
export function addExerciseGoal(goal: ExerciseGoal) {
  const all = getExerciseGoals(); all.push(goal); set(STORAGE_KEYS.exerciseGoals, all);
}
export function deleteExerciseGoal(id: string) {
  set(STORAGE_KEYS.exerciseGoals, getExerciseGoals().filter(g => g.id !== id));
}
