import { getExerciseHistory, getExerciseGoals, getExercises } from '@/lib/storage';
import type { ExerciseGoal, GoalType } from '@/types/fitness';
import { isAfter, isBefore } from 'date-fns';

export function computeCurrentGoalValue(exerciseId: string, goal: ExerciseGoal): number {
  const history = getExerciseHistory(exerciseId);
  const filtered = history.filter(h => {
    const d = new Date(h.date);
    if (goal.startDate && isBefore(d, new Date(goal.startDate))) return false;
    if (goal.endDate && isAfter(d, new Date(goal.endDate))) return false;
    return true;
  });

  switch (goal.goalType) {
    case 'MAX_WEIGHT': {
      let max = 0;
      filtered.forEach(s => s.sets.forEach(set => { if (set.weightKg && set.weightKg > max) max = set.weightKg; }));
      return max;
    }
    case 'MAX_REPS': {
      let max = 0;
      filtered.forEach(s => s.sets.forEach(set => { if (set.reps && set.reps > max) max = set.reps; }));
      return max;
    }
    case 'MAX_VOLUME': {
      let max = 0;
      filtered.forEach(s => s.sets.forEach(set => {
        const vol = (set.weightKg ?? 0) * (set.reps ?? 0);
        if (vol > max) max = vol;
      }));
      return max;
    }
    case 'MAX_WEIGHT_FOR_REPS': {
      let max = 0;
      const targetReps = goal.targetReps ?? 1;
      filtered.forEach(s => s.sets.forEach(set => {
        if (set.reps && set.reps >= targetReps && set.weightKg && set.weightKg > max) max = set.weightKg;
      }));
      return max;
    }
    case 'MAX_WORKOUT_VOLUME': {
      let max = 0;
      filtered.forEach(s => {
        const vol = s.sets.reduce((sum, set) => sum + (set.weightKg ?? 0) * (set.reps ?? 0), 0);
        if (vol > max) max = vol;
      });
      return max;
    }
    case 'MAX_WORKOUT_REPS': {
      let max = 0;
      filtered.forEach(s => {
        const reps = s.sets.reduce((sum, set) => sum + (set.reps ?? 0), 0);
        if (reps > max) max = reps;
      });
      return max;
    }
    case 'TOTAL_VOLUME':
      return filtered.reduce((total, s) =>
        total + s.sets.reduce((sum, set) => sum + (set.weightKg ?? 0) * (set.reps ?? 0), 0), 0);
    case 'TOTAL_REPS':
      return filtered.reduce((total, s) =>
        total + s.sets.reduce((sum, set) => sum + (set.reps ?? 0), 0), 0);
    case 'ESTIMATED_1RM': {
      let best = 0;
      filtered.forEach(s => s.sets.forEach(set => {
        if (set.weightKg && set.reps) {
          const e1rm = set.weightKg * (1 + set.reps / 30);
          if (e1rm > best) best = e1rm;
        }
      }));
      return Math.round(best * 10) / 10;
    }
    default:
      return 0;
  }
}

export interface CompletedGoal {
  goal: ExerciseGoal;
  exerciseId: string;
  exerciseName: string;
  currentValue: number;
}

/** Scan all goals; return any newly-completed (current >= target) that have not been acknowledged. */
export function detectNewlyCompletedGoals(): CompletedGoal[] {
  const goals = getExerciseGoals();
  const exercises = getExercises();
  const exMap = new Map(exercises.map(e => [e.id, e.name]));
  const out: CompletedGoal[] = [];
  for (const goal of goals) {
    if ((goal as any).completedAcknowledgedAt) continue;
    if (goal.targetValue <= 0) continue;
    const current = computeCurrentGoalValue(goal.exerciseId, goal);
    if (current >= goal.targetValue) {
      out.push({
        goal,
        exerciseId: goal.exerciseId,
        exerciseName: exMap.get(goal.exerciseId) ?? 'Exercise',
        currentValue: current,
      });
    }
  }
  return out;
}
