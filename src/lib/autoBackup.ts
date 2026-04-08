import { getProfile, getSettings } from '@/lib/storage';
import { getBodyEntries, getBodyGoals } from '@/lib/bodyTrackerStorage';
import { format } from 'date-fns';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { getGDriveSettings, backupToGoogleDrive } from '@/lib/googleDriveBackup';

const BACKUP_SETTINGS_KEY = 'gym-auto-backup-settings';
const BACKUP_TIMER_KEY = 'gym-auto-backup-pending';
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export interface BackupSettings {
  enabled: boolean;
  lastBackupAt: string | null;
  lastBackupFingerprint: string | null;
}

export function getBackupSettings(): BackupSettings {
  try {
    const raw = localStorage.getItem(BACKUP_SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      enabled: parsed.enabled ?? false,
      lastBackupAt: parsed.lastBackupAt ?? null,
      lastBackupFingerprint: parsed.lastBackupFingerprint ?? null,
    };
  } catch {
    return { enabled: false, lastBackupAt: null, lastBackupFingerprint: null };
  }
}

export function saveBackupSettings(s: BackupSettings) {
  localStorage.setItem(BACKUP_SETTINGS_KEY, JSON.stringify(s));
}

/** Build a lightweight fingerprint of all user data to detect changes. */
export function buildDataFingerprint(): string {
  const parts: string[] = [];
  const keys = [
    'gym-workouts',
    'gym-workout-exercises',
    'gym-workout-sets',
    'gym-routines',
    'gym-routine-exercises',
    'gym-exercises',
    'body-tracker-entries',
    'body-tracker-goals',
  ];
  for (const k of keys) {
    parts.push(localStorage.getItem(k) ?? '');
  }
  // Include profile
  const profile = localStorage.getItem('gym-profile') ?? '';
  parts.push(profile);

  // Simple hash: length + char-sum of concatenated data
  const combined = parts.join('|');
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
  }
  return `${combined.length}:${hash}`;
}

/** Check if auto-backup should run: returns true if backup is needed. */
export function shouldAutoBackup(): boolean {
  const bs = getBackupSettings();
  if (!bs.enabled) return false;

  // Never backed up → backup immediately
  if (!bs.lastBackupAt) return true;

  // Check 2-hour cooldown
  const elapsed = Date.now() - new Date(bs.lastBackupAt).getTime();
  if (elapsed < TWO_HOURS_MS) return false;

  // Check data changed
  const currentFingerprint = buildDataFingerprint();
  if (bs.lastBackupFingerprint && currentFingerprint === bs.lastBackupFingerprint) return false;

  return true;
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

function updateBackupMeta() {
  const settings = getBackupSettings();
  settings.lastBackupAt = new Date().toISOString();
  settings.lastBackupFingerprint = buildDataFingerprint();
  saveBackupSettings(settings);
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

  updateBackupMeta();
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

  updateBackupMeta();
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

    updateBackupMeta();
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
