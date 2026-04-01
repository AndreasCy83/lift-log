export type WeightUnitSetting = 'kg' | 'lbs';

export const KG_TO_LBS = 2.20462;
export const LBS_TO_KG = 1 / KG_TO_LBS;

export function toDisplayWeight(kg: number | null, unit: WeightUnitSetting): number | null {
  if (kg === null) return null;
  return unit === 'lbs' ? Math.round(kg * KG_TO_LBS * 100) / 100 : kg;
}

export function toStorageKg(value: number | null, unit: WeightUnitSetting): number | null {
  if (value === null) return null;
  return unit === 'lbs' ? Math.round(value * LBS_TO_KG * 100) / 100 : value;
}

export function weightUnitLabel(unit: WeightUnitSetting): string {
  return unit === 'lbs' ? 'lbs' : 'kg';
}
