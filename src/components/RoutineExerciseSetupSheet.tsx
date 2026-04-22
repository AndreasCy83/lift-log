import { useState, useEffect } from 'react';
import { HelpCircle, Plus, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { RoutineExercise, RoutinePopulationMode, RoutinePredefinedRow, SetType } from '@/types/fitness';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseName: string;
  initial: RoutineExercise;
  /** SetType of the underlying master exercise. Drives which fields appear per predefined row. */
  setType?: SetType;
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

function emptyRow(restSeconds: number | null = null): RoutinePredefinedRow {
  return { weightKg: null, reps: null, distanceKm: null, durationMinutes: null, restSeconds };
}

function seedRowsFromLegacy(initial: RoutineExercise): RoutinePredefinedRow[] {
  const count = Math.max(1, initial.sets ?? 3);
  const reps = initial.repsMin ?? null;
  const rest = initial.restSeconds ?? null;
  return Array.from({ length: count }, () => ({
    weightKg: null,
    reps,
    distanceKm: null,
    durationMinutes: null,
    restSeconds: rest,
  }));
}

function numToStr(n: number | null | undefined): string {
  return n == null ? '' : String(n);
}

function strToNum(s: string): number | null {
  if (s.trim() === '') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function strToInt(s: string): number | null {
  if (s.trim() === '') return null;
  const n = parseInt(s);
  return isNaN(n) ? null : n;
}

export default function RoutineExerciseSetupSheet({ open, onOpenChange, exerciseName, initial, setType, onSave }: Props) {
  const [mode, setMode] = useState<RoutinePopulationMode>(initial.populationMode ?? 'predefined');
  const [rows, setRows] = useState<RoutinePredefinedRow[]>(
    initial.predefinedRows && initial.predefinedRows.length > 0
      ? initial.predefinedRows
      : seedRowsFromLegacy(initial),
  );
  const [rest, setRest] = useState(initial.restSeconds != null ? String(initial.restSeconds) : '');

  useEffect(() => {
    if (!open) return;
    setMode(initial.populationMode ?? 'predefined');
    setRows(
      initial.predefinedRows && initial.predefinedRows.length > 0
        ? initial.predefinedRows
        : seedRowsFromLegacy(initial),
    );
    setRest(initial.restSeconds != null ? String(initial.restSeconds) : '');
  }, [open, initial]);

  const updateRow = (idx: number, patch: Partial<RoutinePredefinedRow>) => {
    setRows(rs => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    setRows(rs => {
      const last = rs[rs.length - 1];
      return [...rs, last ? { ...last } : emptyRow()];
    });
  };

  const removeRow = (idx: number) => {
    setRows(rs => (rs.length <= 1 ? rs : rs.filter((_, i) => i !== idx)));
  };

  const handleSave = () => {
    const restNum = rest.trim() === '' ? null : Math.max(0, parseInt(rest) || 0);
    const updated: RoutineExercise = {
      ...initial,
      populationMode: mode,
      // Keep legacy aggregates roughly in sync for backward-compat summaries.
      sets: Math.max(1, rows.length),
      repsMin: rows[0]?.reps ?? initial.repsMin ?? null,
      repsMax: initial.repsMax ?? null,
      restSeconds: restNum,
      predefinedRows: rows,
    };
    onSave(updated);
    onOpenChange(false);
  };

  const showWeight = setType === 'WEIGHT_REPS' || setType === 'WEIGHT_TIME' || setType === 'WEIGHT_ONLY' || setType == null;
  const showReps = setType === 'WEIGHT_REPS' || setType === 'REPS_DISTANCE' || setType === 'REPS_TIME';
  const showDistance = setType === 'REPS_DISTANCE';
  const showDuration = setType === 'WEIGHT_TIME' || setType === 'REPS_TIME';

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
              <div className="space-y-2">
                {rows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground w-5 flex-shrink-0">#{idx + 1}</span>
                    {showWeight && (
                      <Input
                        type="number" inputMode="decimal" placeholder="kg" min={0}
                        value={numToStr(row.weightKg)}
                        onChange={e => updateRow(idx, { weightKg: strToNum(e.target.value) })}
                        className="h-9 text-sm text-center px-2 min-w-0 flex-1"
                        aria-label={`Set ${idx + 1} weight`}
                      />
                    )}
                    {showReps && (
                      <Input
                        type="number" inputMode="numeric" placeholder="Reps" min={0}
                        value={numToStr(row.reps)}
                        onChange={e => updateRow(idx, { reps: strToInt(e.target.value) })}
                        className="h-9 text-sm text-center px-2 min-w-0 flex-1"
                        aria-label={`Set ${idx + 1} reps`}
                      />
                    )}
                    {showDistance && (
                      <Input
                        type="number" inputMode="decimal" placeholder="km" min={0}
                        value={numToStr(row.distanceKm)}
                        onChange={e => updateRow(idx, { distanceKm: strToNum(e.target.value) })}
                        className="h-9 text-sm text-center px-2 min-w-0 flex-1"
                        aria-label={`Set ${idx + 1} distance`}
                      />
                    )}
                    {showDuration && (
                      <Input
                        type="number" inputMode="decimal" placeholder="min" min={0}
                        value={numToStr(row.durationMinutes)}
                        onChange={e => updateRow(idx, { durationMinutes: strToNum(e.target.value) })}
                        className="h-9 text-sm text-center px-2 min-w-0 flex-1"
                        aria-label={`Set ${idx + 1} duration`}
                      />
                    )}
                    <Input
                      type="number" inputMode="numeric" placeholder="Rest" min={0}
                      value={numToStr(row.restSeconds)}
                      onChange={e => updateRow(idx, { restSeconds: strToInt(e.target.value) })}
                      className="h-9 text-sm text-center px-2 min-w-0 flex-1"
                      aria-label={`Set ${idx + 1} rest seconds`}
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      disabled={rows.length <= 1}
                      className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-30 flex-shrink-0"
                      aria-label={`Remove set ${idx + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addRow}
                className="w-full gap-1 text-primary"
              >
                <Plus className="h-4 w-4" /> Add set
              </Button>
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
