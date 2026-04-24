export type BodyMeasurementUnit = 'cm' | 'in';

export type BodyMeasurementKey =
  | 'shoulders'
  | 'chest'
  | 'waist'
  | 'hips'
  | 'upper_arm_right'
  | 'upper_arm_left'
  | 'forearm_right'
  | 'forearm_left'
  | 'thigh_right'
  | 'thigh_left'
  | 'calf_right'
  | 'calf_left';

export interface BodyMeasurement {
  key: BodyMeasurementKey;
  /** Stored value in centimeters */
  valueCm: number;
}

export interface BodyEntry {
  id: string;
  date: string;        // YYYY-MM-DD
  time: string;        // HH:mm
  weightKg: number;
  bodyFatPercent: number | null;
  muscleMassPercent: number | null;
  note: string;
  /** Optional extra body measurements (always stored in cm). */
  measurements?: BodyMeasurement[];
  createdAt: string;
  updatedAt: string;
}

export interface BodyGoals {
  targetWeightKg: number | null;
  targetBodyFatPercent: number | null;
  targetMuscleMassPercent: number | null;
  startWeightKg: number | null;
  startBodyFatPercent: number | null;
  startMuscleMassPercent: number | null;
}
