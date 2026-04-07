import { getProfile, getSettings } from '@/lib/storage';
import { getBodyEntries, getBodyGoals } from '@/lib/bodyTrackerStorage';
import { format } from 'date-fns';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { getGDriveSettings, backupToGoogleDrive } from '@/lib/googleDriveBackup';

const BACKUP_SETTINGS_KEY = 'gym-auto-backup-settings';
const BACKUP_TIMER_KEY = 'gym-auto-backup-pending';

export interface BackupSettings {
  enabled: boolean;
  lastBackupAt: string | null;
}

export function getBackupSettings(): BackupSettings {
  try {
    const raw = localStorage.getItem(BACKUP_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : { enabled: false, lastBackupAt: null };
  } catch {
    return { enabled: false, lastBackupAt: null };
  }
}

export function saveBackupSettings(s: BackupSettings) {
  localStorage.setItem(BACKUP_SETTINGS_KEY, JSON.stringify(s));
}

export function generateBackupData() {
  return {
    backupVersion: 3,
    exportedAt: new Date().toISOString(),
    weightStorageUnit: 'kg',
    profile: getProfile(),
    settings: getSettings(),
    workouts: JSON.parse(localStorage.getItem('gym-workouts') ?? '[]'),
    workoutExercises: JSON.parse(localStorage.getItem('gym-workout-exercises') ?? '[]'),
    workoutSets: JSON.parse(localStorage.getItem('gym-workout-sets') ?? '[]'),
    routines: JSON.parse(localStorage.getItem('gym-routines') ?? '[]'),
    routineExercises: JSON.parse(localStorage.getItem('gym-routine-exercises') ?? '[]'),
    exercises: JSON.parse(localStorage.getItem('gym-exercises') ?? '[]'),
    bodyEntries: getBodyEntries(),
    bodyGoals: getBodyGoals(),
  };
}

export async function saveBackupToDevice(): Promise<{ filename: string }> {
  const data = generateBackupData();
  const now = new Date();
  const filename = `Fitlog-Backup-${format(now, 'yyyy-MM-dd-HHmm')}.json`;
  const jsonString = JSON.stringify(data, null, 2);

  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({
      path: filename,
      data: jsonString,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
  } else {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const settings = getBackupSettings();
  settings.lastBackupAt = now.toISOString();
  saveBackupSettings(settings);

  return { filename };
}

export async function downloadBackup(): Promise<{ filename: string }> {
  const data = generateBackupData();
  const now = new Date();
  const filename = `Fitlog-Backup-${format(now, 'yyyy-MM-dd-HHmm')}.json`;
  const jsonString = JSON.stringify(data, null, 2);

  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({
      path: filename,
      data: jsonString,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });

    const uriResult = await Filesystem.getUri({
      path: filename,
      directory: Directory.Documents,
    });

    await Share.share({
      title: 'Fit Log X Backup',
      text: 'Save your Fit Log X backup file',
      url: uriResult.uri,
      dialogTitle: 'Save Backup',
    });
  } else {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const settings = getBackupSettings();
  settings.lastBackupAt = now.toISOString();
  saveBackupSettings(settings);

  return { filename };
}

let pendingTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePendingBackup() {
  const bs = getBackupSettings();
  if (!bs.enabled) return;

  const triggerAt = Date.now() + 60 * 60 * 1000;
  localStorage.setItem(BACKUP_TIMER_KEY, String(triggerAt));

  if (pendingTimer) clearTimeout(pendingTimer);

  pendingTimer = setTimeout(() => {
    runPendingBackup();
  }, 60 * 60 * 1000);
}

export async function performSilentBackup(): Promise<boolean> {
  const bs = getBackupSettings();
  if (!bs.enabled) return false;

  try {
    const data = generateBackupData();
    const now = new Date();
    const filename = `Fitlog-Auto-Backup-${format(now, 'yyyy-MM-dd-HHmm')}.json`;
    const jsonString = JSON.stringify(data, null, 2);

    if (Capacitor.isNativePlatform()) {
      await Filesystem.writeFile({
        path: filename,
        data: jsonString,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
    } else {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    bs.lastBackupAt = now.toISOString();
    saveBackupSettings(bs);
    return true;
  } catch (err) {
    console.error('[AutoBackup] Silent backup failed:', err);
    return false;
  }
}

export async function runPendingBackup(): Promise<boolean> {
  const bs = getBackupSettings();
  if (!bs.enabled) return false;

  localStorage.removeItem(BACKUP_TIMER_KEY);
  await performSilentBackup();

  const gDriveSettings = getGDriveSettings();
  if (gDriveSettings.enabled) {
    try {
      await backupToGoogleDrive();
    } catch {
      // Silent fail
    }
  }

  return true;
}

export function checkPendingBackup(): boolean {
  const bs = getBackupSettings();
  if (!bs.enabled) return false;

  const pending = localStorage.getItem(BACKUP_TIMER_KEY);
  if (!pending) return false;

  const triggerAt = parseInt(pending, 10);
  if (Date.now() >= triggerAt) {
    runPendingBackup();
    return true;
  }

  const remaining = triggerAt - Date.now();
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    runPendingBackup();
  }, remaining);

  return false;
}

export function cancelPendingBackup() {
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  localStorage.removeItem(BACKUP_TIMER_KEY);
}
