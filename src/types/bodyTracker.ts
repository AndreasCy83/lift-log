export interface BodyEntry {
  id: string;
  date: string;        // YYYY-MM-DD
  time: string;        // HH:mm
  weightKg: number;
  bodyFatPercent: number | null;
  muscleMassPercent: number | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface BodyGoals {
  targetWeightKg: number | null;
  targetBodyFatPercent: number | null;
  targetMuscleMassPercent: number | null;
}
