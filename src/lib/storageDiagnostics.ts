/**
 * Development-only storage diagnostics.
 *
 * Answers, at startup: which storage layers hold FitLogX data, and does data
 * already exist on what should be a first launch (the Android Auto Backup
 * restore symptom)? It logs COUNTS and BOOLEANS only - never a name, height,
 * weight, or any workout value.
 *
 * Disabled entirely in production builds (import.meta.env.DEV gate), and can be
 * force-enabled on a debug device with:
 *   localStorage.setItem('fitlog-debug-storage', '1')
 */

const FORCE_KEY = 'fitlog-debug-storage';

function enabled(): boolean {
  try {
    if (import.meta.env.DEV) return true;
    return localStorage.getItem(FORCE_KEY) === '1';
  } catch {
    return false;
  }
}

function count(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 1;
  } catch {
    return -1; // unparseable
  }
}

/** Logs a privacy-safe snapshot of every local persistence layer. */
export function logStorageDiagnostics(installIdKey: string): void {
  if (!enabled()) return;

  const hasProfile = (() => {
    try { return localStorage.getItem('gym-profile') != null; } catch { return false; }
  })();

  const snapshot = {
    // Which providers are even available / in use
    provider: {
      localStorage: typeof localStorage !== 'undefined',
      indexedDB: typeof indexedDB !== 'undefined',
      capacitorPreferences: false, // not used by FitLogX
      sqlite: false,               // not used by FitLogX
    },
    // Is this a first launch from the app's point of view?
    firstLaunch: {
      installIdPresent: (() => {
        try { return localStorage.getItem(installIdKey) != null; } catch { return false; }
      })(),
      completedFirstLaunch: (() => {
        try { return localStorage.getItem('hasCompletedFirstLaunch') === 'true'; } catch { return false; }
      })(),
    },
    // Counts only - no values
    data: {
      profilePresent: hasProfile,
      workouts: count('gym-workouts'),
      workoutExercises: count('gym-workout-exercises'),
      workoutSets: count('gym-workout-sets'),
      routines: count('gym-routines'),
      programs: count('gym-programs'),
      exercises: count('gym-exercises'),
      bodyEntries: count('body-tracker-entries'),
      bodyGoals: count('body-tracker-goals'),
    },
    migrations: {
      categoryMigration_v2: (() => {
        try { return localStorage.getItem('categoryMigration_v2') != null; } catch { return false; }
      })(),
    },
    // Restore/import is user-initiated only; nothing runs it at startup.
    autoRestoreAtStartup: false,
  };

  const suspiciousFreshInstall =
    !snapshot.firstLaunch.installIdPresent &&
    (snapshot.data.profilePresent || snapshot.data.workouts > 0 || snapshot.data.bodyEntries > 0);

  // eslint-disable-next-line no-console
  console.log('[FitLogX][storage-diagnostics]', snapshot);

  if (suspiciousFreshInstall) {
    // Informational only - this is the EXPECTED signature of Android Auto Backup
    // / device-transfer restoring the user's own data. Nothing is wiped here.
    // eslint-disable-next-line no-console
    console.info(
      '[FitLogX][storage-diagnostics] Data present with no install id. ' +
      'This most likely means Android backup / device transfer restored the ' +
      'user\'s previous local data. Data is kept as-is (never auto-cleared).'
    );
  }

}
