import type { BodyEntry, BodyMeasurementKey, BodyMeasurementUnit } from '@/types/bodyTracker';

export const MEASUREMENT_OPTIONS: { key: BodyMeasurementKey; label: string }[] = [
  { key: 'shoulders', label: 'Shoulders' },
  { key: 'chest', label: 'Chest' },
  { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' },
  { key: 'upper_arm_right', label: 'Upper Arm (R)' },
  { key: 'upper_arm_left', label: 'Upper Arm (L)' },
  { key: 'forearm_right', label: 'Forearm (R)' },
  { key: 'forearm_left', label: 'Forearm (L)' },
  { key: 'thigh_right', label: 'Thigh (R)' },
  { key: 'thigh_left', label: 'Thigh (L)' },
  { key: 'calf_right', label: 'Calf (R)' },
  { key: 'calf_left', label: 'Calf (L)' },
];

export const measurementLabel = (k: BodyMeasurementKey) =>
  MEASUREMENT_OPTIONS.find(o => o.key === k)?.label ?? k;

export const CM_TO_IN = 0.393701;

export const cmToDisplay = (cm: number, unit: BodyMeasurementUnit) =>
  unit === 'in' ? Math.round(cm * CM_TO_IN * 10) / 10 : Math.round(cm * 10) / 10;

export const displayToCm = (v: number, unit: BodyMeasurementUnit) =>
  unit === 'in' ? Math.round((v / CM_TO_IN) * 10) / 10 : Math.round(v * 10) / 10;

/** Returns the set of measurement keys ever used across body entries. */
export function getHistoricMeasurementKeys(entries: BodyEntry[]): Set<BodyMeasurementKey> {
  const used = new Set<BodyMeasurementKey>();
  for (const e of entries) {
    if (!e.measurements) continue;
    for (const m of e.measurements) {
      if (m.valueCm > 0) used.add(m.key);
    }
  }
  return used;
}
