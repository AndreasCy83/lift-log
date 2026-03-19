import { getWorkouts, getWorkoutExercises, getWorkoutSets, getExercises, getCategories } from '@/lib/storage';
import type { WorkoutSet } from '@/types/fitness';

const CSV_HEADER = 'Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time,Time Unit,Comment';

function hasMeaningfulData(s: WorkoutSet): boolean {
  return [s.weightKg, s.reps, s.distanceKm, s.durationMinutes].some(v => typeof v === 'number' && v > 0);
}

function isExportableSet(s: WorkoutSet): boolean {
  return !s.isWarmup && (s.isCompleted || hasMeaningfulData(s));
}

function escapeCsv(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export interface CsvExportResult {
  csv: string;
  setCount: number;
  filename: string;
}

export function generateFitNotesCsv(): CsvExportResult {
  const workouts = getWorkouts().sort((a, b) => b.date.localeCompare(a.date));
  const allWEs = getWorkoutExercises();
  const allSets = getWorkoutSets();
  const exercises = getExercises();
  const categories = getCategories();

  const exerciseMap = new Map(exercises.map(e => [e.id, e]));
  const categoryMap = new Map(categories.map(c => [c.id, c]));

  const rows: string[] = [CSV_HEADER];
  let setCount = 0;

  for (const workout of workouts) {
    const wes = allWEs
      .filter(we => we.workoutId === workout.id)
      .sort((a, b) => a.position - b.position);

    for (const we of wes) {
      const exercise = exerciseMap.get(we.exerciseId);
      if (!exercise) continue;

      const category = categoryMap.get(exercise.categoryId);
      const categoryName = category?.name ?? 'Strength';

      const sets = allSets
        .filter(s => s.workoutExerciseId === we.id && isExportableSet(s))
        .sort((a, b) => a.setIndex - b.setIndex);

      for (const s of sets) {
        const weight = typeof s.weightKg === 'number' && s.weightKg > 0 ? s.weightKg.toString() : '';
        const reps = typeof s.reps === 'number' && s.reps > 0 ? s.reps.toString() : '';
        const distance = typeof s.distanceKm === 'number' && s.distanceKm > 0 ? s.distanceKm.toString() : '';
        const distanceUnit = distance ? 'km' : '';
        const time = typeof s.durationMinutes === 'number' && s.durationMinutes > 0 ? s.durationMinutes.toString() : '';
        const timeUnit = time ? 'min' : '';

        // Combine notes
        const notes: string[] = [];
        if (s.notes) notes.push(s.notes);
        if (we.notes) notes.push(we.notes);
        const comment = escapeCsv(notes.join(' | '));

        rows.push(
          `${workout.date},${escapeCsv(exercise.name)},${escapeCsv(categoryName)},${weight},kgs,${reps},${distance},${distanceUnit},${time},${timeUnit},${comment}`
        );
        setCount++;
      }
    }
  }

  const filename = `FitNotes-Export-${new Date().toISOString().split('T')[0]}.csv`;
  return { csv: rows.join('\n'), setCount, filename };
}

export function getExportSetCount(): number {
  const allSets = getWorkoutSets();
  return allSets.filter(s => isExportableSet(s)).length;
}

export async function saveExportToFile(result: CsvExportResult): Promise<void> {
  const blob = new Blob(['\uFEFF' + result.csv], { type: 'text/csv;charset=utf-8;' });

  // Try native file picker (File System Access API)
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: result.filename,
        types: [{ description: 'CSV Files', accept: { 'text/csv': ['.csv'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e;
      // Fall through to download
    }
  }

  // Fallback: trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = result.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function shareExport(result: CsvExportResult): Promise<void> {
  const blob = new Blob(['\uFEFF' + result.csv], { type: 'text/csv;charset=utf-8;' });
  const file = new File([blob], result.filename, { type: 'text/csv' });

  // Try native share with file
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: `FitNotes Workout Data - ${new Date().toISOString().split('T')[0]}`,
        text: 'Complete workout history from Fitlog app',
        files: [file],
      });
      return;
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    // Fall through
  }

  // Try native share without file
  try {
    if (navigator.share) {
      await navigator.share({
        title: `FitNotes Workout Data - ${new Date().toISOString().split('T')[0]}`,
        text: 'Complete workout history from Fitlog app',
      });
      return;
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    // Fall through
  }

  // Fallback: download the file instead
  await saveExportToFile(result);
}
