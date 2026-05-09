import { Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { GOAL_TYPE_LABELS, type ExerciseGoal } from '@/types/fitness';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';
import { getSettings } from '@/lib/storage';

interface Props {
  open: boolean;
  goal: ExerciseGoal | null;
  exerciseName: string;
  currentValue: number;
  onSetNewGoal: () => void;
  onMaybeLater: () => void;
}

export default function GoalCelebrationModal({
  open, goal, exerciseName, currentValue, onSetNewGoal, onMaybeLater,
}: Props) {
  if (!goal) return null;
  const wu = getSettings().weightUnit;
  const isWeightMetric = ['MAX_WEIGHT', 'MAX_WEIGHT_FOR_REPS', 'ESTIMATED_1RM',
    'MAX_VOLUME', 'MAX_WORKOUT_VOLUME', 'TOTAL_VOLUME'].includes(goal.goalType);
  const fmt = (v: number) => {
    if (isWeightMetric) {
      const display = toDisplayWeight(v, wu) ?? v;
      return `${Math.round(display * 10) / 10} ${weightUnitLabel(wu)}`;
    }
    return `${Math.round(v).toLocaleString()}`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onMaybeLater(); }}>
      <DialogContent className="max-w-sm text-center animate-in fade-in-0 zoom-in-95 duration-300">
        <DialogHeader className="items-center">
          <div className="relative mx-auto mb-2">
            <div className="absolute inset-0 rounded-full bg-gym-pr/30 blur-2xl" aria-hidden />
            <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Trophy className="h-8 w-8 text-white" />
            </div>
          </div>
          <DialogTitle className="text-2xl">Goal Complete!</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground">
            You hit your goal for <span className="font-semibold text-foreground">{exerciseName}</span>.
            Ready to set your next target?
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-secondary/40 p-3 my-2">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {GOAL_TYPE_LABELS[goal.goalType]}
            {goal.goalType === 'MAX_WEIGHT_FOR_REPS' && goal.targetReps ? ` · ${goal.targetReps} reps` : ''}
          </p>
          <p className="text-xl font-bold text-foreground mt-1">
            {fmt(currentValue)}
            <span className="text-sm font-normal text-muted-foreground"> / {fmt(goal.targetValue)}</span>
          </p>
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <Button
            onClick={onSetNewGoal}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            Set New Goal
          </Button>
          <Button variant="ghost" onClick={onMaybeLater} className="w-full">
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
