import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ExerciseMedia } from '@/lib/exerciseMedia';
import { getExercises, getExerciseHistory, getSettings } from '@/lib/storage';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseName: string;
  media: ExerciseMedia;
}

/**
 * Lightweight preview modal. Shows the animated GIF plus a compact grid of
 * lifetime stats derived from the same data source as the full stats dialog —
 * no new metadata is fetched or invented.
 */
export default function ExerciseMediaPreview({ open, onOpenChange, exerciseName, media }: Props) {
  const [gifFailed, setGifFailed] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const { stats, unit, dw } = useMemo(() => {
    const settings = getSettings();
    const globalWeightUnit = settings.weightUnit;
    const unitLabel = weightUnitLabel(globalWeightUnit);
    const toDisp = (v: number) => toDisplayWeight(v, globalWeightUnit) ?? v;

    if (!open) return { stats: null as null | ReturnType<typeof computeStats>, unit: unitLabel, dw: toDisp };

    const ex = getExercises().find(e => e.name.toLowerCase() === exerciseName.trim().toLowerCase());
    if (!ex) return { stats: null, unit: unitLabel, dw: toDisp };
    const history = getExerciseHistory(ex.id);
    return { stats: computeStats(history), unit: unitLabel, dw: toDisp };
  }, [open, exerciseName]);

  const fmt = (v: number | null | undefined) =>
    v == null || Number.isNaN(v) ? '—' : v.toLocaleString();
  const fmtW = (v: number | null | undefined) =>
    v == null || v === 0 ? '—' : `${dw(v).toLocaleString()} ${unit}`;

  const tiles: { label: string; value: string }[] = stats
    ? [
        { label: 'Workouts', value: fmt(stats.totalWorkouts) },
        { label: 'Total Sets', value: fmt(stats.totalSets) },
        { label: 'Total Reps', value: fmt(stats.totalReps) },
        { label: 'Total Volume', value: fmtW(stats.totalVolume) },
        { label: 'Max Weight', value: fmtW(stats.maxWeight) },
        { label: 'Max Reps', value: stats.maxReps ? fmt(stats.maxReps) : '—' },
        { label: 'Best Set Vol.', value: fmtW(stats.maxVolume) },
        { label: 'Est. 1RM', value: fmtW(stats.estimatedE1rm) },
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-3 gap-2">
        <DialogHeader className="px-1">
          <DialogTitle className="font-display text-sm font-semibold truncate pr-6">
            {exerciseName}
          </DialogTitle>
        </DialogHeader>
        <div className="mx-auto flex h-[180px] w-[180px] items-center justify-center rounded-xl bg-secondary/60 ring-1 ring-inset ring-border/60 overflow-hidden">
          {!gifFailed ? (
            <img
              src={media.gifUrl}
              alt={`${exerciseName} demonstration`}
              className="h-full w-full object-contain"
              onError={() => setGifFailed(true)}
            />
          ) : !imgFailed ? (
            <img
              src={media.imageUrl}
              alt={exerciseName}
              className="h-full w-full object-contain"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="p-6 text-xs text-muted-foreground text-center">
              Preview unavailable
            </div>
          )}
        </div>

        {stats && stats.totalSets > 0 ? (
          <div className="grid grid-cols-2 gap-2 mt-1">
            {tiles.map(t => (
              <div
                key={t.label}
                className="rounded-lg bg-secondary/50 ring-1 ring-inset ring-border/50 px-2.5 py-2 text-center"
              >
                <div className="font-display text-sm font-bold text-primary leading-tight truncate">
                  {t.value}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase leading-tight mt-0.5">
                  {t.label}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-[11px] text-muted-foreground py-2">
            No stats yet — log a set to start tracking.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function computeStats(history: ReturnType<typeof getExerciseHistory>) {
  let totalSets = 0;
  let totalReps = 0;
  let totalVolume = 0;
  let maxWeight = 0;
  let maxReps = 0;
  let maxVolume = 0;
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
  };
}
