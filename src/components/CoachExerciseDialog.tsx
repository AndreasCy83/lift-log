import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  applyCoachRecommendation,
  isRecommendationApplied,
  isWECoachApplied,
  getCoachAppliedToWE,
  isRecommendationDeferred,
  deferRecommendation,
  type CoachPrescription,
} from '@/lib/coachApply';
import {
  computeCoachRecommendations,
  loadCachedCoachSnapshot,
} from '@/lib/coachRecommendations';
import type { ProgressionRecommendation } from '@/lib/progressionEngine';
import { toast } from 'sonner';
import { Check, Sparkles } from 'lucide-react';
import { toDisplayWeight, weightUnitLabel, type WeightUnitSetting } from '@/lib/units';

interface Props {
  open: boolean;
  onClose: () => void;
  exerciseId: string;
  exerciseName: string;
  workoutExerciseId: string;
  weightUnit: WeightUnitSetting;
  onApplied?: () => void;
}

function findRec(exerciseId: string): ProgressionRecommendation | null {
  const snap = loadCachedCoachSnapshot() ?? computeCoachRecommendations();
  return snap.items.find((r) => r.exerciseId === exerciseId) ?? null;
}

function fmtWeight(kg: number | null, unit: WeightUnitSetting): string {
  if (kg == null) return '—';
  const v = toDisplayWeight(kg, unit) ?? 0;
  return `${v.toFixed(1)} ${weightUnitLabel(unit)}`;
}

function deltaLabel(curr: number | null, next: number | null, unit: WeightUnitSetting) {
  if (curr == null || next == null) return null;
  const d = next - curr;
  if (Math.abs(d) < 0.05) return null;
  const sign = d > 0 ? '+' : '−';
  const abs = toDisplayWeight(Math.abs(d), unit) ?? 0;
  return `${sign}${abs.toFixed(1)} ${weightUnitLabel(unit)}`;
}

export default function CoachExerciseDialog({
  open, onClose, exerciseId, exerciseName, workoutExerciseId, weightUnit, onApplied,
}: Props) {
  // Read fresh rec each open; also re-read after defer/apply so the dialog
  // immediately reflects shared state (e.g. hides rec if deferred).
  const [tick, setTick] = useState(0);
  const rec = useMemo(
    () => (open ? findRec(exerciseId) : null),
    [open, exerciseId, tick],
  );
  const weApplied = useMemo(
    () => (open ? isWECoachApplied(workoutExerciseId) : false),
    [open, workoutExerciseId, tick],
  );
  const activePrescription: CoachPrescription | null = useMemo(
    () => (open ? getCoachAppliedToWE(workoutExerciseId) : null),
    [open, workoutExerciseId, tick],
  );

  const recApplied = rec ? isRecommendationApplied(rec) : false;
  const recDeferred = rec ? isRecommendationDeferred(rec) : false;

  const handleApply = () => {
    if (!rec) return;
    const outcome = applyCoachRecommendation(rec);
    if (outcome.kind === 'applied') {
      toast.success(`Coach applied to ${outcome.exerciseName}`);
    } else if (outcome.kind === 'pending') {
      toast(`Saved — will apply next time you add ${outcome.exerciseName}`);
    } else if (outcome.kind === 'needs_confirm') {
      const ok = window.confirm(
        `You've already edited the planned values for ${outcome.exerciseName}. Overwrite with Coach values?`,
      );
      if (ok) {
        const forced = applyCoachRecommendation(rec, { force: true });
        if (forced.kind === 'applied') toast.success(`Coach applied to ${forced.exerciseName}`);
      }
    }
    onApplied?.();
    onClose();
  };

  const handleDefer = () => {
    if (!rec) return;
    deferRecommendation(rec);
    toast(`Saved to review later — back in ~12 days`);
    onApplied?.();
    setTick((n) => n + 1);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Coach · {exerciseName}
          </DialogTitle>
        </DialogHeader>

        {weApplied && activePrescription && (
          <div className="rounded-md bg-primary/10 border border-primary/30 px-3 py-2 text-xs flex items-start gap-2">
            <Check className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
            <div className="leading-snug">
              <div className="font-medium text-foreground">Coach values active on this card</div>
              <div className="text-muted-foreground mt-0.5">
                {activePrescription.sets} × {activePrescription.repInfo} @ {fmtWeight(activePrescription.weightKg, weightUnit)}
              </div>
            </div>
          </div>
        )}

        {recDeferred && (
          <div className="rounded-md bg-muted/40 border border-border/60 px-3 py-2 text-xs text-muted-foreground">
            Saved to review later — Coach will resurface this in ~12 days if still relevant.
          </div>
        )}

        {!rec && (
          <div className="text-sm text-muted-foreground py-2">
            No active recommendation for this exercise right now.
          </div>
        )}

        {rec && (
          <div className="space-y-3">
            <div className="text-sm font-medium">{rec.mainAction ?? rec.recommendationType.replace(/_/g, ' ')}</div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-secondary/50 px-2 py-2">
                <div className="text-[10px] uppercase text-muted-foreground">Sets</div>
                <div className="text-sm font-semibold">
                  {rec.currentSets} → {rec.nextSets}
                </div>
              </div>
              <div className="rounded-md bg-secondary/50 px-2 py-2">
                <div className="text-[10px] uppercase text-muted-foreground">Reps</div>
                <div className="text-sm font-semibold">{rec.nextRepInfo}</div>
                <div className="text-[10px] text-muted-foreground">from {rec.currentRepInfo}</div>
              </div>
              <div className="rounded-md bg-secondary/50 px-2 py-2">
                <div className="text-[10px] uppercase text-muted-foreground">Load</div>
                <div className="text-sm font-semibold">{fmtWeight(rec.nextWeightKg, weightUnit)}</div>
                {deltaLabel(rec.currentWeightKg, rec.nextWeightKg, weightUnit) && (
                  <div className="text-[10px] text-muted-foreground">
                    {deltaLabel(rec.currentWeightKg, rec.nextWeightKg, weightUnit)}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Confidence</span>
              <span className="font-medium capitalize">{rec.confidence}</span>
            </div>

            {(rec.topReasons ?? rec.reasons).slice(0, 3).length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                {(rec.topReasons ?? rec.reasons).slice(0, 3).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}

            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 border border-sky-500/30"
                onClick={handleDefer}
                disabled={recApplied || recDeferred}
                aria-label="Review this recommendation later"
              >
                Review later
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleApply}
                disabled={recApplied}
              >
                {recApplied ? 'Applied' : 'Apply'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
