export type WeightUnitSetting = 'kg' | 'lbs';

export const KG_TO_LBS = 2.20462;
export const LBS_TO_KG = 1 / KG_TO_LBS;

/**
 * Convert internal kg to display unit. Rounds to 2 decimals for clean UI.
 * Storage is always kg; display rounding never affects stored data.
 */
export function toDisplayWeight(kg: number | null, unit: WeightUnitSetting): number | null {
  if (kg === null || kg === undefined || isNaN(kg as number)) return null;
  if (unit === 'lbs') return Math.round(kg * KG_TO_LBS * 100) / 100;
  // For kg, also round to 2 decimals to avoid float artifacts after lbs->kg->kg roundtrips
  return Math.round(kg * 100) / 100;
}

/**
 * Convert a value entered in the user's selected unit back to kg for storage.
 * Keeps high precision (no early rounding) so values like 22.5 lb round-trip
 * accurately back to 22.5 lb in the UI.
 */
export function toStorageKg(value: number | null, unit: WeightUnitSetting): number | null {
  if (value === null || value === undefined || isNaN(value as number)) return null;
  if (unit === 'lbs') {
    // Preserve precision so display conversion back matches the typed value.
    return Math.round(value * LBS_TO_KG * 1e6) / 1e6;
  }
  return value;
}

export function weightUnitLabel(unit: WeightUnitSetting): string {
  return unit === 'lbs' ? 'lbs' : 'kg';
}
