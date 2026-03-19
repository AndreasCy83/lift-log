import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ExerciseDetailPanel from '@/components/ExerciseDetailPanel';
import ExerciseStatsDialog from '@/components/ExerciseStatsDialog';
import ExerciseGoalsDialog from '@/components/ExerciseGoalsDialog';
import type { Exercise } from '@/types/fitness';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise: Exercise | null;
}

export default function ExerciseDetailDialog({ open, onOpenChange, exercise }: Props) {
  const [tab, setTab] = useState('history');

  if (!exercise) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="font-display text-base">{exercise.name}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 grid w-auto grid-cols-3 bg-secondary">
            <TabsTrigger value="history" className="text-xs">History</TabsTrigger>
            <TabsTrigger value="stats" className="text-xs">Stats</TabsTrigger>
            <TabsTrigger value="goals" className="text-xs">Goals</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="flex-1 overflow-y-auto px-4 pb-4 mt-2">
            <ExerciseDetailPanel
              exerciseId={exercise.id}
              exerciseName={exercise.name}
              weightUnit={exercise.weightUnit}
              onPrefill={() => {}}
            />
          </TabsContent>

          <TabsContent value="stats" className="flex-1 overflow-y-auto px-4 pb-4 mt-2">
            <InlineStats exerciseId={exercise.id} exerciseName={exercise.name} weightUnit={exercise.weightUnit} />
          </TabsContent>

          <TabsContent value="goals" className="flex-1 overflow-y-auto px-4 pb-4 mt-2">
            <InlineGoals exerciseId={exercise.id} exerciseName={exercise.name} weightUnit={exercise.weightUnit} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// Inline wrappers that render the content without their own Dialog wrappers
import { useMemo } from 'react';
import { getExerciseHistory } from '@/lib/storage';
import { subDays, isAfter } from 'date-fns';
import { getGoalsForExercise, addExerciseGoal, deleteExerciseGoal, generateId } from '@/lib/storage';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus } from 'lucide-react';
import { GOAL_TYPE_LABELS } from '@/types/fitness';
import type { GoalType, ExerciseGoal } from '@/types/fitness';
import PeriodSelector, { type Period, periodToDays } from '@/components/PeriodSelector';

function InlineStats({ exerciseId, exerciseName, weightUnit }: { exerciseId: string; exerciseName: string; weightUnit: 'kg' | 'lb' }) {
  const [period, setPeriod] = useState<Period>('ALL');
  const unitLabel = weightUnit === 'lb' ? 'lb' : 'kg';

  const stats = useMemo(() => {
    const history = getExerciseHistory(exerciseId);
    if (!history.length) return null;
    const days = periodToDays(period);
    const cutoff = days ? subDays(new Date(), days) : null;
    const filtered = cutoff ? history.filter(h => isAfter(new Date(h.date), cutoff)) : history;
    if (!filtered.length) return null;

    let totalSets = 0, totalReps = 0, totalVolume = 0, maxWeight = 0, maxReps = 0, maxVolume = 0, bestE1rm = 0;
    for (const session of filtered) {
      for (const s of session.sets) {
        totalSets++;
        const w = s.weightKg ?? 0;
        const r = s.reps ?? 0;
        totalReps += r;
        totalVolume += w * r;
        if (w > maxWeight) maxWeight = w;
        if (r > maxReps) maxReps = r;
        const vol = w * r;
        if (vol > maxVolume) maxVolume = vol;
        const e1rm = w * (1 + r / 30);
        if (e1rm > bestE1rm) bestE1rm = e1rm;
      }
    }
    return { totalWorkouts: filtered.length, totalSets, totalReps, totalVolume, maxWeight, maxReps, maxVolume, bestE1rm };
  }, [exerciseId, period]);

  if (!stats) return <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>;

  return (
    <div className="space-y-3">
      <PeriodSelector value={period} onChange={setPeriod} />
      <div className="grid grid-cols-2 gap-2">
        {[
          ['Workouts', stats.totalWorkouts],
          ['Total Sets', stats.totalSets],
          ['Total Reps', stats.totalReps],
          ['Total Volume', `${Math.round(stats.totalVolume)} ${unitLabel}`],
          ['Max Weight', `${stats.maxWeight} ${unitLabel}`],
          ['Max Reps', stats.maxReps],
          ['Best Set Vol', `${Math.round(stats.maxVolume)} ${unitLabel}`],
          ['Est. 1RM', `${Math.round(stats.bestE1rm)} ${unitLabel}`],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-lg bg-secondary p-2.5">
            <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
            <p className="text-sm font-bold">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function computeCurrentValue(exerciseId: string, goal: ExerciseGoal): number {
  const history = getExerciseHistory(exerciseId);
  const start = goal.startDate ? new Date(goal.startDate) : null;
  const end = goal.endDate ? new Date(goal.endDate) : null;
  const filtered = history.filter(h => {
    const d = new Date(h.date);
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });

  let val = 0;
  for (const session of filtered) {
    let sessionVol = 0, sessionReps = 0;
    for (const s of session.sets) {
      const w = s.weightKg ?? 0, r = s.reps ?? 0;
      if (goal.goalType === 'MAX_WEIGHT' && w > val) val = w;
      if (goal.goalType === 'MAX_REPS' && r > val) val = r;
      if (goal.goalType === 'MAX_VOLUME' && w * r > val) val = w * r;
      if (goal.goalType === 'MAX_WEIGHT_FOR_REPS' && goal.targetReps && r >= goal.targetReps && w > val) val = w;
      if (goal.goalType === 'ESTIMATED_1RM') { const e = w * (1 + r / 30); if (e > val) val = e; }
      if (goal.goalType === 'TOTAL_VOLUME' || goal.goalType === 'MAX_WORKOUT_VOLUME') sessionVol += w * r;
      if (goal.goalType === 'TOTAL_REPS' || goal.goalType === 'MAX_WORKOUT_REPS') sessionReps += r;
    }
    if (goal.goalType === 'MAX_WORKOUT_VOLUME' && sessionVol > val) val = sessionVol;
    if (goal.goalType === 'MAX_WORKOUT_REPS' && sessionReps > val) val = sessionReps;
    if (goal.goalType === 'TOTAL_VOLUME') val += sessionVol;
    if (goal.goalType === 'TOTAL_REPS') val += sessionReps;
  }
  // Fix: for TOTAL types we accumulated in val already via +=
  return val;
}

function InlineGoals({ exerciseId, exerciseName, weightUnit }: { exerciseId: string; exerciseName: string; weightUnit: 'kg' | 'lb' }) {
  const [goals, setGoals] = useState(() => getGoalsForExercise(exerciseId));
  const [adding, setAdding] = useState(false);
  const [goalType, setGoalType] = useState<GoalType>('MAX_WEIGHT');
  const [targetValue, setTargetValue] = useState('');
  const [targetReps, setTargetReps] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const unitLabel = weightUnit === 'lb' ? 'lb' : 'kg';

  const handleAdd = () => {
    if (!targetValue) return;
    const goal: ExerciseGoal = {
      id: generateId(), exerciseId, goalType,
      targetValue: parseFloat(targetValue),
      targetReps: goalType === 'MAX_WEIGHT_FOR_REPS' ? parseInt(targetReps) || undefined : undefined,
      startDate: startDate || undefined, endDate: endDate || undefined,
      createdAt: new Date().toISOString(),
    };
    addExerciseGoal(goal);
    setGoals(getGoalsForExercise(exerciseId));
    setAdding(false);
    setTargetValue('');
    setTargetReps('');
    setStartDate('');
    setEndDate('');
  };

  const handleDelete = (id: string) => {
    deleteExerciseGoal(id);
    setGoals(getGoalsForExercise(exerciseId));
  };

  return (
    <div className="space-y-3">
      {goals.map(goal => {
        const current = computeCurrentValue(exerciseId, goal);
        const pct = Math.min(100, goal.targetValue > 0 ? (current / goal.targetValue) * 100 : 0);
        return (
          <div key={goal.id} className="rounded-lg bg-secondary p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">{GOAL_TYPE_LABELS[goal.goalType]}</p>
                <p className="text-[10px] text-muted-foreground">
                  {Math.round(current)} / {goal.targetValue} {unitLabel}
                  {goal.targetReps ? ` @ ${goal.targetReps} reps` : ''}
                </p>
              </div>
              <button onClick={() => handleDelete(goal.id)} className="p-1 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <Progress value={pct} className="h-2" />
            {(goal.startDate || goal.endDate) && (
              <p className="text-[10px] text-muted-foreground">
                {goal.startDate ?? '...'} → {goal.endDate ?? '...'}
              </p>
            )}
          </div>
        );
      })}

      {adding ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <select value={goalType} onChange={e => setGoalType(e.target.value as GoalType)} className="w-full rounded-md bg-secondary px-2 py-1.5 text-xs">
            {Object.entries(GOAL_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <Input type="number" placeholder="Target value" value={targetValue} onChange={e => setTargetValue(e.target.value)} className="bg-secondary border-0 h-8 text-xs" />
          {goalType === 'MAX_WEIGHT_FOR_REPS' && (
            <Input type="number" placeholder="Target reps" value={targetReps} onChange={e => setTargetReps(e.target.value)} className="bg-secondary border-0 h-8 text-xs" />
          )}
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-secondary border-0 h-8 text-xs" />
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-secondary border-0 h-8 text-xs" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} className="flex-1 h-7 text-xs">Save</Button>
            <Button size="sm" variant="outline" onClick={() => setAdding(false)} className="flex-1 h-7 text-xs">Cancel</Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="w-full h-8 text-xs">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Goal
        </Button>
      )}
    </div>
  );
}
