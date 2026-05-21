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

export interface BodyMeasurementGoal {
  key: BodyMeasurementKey;
  /** Target value in cm */
  targetCm: number;
  /** Starting value in cm (snapshot of latest at goal-set time) */
  startCm: number | null;
  /** Optional target date (YYYY-MM-DD) */
  targetDate?: string | null;
}

export interface BodyGoals {
  targetWeightKg: number | null;
  targetBodyFatPercent: number | null;
  targetMuscleMassPercent: number | null;
  startWeightKg: number | null;
  startBodyFatPercent: number | null;
  startMuscleMassPercent: number | null;
  /** Optional target dates (YYYY-MM-DD) for primary metrics. */
  targetWeightDate?: string | null;
  targetBodyFatDate?: string | null;
  targetMuscleMassDate?: string | null;
  /** Optional per-measurement goals (always stored in cm). */
  measurementGoals?: BodyMeasurementGoal[];
}
