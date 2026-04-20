import { useState, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { RoutineExercise, RoutinePopulationMode } from '@/types/fitness';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseName: string;
  initial: RoutineExercise;
  onSave: (updated: RoutineExercise) => void;
}

const MODE_HELP: Record<RoutinePopulationMode, string> = {
  copy_previous: 'Uses the sets from the most recent workout for this exercise each time this routine runs.',
  predefined: 'Uses fixed sets, reps, and rest values saved in this routine.',
  blank: 'Adds the exercise only. You enter the set details during the workout.',
};

const MODE_LABEL: Record<RoutinePopulationMode, string> = {
  copy_previous: 'Copy previous sets',
  predefined: 'Use predefined sets',
  blank: "Don't populate any sets",
};

export default function RoutineExerciseSetupSheet({ open, onOpenChange, exerciseName, initial, onSave }: Props) {
  const [mode, setMode] = useState<RoutinePopulationMode>(initial.populationMode ?? 'predefined');
  const [sets, setSets] = useState(String(initial.sets ?? 3));
  const [repsMin, setRepsMin] = useState(initial.repsMin != null ? String(initial.repsMin) : '');
  const [repsMax, setRepsMax] = useState(initial.repsMax != null ? String(initial.repsMax) : '');
  const [rest, setRest] = useState(initial.restSeconds != null ? String(initial.restSeconds) : '');

  useEffect(() => {
    if (!open) return;
    setMode(initial.populationMode ?? 'predefined');
    setSets(String(initial.sets ?? 3));
    setRepsMin(initial.repsMin != null ? String(initial.repsMin) : '');
    setRepsMax(initial.repsMax != null ? String(initial.repsMax) : '');
    setRest(initial.restSeconds != null ? String(initial.restSeconds) : '');
  }, [open, initial]);

  const handleSave = () => {
    const updated: RoutineExercise = {
      ...initial,
      populationMode: mode,
      sets: Math.max(1, parseInt(sets) || 1),
      repsMin: repsMin.trim() === '' ? null : Math.max(0, parseInt(repsMin) || 0),
      repsMax: repsMax.trim() === '' ? null : Math.max(0, parseInt(repsMax) || 0),
      restSeconds: rest.trim() === '' ? null : Math.max(0, parseInt(rest) || 0),
    };
    onSave(updated);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left">{exerciseName}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pt-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              How should this exercise behave every time this routine runs?
            </p>
            <div className="space-y-2">
              {(['copy_previous', 'predefined', 'blank'] as RoutinePopulationMode[]).map((m) => {
                const selected = mode === m;
                return (
                  <div
                    key={m}
                    className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                      selected ? 'border-primary bg-primary/10' : 'border-border bg-secondary/30'
                    }`}
                    onClick={() => setMode(m)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className={`h-4 w-4 rounded-full border-2 flex-shrink-0 ${
                          selected ? 'border-primary bg-primary' : 'border-muted-foreground'
                        }`}
                      />
                      <span className="text-sm font-medium truncate">{MODE_LABEL[m]}</span>
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="ml-2 rounded-full p-1 text-muted-foreground hover:text-primary"
                          aria-label="What does this mean?"
                        >
                          <HelpCircle className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent side="top" align="end" className="w-64 text-xs">
                        {MODE_HELP[m]}
                      </PopoverContent>
                    </Popover>
                  </div>
                );
              })}
            </div>
          </div>

          {mode === 'predefined' && (
            <div className="space-y-3 rounded-lg border border-border p-3 bg-secondary/20">
              <div className="space-y-1.5">
                <Label htmlFor="re-sets">Sets</Label>
                <Input id="re-sets" type="number" inputMode="numeric" min={1}
                  value={sets} onChange={e => setSets(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="re-reps-min">Reps min</Label>
                  <Input id="re-reps-min" type="number" inputMode="numeric" min={0}
                    value={repsMin} onChange={e => setRepsMin(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="re-reps-max">Reps max</Label>
                  <Input id="re-reps-max" type="number" inputMode="numeric" min={0}
                    value={repsMax} onChange={e => setRepsMax(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="re-rest">Rest (seconds)</Label>
                <Input id="re-rest" type="number" inputMode="numeric" min={0}
                  value={rest} onChange={e => setRest(e.target.value)} />
              </div>
            </div>
          )}

          {mode === 'copy_previous' && (
            <div className="rounded-lg border border-border p-3 bg-secondary/20">
              <Label htmlFor="re-rest-cp" className="mb-1.5 block">Rest (seconds, optional override)</Label>
              <Input id="re-rest-cp" type="number" inputMode="numeric" min={0}
                value={rest} onChange={e => setRest(e.target.value)} placeholder="Leave blank to use copied rest" />
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleSave}>Save</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
