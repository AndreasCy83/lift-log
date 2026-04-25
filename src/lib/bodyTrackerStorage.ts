import { BodyEntry, BodyGoals } from '@/types/bodyTracker';
import { generateId } from '@/lib/storage';

const KEYS = {
  entries: 'body-tracker-entries',
  goals: 'body-tracker-goals',
};

function get<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function set<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Entries
export function getBodyEntries(): BodyEntry[] {
  return get<BodyEntry[]>(KEYS.entries, []).sort((a, b) => {
    const cmp = b.date.localeCompare(a.date);
    return cmp !== 0 ? cmp : b.time.localeCompare(a.time);
  });
}

export function addBodyEntry(entry: Omit<BodyEntry, 'id' | 'createdAt' | 'updatedAt'>): BodyEntry {
  const now = new Date().toISOString();
  const full: BodyEntry = { ...entry, id: generateId(), createdAt: now, updatedAt: now };
  const all = get<BodyEntry[]>(KEYS.entries, []);
  all.push(full);
  set(KEYS.entries, all);
  return full;
}

export function updateBodyEntry(entry: BodyEntry) {
  const all = get<BodyEntry[]>(KEYS.entries, []);
  const idx = all.findIndex(e => e.id === entry.id);
  if (idx >= 0) {
    all[idx] = { ...entry, updatedAt: new Date().toISOString() };
    set(KEYS.entries, all);
  }
}

export function deleteBodyEntry(id: string) {
  set(KEYS.entries, get<BodyEntry[]>(KEYS.entries, []).filter(e => e.id !== id));
}

// Goals
export function getBodyGoals(): BodyGoals {
  const g = get<BodyGoals>(KEYS.goals, { targetWeightKg: null, targetBodyFatPercent: null, targetMuscleMassPercent: null, startWeightKg: null, startBodyFatPercent: null, startMuscleMassPercent: null });
  if (!g.measurementGoals) g.measurementGoals = [];
  return g;
}

export function saveBodyGoals(goals: BodyGoals) {
  set(KEYS.goals, goals);
}
