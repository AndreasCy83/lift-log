import { useState, useMemo, useEffect } from 'react';
import { Trophy, Plus, Trash2 } from 'lucide-react';
import { format, isAfter, isBefore, subDays } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  getGoalsForExercise, addExerciseGoal, deleteExerciseGoal,
  getExerciseHistory, generateId, getSettings
} from '@/lib/storage';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';
import type { GoalType, ExerciseGoal } from '@/types/fitness';
import { GOAL_TYPE_LABELS } from '@/types/fitness';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseId: string;
  exerciseName: string;
  weightUnit: 'kg' | 'lb';
  initialAdding?: boolean;
  initialGoalType?: GoalType;
}

function computeCurrentValue(exerciseId: string, goal: ExerciseGoal): number {
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
    case 'TOTAL_VOLUME': {
      return filtered.reduce((total, s) =>
        total + s.sets.reduce((sum, set) => sum + (set.weightKg ?? 0) * (set.reps ?? 0), 0), 0);
    }
    case 'TOTAL_REPS': {
      return filtered.reduce((total, s) =>
        total + s.sets.reduce((sum, set) => sum + (set.reps ?? 0), 0), 0);
    }
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
    default: return 0;
  }
}

export default function ExerciseGoalsDialog({ open, onOpenChange, exerciseId, exerciseName, weightUnit, initialAdding, initialGoalType }: Props) {
  const [goals, setGoals] = useState<ExerciseGoal[]>(() => getGoalsForExercise(exerciseId));
  const [adding, setAdding] = useState(!!initialAdding);
  const [newType, setNewType] = useState<GoalType>(initialGoalType ?? 'MAX_WEIGHT');
  const [newTarget, setNewTarget] = useState('');
  const [newTargetReps, setNewTargetReps] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');

  useEffect(() => {
    if (open) {
      setGoals(getGoalsForExercise(exerciseId));
      if (initialAdding) setAdding(true);
      if (initialGoalType) setNewType(initialGoalType);
    }
  }, [open, exerciseId, initialAdding, initialGoalType]);

  const globalWeightUnit = getSettings().weightUnit;
  const unitLabel = weightUnitLabel(globalWeightUnit);
  const dw = (v: number) => toDisplayWeight(v, globalWeightUnit) ?? v;

  const refreshGoals = () => setGoals(getGoalsForExercise(exerciseId));

  const handleAdd = () => {
    const val = parseFloat(newTarget);
    if (!val || val <= 0) return;
    const goal: ExerciseGoal = {
      id: generateId(),
      exerciseId,
      goalType: newType,
      targetValue: val,
      targetReps: newType === 'MAX_WEIGHT_FOR_REPS' ? parseInt(newTargetReps) || 1 : undefined,
      startDate: newStartDate || undefined,
      endDate: newEndDate || undefined,
      createdAt: new Date().toISOString(),
    };
    addExerciseGoal(goal);
    refreshGoals();
    setAdding(false);
    setNewTarget('');
    setNewTargetReps('');
    setNewStartDate('');
    setNewEndDate('');
  };

  const handleDelete = (id: string) => {
    deleteExerciseGoal(id);
    refreshGoals();
  };

  const getValueLabel = (goalType: GoalType): string => {
    if (['MAX_WEIGHT', 'MAX_WEIGHT_FOR_REPS', 'ESTIMATED_1RM'].includes(goalType)) return unitLabel;
    if (['MAX_VOLUME', 'MAX_WORKOUT_VOLUME', 'TOTAL_VOLUME'].includes(goalType)) return unitLabel;
    return '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-gym-pr" />
            Goals — {exerciseName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {goals.length === 0 && !adding && (
            <p className="text-sm text-muted-foreground text-center py-4">No goals set yet. Add one to track your progress!</p>
          )}

          {goals.map(goal => {
            const current = computeCurrentValue(exerciseId, goal);
            const pct = Math.min(100, goal.targetValue > 0 ? (current / goal.targetValue) * 100 : 0);
            const suffix = getValueLabel(goal.goalType);

            return (
              <div key={goal.id} className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold">{GOAL_TYPE_LABELS[goal.goalType]}</p>
                    {goal.goalType === 'MAX_WEIGHT_FOR_REPS' && goal.targetReps && (
                      <p className="text-[10px] text-muted-foreground">for {goal.targetReps} reps</p>
                    )}
                  </div>
                  <button onClick={() => handleDelete(goal.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {dw(current).toLocaleString()}{suffix && ` ${suffix}`}
                    </span>
                    <span className="font-semibold">
                      {dw(goal.targetValue).toLocaleString()}{suffix && ` ${suffix}`}
                    </span>
                  </div>
                  <Progress value={pct} className="h-2.5" />
                  <p className="text-[10px] text-muted-foreground text-right">{pct.toFixed(0)}%</p>
                </div>

                {(goal.startDate || goal.endDate) && (
                  <p className="text-[10px] text-muted-foreground">
                    {goal.startDate && `From ${format(new Date(goal.startDate), 'MMM d, yyyy')}`}
                    {goal.startDate && goal.endDate && ' — '}
                    {goal.endDate && `To ${format(new Date(goal.endDate), 'MMM d, yyyy')}`}
                  </p>
                )}
              </div>
            );
          })}

          {adding ? (
            <div className="rounded-lg border border-primary/30 bg-secondary/30 p-3 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Goal Type</Label>
                <Select value={newType} onValueChange={(v) => setNewType(v as GoalType)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(GOAL_TYPE_LABELS) as GoalType[]).map(key => (
                      <SelectItem key={key} value={key} className="text-xs">{GOAL_TYPE_LABELS[key]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Target Value {getValueLabel(newType) && `(${getValueLabel(newType)})`}</Label>
                <Input
                  type="number"
                  value={newTarget}
                  onChange={e => setNewTarget(e.target.value)}
                  placeholder="e.g. 100"
                  className="h-8 text-xs"
                />
              </div>

              {newType === 'MAX_WEIGHT_FOR_REPS' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Target Reps</Label>
                  <Input
                    type="number"
                    value={newTargetReps}
                    onChange={e => setNewTargetReps(e.target.value)}
                    placeholder="e.g. 5"
                    className="h-8 text-xs"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Start Date (optional)</Label>
                  <Input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">End Date (optional)</Label>
                  <Input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} className="flex-1 h-8 text-xs">Save Goal</Button>
                <Button size="sm" variant="outline" onClick={() => setAdding(false)} className="h-8 text-xs">Cancel</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="w-full text-xs gap-1">
              <Plus className="h-3.5 w-3.5" /> Add Goal
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}