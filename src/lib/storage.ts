import {
  UserProfile, Exercise, ExerciseCategory, Workout, WorkoutExercise,
  WorkoutSet, Routine, RoutineExercise, BMIEntry, WeightEntry
} from '@/types/fitness';
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
  return cats;
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
  saveWorkouts(getWorkouts().filter(w => w.id !== id));
  saveWorkoutExercises(getWorkoutExercises().filter(we => we.workoutId !== id));
  // Also clean up sets
  const weIds = getWorkoutExercises().filter(we => we.workoutId === id).map(we => we.id);
  saveWorkoutSets(getWorkoutSets().filter(s => !weIds.includes(s.workoutExerciseId)));
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
  defaultRestSeconds: number;
  keepScreenOn: boolean;
}
export function getSettings(): AppSettings {
  return get<AppSettings>(STORAGE_KEYS.settings, {
    theme: 'dark', units: 'metric', defaultRestSeconds: 90, keepScreenOn: true
  });
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
      return { date: w.date, sets };
    })
    .filter(Boolean) as { date: string; sets: WorkoutSet[] }[];
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
