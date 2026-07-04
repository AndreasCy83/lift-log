import { describe, it, expect } from 'vitest';
import { recommendProgression } from './progressionEngine';
import type { Exercise } from '@/types/fitness';

const baseExercise: Exercise = {
  id: 'ex-test',
  name: 'Machine Chest Press',
  categoryId: 'cat-chest',
  type: 'RESISTANCE',
  setType: 'WEIGHT_REPS',
  weightUnit: 'kg',
  defaultRepsMin: 8,
  defaultRepsMax: 12,
  defaultSets: 3,
  defaultRestSeconds: 90,
  notes: '',
  isFavorite: false,
  isCustom: false,
};

describe('sparse-history regression gating', () => {
  it('does not call a 2-session rep drop a regression', () => {
    const rec = recommendProgression(baseExercise, [
      {
        dateISO: '2026-07-03',
        workingSets: 3,
        avgReps: 8,
        topWeightKg: 20,
        avgRPE: 7,
      },
      {
        dateISO: '2026-06-26',
        workingSets: 3,
        avgReps: 10,
        topWeightKg: 20,
        avgRPE: 7,
      },
    ]);

    expect(rec).not.toBeNull();
    expect(rec!.recommendationType).not.toBe('deload_adjustment');
    expect(rec!.mainAction).not.toBe('Rebuild reps');
    expect(rec!.recommendationType).toBe('hold');
  });

  it('allows a clear, persistent rep drop across 3+ sessions to trigger rebuild', () => {
    const rec = recommendProgression(baseExercise, [
      {
        dateISO: '2026-07-03',
        workingSets: 3,
        avgReps: 8,
        topWeightKg: 20,
        avgRPE: 7,
      },
      {
        dateISO: '2026-06-26',
        workingSets: 3,
        avgReps: 9,
        topWeightKg: 20,
        avgRPE: 7,
      },
      {
        dateISO: '2026-06-19',
        workingSets: 3,
        avgReps: 10,
        topWeightKg: 20,
        avgRPE: 7,
      },
    ]);

    expect(rec).not.toBeNull();
    expect(rec!.recommendationType).toBe('deload_adjustment');
    expect(rec!.mainAction).toBe('Rebuild reps');
  });
});
