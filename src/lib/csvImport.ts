import {
  Workout, WorkoutExercise, WorkoutSet, Exercise, ExerciseCategory
} from '@/types/fitness';
import {
  generateId, getWorkouts, saveWorkouts, getWorkoutExercises, saveWorkoutExercises,
  getWorkoutSets, saveWorkoutSets, getExercises, saveExercises, getCategories, saveCategories
} from '@/lib/storage';

interface ImportResult {
  workoutCount: number;
  setCount: number;
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function findOrCreateCategory(name: string, categories: ExerciseCategory[]): string {
  const match = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (match) return match.id;
  const newCat: ExerciseCategory = {
    id: generateId(),
    name,
    sortOrder: categories.length,
  };
  categories.push(newCat);
  return newCat.id;
}

function findOrCreateExercise(name: string, categoryName: string, exercises: Exercise[], categories: ExerciseCategory[]): string {
  const match = exercises.find(e => e.name.toLowerCase() === name.toLowerCase());
  if (match) return match.id;
  const categoryId = findOrCreateCategory(categoryName, categories);
  const newEx: Exercise = {
    id: generateId(),
    name,
    categoryId,
    type: 'RESISTANCE',
    setType: 'WEIGHT_REPS',
    weightUnit: 'kg',
    defaultRepsMin: 8,
    defaultRepsMax: 12,
    defaultSets: 3,
    defaultRestSeconds: 90,
    notes: '',
    isFavorite: false,
    isCustom: true,
  };
  exercises.push(newEx);
  return newEx.id;
}

export function importCsvData(csvText: string): ImportResult {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return { workoutCount: 0, setCount: 0 };

  const headerFields = parseCsvLine(lines[0]);
  const colCount = headerFields.length;
  // FitNotes: 10 cols (no Time Unit), Our format: 11 cols
  const isFitNotes = colCount <= 10;

  const workouts = getWorkouts();
  const workoutExercises = getWorkoutExercises();
  const workoutSets = getWorkoutSets();
  const exercises = getExercises();
  const categories = getCategories();

  const workoutMap = new Map<string, Workout>();
  for (const w of workouts) workoutMap.set(w.date, w);

  // Track workout-exercise combos to append sets
  const weMap = new Map<string, WorkoutExercise>();
  for (const we of workoutExercises) {
    const w = workouts.find(wk => wk.id === we.workoutId);
    if (w) weMap.set(`${w.date}|${we.exerciseId}`, we);
  }

  const newWorkouts: Workout[] = [];
  const newWEs: WorkoutExercise[] = [];
  const newSets: WorkoutSet[] = [];
  const createdWorkoutDates = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length < 6) continue;

    // Map columns based on format
    let date: string, exName: string, catName: string, weight: string, weightUnit: string, reps: string;
    let distance = '', distanceUnit = '', time = '', comment = '';

    if (isFitNotes) {
      // Date, Exercise, Category, Weight, Weight Unit, Reps, Distance, Distance Unit, Time, Comment
      [date, exName, catName, weight, weightUnit, reps] = fields;
      distance = fields[6] ?? '';
      distanceUnit = fields[7] ?? '';
      time = fields[8] ?? '';
      comment = fields[9] ?? '';
    } else {
      // Date, Exercise, Category, Weight, Weight Unit, Reps, Distance, Distance Unit, Time, Time Unit, Comment
      [date, exName, catName, weight, weightUnit, reps] = fields;
      distance = fields[6] ?? '';
      distanceUnit = fields[7] ?? '';
      time = fields[8] ?? '';
      // fields[9] = Time Unit (skip)
      comment = fields[10] ?? '';
    }

    // Skip empty data rows
    const hasData = [weight, reps, distance, time].some(v => v && parseFloat(v) > 0);
    if (!hasData) continue;

    // Normalize date to YYYY-MM-DD
    const normalizedDate = date.includes('/') ? date.split('/').reverse().join('-') : date;

    // Find or create workout
    let workout = workoutMap.get(normalizedDate);
    if (!workout) {
      workout = {
        id: generateId(),
        date: normalizedDate,
        startTime: null,
        endTime: null,
        notes: '',
      };
      workoutMap.set(normalizedDate, workout);
      newWorkouts.push(workout);
      createdWorkoutDates.add(normalizedDate);
    }

    // Find or create exercise
    const exerciseId = findOrCreateExercise(exName, catName || 'Uncategorized', exercises, categories);

    // Find or create workout exercise
    const weKey = `${normalizedDate}|${exerciseId}`;
    let we = weMap.get(weKey);
    if (!we) {
      const existingWEsForWorkout = [...workoutExercises, ...newWEs].filter(x => x.workoutId === workout!.id);
      we = {
        id: generateId(),
        workoutId: workout.id,
        exerciseId,
        position: existingWEsForWorkout.length,
        notes: '',
      };
      weMap.set(weKey, we);
      newWEs.push(we);
    }

    // Parse weight, convert lbs to kg
    let weightKg: number | null = null;
    if (weight && parseFloat(weight) > 0) {
      weightKg = parseFloat(weight);
      if (weightUnit?.toLowerCase() === 'lbs' || weightUnit?.toLowerCase() === 'lb') {
        weightKg = Math.round(weightKg * 0.453592 * 100) / 100;
      }
    }

    // Parse other fields
    const repsVal = reps && parseInt(reps) > 0 ? parseInt(reps) : null;
    const distVal = distance && parseFloat(distance) > 0 ? parseFloat(distance) : null;
    let durVal: number | null = null;
    if (time && parseFloat(time) > 0) {
      const t = parseFloat(time);
      // If value seems like seconds (>= 60 and no decimal), convert to minutes
      durVal = t >= 60 && Number.isInteger(t) ? Math.round((t / 60) * 100) / 100 : t;
    }

    const existingSetsForWE = [...workoutSets, ...newSets].filter(s => s.workoutExerciseId === we!.id);

    const newSet: WorkoutSet = {
      id: generateId(),
      workoutExerciseId: we.id,
      setIndex: existingSetsForWE.length,
      setTag: 'N',
      weightKg,
      reps: repsVal,
      distanceKm: distVal,
      durationMinutes: durVal,
      rpe: null,
      isWarmup: false,
      isCompleted: true,
      notes: comment || '',
    };
    newSets.push(newSet);
  }

  // Persist all
  if (newWorkouts.length > 0) saveWorkouts([...workouts, ...newWorkouts]);
  if (newWEs.length > 0) saveWorkoutExercises([...workoutExercises, ...newWEs]);
  if (newSets.length > 0) saveWorkoutSets([...workoutSets, ...newSets]);
  saveExercises(exercises);
  saveCategories(categories);

  const totalWorkouts = createdWorkoutDates.size + (newWorkouts.length === 0 ? 0 : 0);
  // Count unique dates that got new data
  const affectedDates = new Set<string>();
  for (const s of newSets) {
    const we = [...workoutExercises, ...newWEs].find(w => w.id === s.workoutExerciseId);
    if (we) {
      const wk = [...workouts, ...newWorkouts].find(w => w.id === we.workoutId);
      if (wk) affectedDates.add(wk.date);
    }
  }

  return { workoutCount: affectedDates.size, setCount: newSets.length };
}
