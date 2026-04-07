import { getWorkouts, getWorkoutExercises, getWorkoutSets, getExercises, getCategories, getSettings } from '@/lib/storage';
import { toDisplayWeight } from '@/lib/units';
import { getBodyEntries } from '@/lib/bodyTrackerStorage';
import type { WorkoutSet } from '@/types/fitness';
import { KG_TO_LBS } from '@/lib/units';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

const CSV_HEADER = 'Entry Type,Date,Time,Exercise,Category,Weight (kg),Weight (lbs),Weight Unit,Reps,Distance,Distance Unit,Time Value,Time Unit,Body Fat (%),Muscle Mass (%),Comment / Note';

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

function fmtDec(v: number | null | undefined, decimals = 1): string {
  if (v === null || v === undefined || v <= 0) return '';
  return v.toFixed(decimals);
}

function kgToLbs(kg: number | null): string {
  if (kg === null || kg <= 0) return '';
  return (kg * KG_TO_LBS).toFixed(1);
}

export interface CsvExportResult {
  csv: string;
  setCount: number;
  filename: string;
}

export function generateFitNotesCsv(fromDate?: string, toDate?: string): CsvExportResult {
  const globalWeightUnit = getSettings().weightUnit;
  let workouts = getWorkouts().sort((a, b) => b.date.localeCompare(a.date));
  if (fromDate) workouts = workouts.filter(w => w.date >= fromDate);
  if (toDate) workouts = workouts.filter(w => w.date <= toDate);
  const allWEs = getWorkoutExercises();
  const allSets = getWorkoutSets();
  const exercises = getExercises();
  const categories = getCategories();

  const exerciseMap = new Map(exercises.map(e => [e.id, e]));
  const categoryMap = new Map(categories.map(c => [c.id, c]));

  const rows: string[] = [CSV_HEADER];
  let setCount = 0;

  // Workout rows
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
        const wKg = s.weightKg !== null && s.weightKg > 0 ? s.weightKg : null;
        const weightKgStr = wKg !== null ? wKg.toFixed(1) : '';
        const weightLbsStr = kgToLbs(wKg);
        const wuLabel = globalWeightUnit === 'lbs' ? 'lbs' : 'kg';
        const reps = typeof s.reps === 'number' && s.reps > 0 ? s.reps.toString() : '';
        const distance = typeof s.distanceKm === 'number' && s.distanceKm > 0 ? s.distanceKm.toString() : '';
        const distanceUnit = distance ? 'km' : '';
        const time = typeof s.durationMinutes === 'number' && s.durationMinutes > 0 ? s.durationMinutes.toString() : '';
        const timeUnit = time ? 'min' : '';

        const notes: string[] = [];
        if (s.notes) notes.push(s.notes);
        if (we.notes) notes.push(we.notes);
        const comment = escapeCsv(notes.join(' | '));

        // Entry Type,Date,Time,Exercise,Category,Weight (kg),Weight (lbs),Weight Unit,Reps,Distance,Distance Unit,Time Value,Time Unit,Body Fat (%),Muscle Mass (%),Comment / Note
        rows.push(
          `workout_set,${workout.date},,${escapeCsv(exercise.name)},${escapeCsv(categoryName)},${weightKgStr},${weightLbsStr},${wuLabel},${reps},${distance},${distanceUnit},${time},${timeUnit},,,${comment}`
        );
        setCount++;
      }
    }
  }

  // Body measurement rows
  let bodyEntries = getBodyEntries();
  if (fromDate) bodyEntries = bodyEntries.filter(e => e.date >= fromDate);
  if (toDate) bodyEntries = bodyEntries.filter(e => e.date <= toDate);

  for (const entry of bodyEntries) {
    const wKg = entry.weightKg > 0 ? entry.weightKg : null;
    rows.push(
      `body_measurement,${entry.date},${entry.time || ''},,,${fmtDec(wKg)},${kgToLbs(wKg)},,,,,,,,${fmtDec(entry.bodyFatPercent)},${fmtDec(entry.muscleMassPercent)},${escapeCsv(entry.note || '')}`
    );
    setCount++;
  }

  const filename = `FitLogX-Export-${new Date().toISOString().split('T')[0]}.csv`;
  return { csv: rows.join('\n'), setCount, filename };
}

export function getExportSetCount(fromDate?: string, toDate?: string): number {
  let workouts = getWorkouts();
  if (fromDate) workouts = workouts.filter(w => w.date >= fromDate);
  if (toDate) workouts = workouts.filter(w => w.date <= toDate);
  const workoutIds = new Set(workouts.map(w => w.id));
  const allWEs = getWorkoutExercises().filter(we => workoutIds.has(we.workoutId));
  const weIds = new Set(allWEs.map(we => we.id));
  const workoutSetCount = getWorkoutSets().filter(s => weIds.has(s.workoutExerciseId) && isExportableSet(s)).length;

  let bodyEntries = getBodyEntries();
  if (fromDate) bodyEntries = bodyEntries.filter(e => e.date >= fromDate);
  if (toDate) bodyEntries = bodyEntries.filter(e => e.date <= toDate);

  return workoutSetCount + bodyEntries.length;
}

export async function saveExportToFile(result: CsvExportResult): Promise<void> {
  const csvWithBom = '\uFEFF' + result.csv;

  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({
      path: result.filename,
      data: csvWithBom,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    return;
  }

  const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' });
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
    }
  }

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
  const csvWithBom = '\uFEFF' + result.csv;

  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({
      path: result.filename,
      data: csvWithBom,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });

    const uriResult = await Filesystem.getUri({
      path: result.filename,
      directory: Directory.Documents,
    });

    await Share.share({
      title: 'Fit Log X Export',
      text: 'Your Fit Log X workout & body tracker data export',
      url: uriResult.uri,
      dialogTitle: 'Share your export',
    });
    return;
  }

  const blob = new Blob([csvWithBom], { type: 'text/csv;charset=utf-8;' });
  const file = new File([blob], result.filename, { type: 'text/csv' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: `Fit Log X Export - ${new Date().toISOString().split('T')[0]}`,
        text: 'Complete workout & body tracker history from Fit Log X',
        files: [file],
      });
      return;
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
  }

  await saveExportToFile(result);
}
