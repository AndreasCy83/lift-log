import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getExerciseHistory, getSettings } from '@/lib/storage';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';
import PeriodSelector, { Period, periodToDays } from '@/components/PeriodSelector';
import { subDays, isAfter } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseId: string;
  exerciseName: string;
  weightUnit: 'kg' | 'lb';
}

export default function ExerciseStatsDialog({ open, onOpenChange, exerciseId, exerciseName, weightUnit }: Props) {
  const [period, setPeriod] = useState<Period>('ALL');

  const stats = useMemo(() => {
    if (!open) return null;
    const allHistory = getExerciseHistory(exerciseId);

    const days = periodToDays(period);
    const history = days
      ? allHistory.filter(h => isAfter(new Date(h.date), subDays(new Date(), days)))
      : allHistory;

    if (history.length === 0) return null;

    let totalSets = 0;
    let totalReps = 0;
    let totalVolume = 0;
    let maxWeight = 0;
    let maxReps = 0;
    let maxVolume = 0; // max single-set volume
    let bestE1rm = 0;

    for (const session of history) {
      for (const s of session.sets) {
        totalSets++;
        const w = s.weightKg ?? 0;
        const r = s.reps ?? 0;
        const setVol = w * r;

        totalReps += r;
        totalVolume += setVol;
        if (w > maxWeight) maxWeight = w;
        if (r > maxReps) maxReps = r;
        if (setVol > maxVolume) maxVolume = setVol;

        if (w > 0 && r > 0) {
          const e1rm = w * (1 + r / 30);
          if (e1rm > bestE1rm) bestE1rm = e1rm;
        }
      }
    }

    return {
      totalWorkouts: history.length,
      totalSets,
      totalReps,
      totalVolume,
      maxWeight,
      maxReps,
      maxVolume,
      estimatedE1rm: Math.round(bestE1rm * 10) / 10,
      workoutVolume: history.length > 0 ? Math.round(totalVolume / history.length) : 0,
    };
  }, [open, exerciseId, period]);

  const globalWeightUnit = getSettings().weightUnit;
  const unit = weightUnitLabel(globalWeightUnit);
  const dw = (v: number) => toDisplayWeight(v, globalWeightUnit) ?? v;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-base">{exerciseName} – Stats</DialogTitle>
        </DialogHeader>

        <PeriodSelector value={period} onChange={setPeriod} />

        {!stats ? (
          <p className="text-center text-muted-foreground py-8 text-sm">No data for this period</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 mt-2">
            <StatCell label="Total Workouts" value={stats.totalWorkouts} />
            <StatCell label="Total Sets" value={stats.totalSets} />
            <StatCell label="Total Reps" value={stats.totalReps.toLocaleString()} />
            <StatCell label="Total Volume" value={`${dw(stats.totalVolume).toLocaleString()} ${unit}`} />
            <StatCell label="Max Weight" value={`${dw(stats.maxWeight)} ${unit}`} />
            <StatCell label="Est. 1RM" value={`${dw(stats.estimatedE1rm)} ${unit}`} />
            <StatCell label="Max Reps" value={stats.maxReps} />
            <StatCell label="Max Set Vol." value={`${dw(stats.maxVolume).toLocaleString()} ${unit}`} />
            <StatCell label="Avg Workout Vol." value={`${dw(stats.workoutVolume).toLocaleString()} ${unit}`} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-secondary/50 p-3 text-center">
      <div className="font-display text-lg font-bold text-primary">{value}</div>
      <div className="text-[10px] text-muted-foreground uppercase leading-tight mt-1">{label}</div>
    </div>
  );
}
