import { useState, useMemo } from 'react';
import { ChevronLeft, Plus, Ruler, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { getBodyGoals, saveBodyGoals, getBodyEntries } from '@/lib/bodyTrackerStorage';
import { getSettings } from '@/lib/storage';
import { toDisplayWeight, toStorageKg, weightUnitLabel } from '@/lib/units';
import {
  MEASUREMENT_OPTIONS,
  measurementLabel,
  cmToDisplay,
  displayToCm,
} from '@/lib/bodyMeasurements';
import type {
  BodyMeasurementGoal,
  BodyMeasurementKey,
  BodyMeasurementUnit,
} from '@/types/bodyTracker';
import { toast } from 'sonner';

interface Props {
  onBack: () => void;
  onSaved: () => void;
}

export default function BodyGoalsPanel({ onBack, onSaved }: Props) {
  const settings = getSettings();
  const wu = settings.weightUnit;
  const unitLabel = weightUnitLabel(wu);
  const goals = getBodyGoals();
  const entries = useMemo(() => getBodyEntries(), []);
  const latest = entries[0];

  const [targetWeight, setTargetWeight] = useState(
    goals.targetWeightKg != null ? String(toDisplayWeight(goals.targetWeightKg, wu) ?? '') : ''
  );
  const [targetWeightDate, setTargetWeightDate] = useState(goals.targetWeightDate ?? '');
  const [targetBf, setTargetBf] = useState(goals.targetBodyFatPercent != null ? String(goals.targetBodyFatPercent) : '');
  const [targetBfDate, setTargetBfDate] = useState(goals.targetBodyFatDate ?? '');
  const [targetMm, setTargetMm] = useState(goals.targetMuscleMassPercent != null ? String(goals.targetMuscleMassPercent) : '');
  const [targetMmDate, setTargetMmDate] = useState(goals.targetMuscleMassDate ?? '');

  // Measurement goals
  const [measurementGoals, setMeasurementGoals] = useState<BodyMeasurementGoal[]>(
    goals.measurementGoals ?? []
  );
  const [measureUnit, setMeasureUnit] = useState<BodyMeasurementUnit>('cm');
  const [moreOpen, setMoreOpen] = useState((goals.measurementGoals?.length ?? 0) > 0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSelection, setPickerSelection] = useState<Set<BodyMeasurementKey>>(new Set());

  const findLatestMeasurementCm = (key: BodyMeasurementKey): number | null => {
    for (const e of entries) {
      const m = e.measurements?.find(x => x.key === key);
      if (m && m.valueCm > 0) return m.valueCm;
    }
    return null;
  };

  const openPicker = () => {
    setPickerSelection(new Set());
    setPickerOpen(true);
  };

  const togglePick = (k: BodyMeasurementKey) => {
    setPickerSelection(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const confirmPicker = () => {
    setMeasurementGoals(prev => {
      const existing = new Set(prev.map(g => g.key));
      const additions: BodyMeasurementGoal[] = [];
      pickerSelection.forEach(k => {
        if (!existing.has(k)) {
          additions.push({ key: k, targetCm: 0, startCm: findLatestMeasurementCm(k) });
        }
      });
      return [...prev, ...additions];
    });
    setPickerOpen(false);
  };

  const removeMeasurementGoal = (k: BodyMeasurementKey) => {
    setMeasurementGoals(prev => prev.filter(g => g.key !== k));
  };

  const updateMeasurementGoalValue = (k: BodyMeasurementKey, displayVal: string) => {
    const num = parseFloat(displayVal);
    setMeasurementGoals(prev => prev.map(g =>
      g.key === k
        ? { ...g, targetCm: isNaN(num) ? 0 : displayToCm(num, measureUnit) }
        : g
    ));
  };

  const updateMeasurementGoalDate = (k: BodyMeasurementKey, date: string) => {
    setMeasurementGoals(prev => prev.map(g =>
      g.key === k ? { ...g, targetDate: date || null } : g
    ));
  };

  const handleSave = () => {
    const tw = targetWeight ? parseFloat(targetWeight) : null;
    const cleanedGoals = measurementGoals
      .filter(g => g.targetCm > 0)
      .map(g => ({
        ...g,
        startCm: g.startCm ?? findLatestMeasurementCm(g.key),
        targetDate: g.targetDate || null,
      }));

    saveBodyGoals({
      targetWeightKg: tw != null ? (toStorageKg(tw, wu) ?? tw) : null,
      targetBodyFatPercent: targetBf ? parseFloat(targetBf) : null,
      targetMuscleMassPercent: targetMm ? parseFloat(targetMm) : null,
      startWeightKg: tw != null ? (goals.startWeightKg ?? latest?.weightKg ?? null) : null,
      startBodyFatPercent: targetBf ? (goals.startBodyFatPercent ?? latest?.bodyFatPercent ?? null) : null,
      startMuscleMassPercent: targetMm ? (goals.startMuscleMassPercent ?? latest?.muscleMassPercent ?? null) : null,
      targetWeightDate: tw != null ? (targetWeightDate || null) : null,
      targetBodyFatDate: targetBf ? (targetBfDate || null) : null,
      targetMuscleMassDate: targetMm ? (targetMmDate || null) : null,
      measurementGoals: cleanedGoals,
    });
    toast.success('Goals saved');
    onSaved();
  };

  const availableForPicker = MEASUREMENT_OPTIONS.filter(
    o => !measurementGoals.some(g => g.key === o.key)
  );

  return (
    <div className="flex flex-col h-[100dvh] bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="sticky top-0 z-20 bg-background flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={onBack} className="p-1"><ChevronLeft className="h-5 w-5" /></button>
        <h2 className="font-display text-lg font-semibold">Body Goals</h2>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-6 space-y-6" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 200px)' }}>
        <div className="gym-card space-y-3">
          <label className="text-sm font-medium">Target Weight ({unitLabel})</label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder={`e.g. 75 ${unitLabel}`}
            value={targetWeight}
            onChange={e => setTargetWeight(e.target.value)}
          />
        </div>

        <div className="gym-card space-y-3">
          <label className="text-sm font-medium">Target Body Fat %</label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="e.g. 12"
            value={targetBf}
            onChange={e => setTargetBf(e.target.value)}
          />
        </div>

        <div className="gym-card space-y-3">
          <label className="text-sm font-medium">Target Muscle Mass %</label>
          <Input
            type="number"
            inputMode="decimal"
            placeholder="e.g. 45"
            value={targetMm}
            onChange={e => setTargetMm(e.target.value)}
          />
        </div>

        {/* More Measurements */}
        <div className="gym-card !p-3 space-y-3">
          <button
            type="button"
            onClick={() => setMoreOpen(o => !o)}
            className="w-full flex items-center justify-between"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Ruler className="h-4 w-4 text-primary" />
              More Measurements
              {measurementGoals.length > 0 && (
                <span className="text-[10px] text-muted-foreground">({measurementGoals.length})</span>
              )}
            </span>
            {moreOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {moreOpen && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Unit</span>
                <div className="inline-flex rounded-full border border-border overflow-hidden">
                  {(['cm', 'in'] as const).map(u => (
                    <button
                      key={u}
                      onClick={() => setMeasureUnit(u)}
                      className={`px-3 py-1 text-xs font-medium transition-colors ${
                        measureUnit === u ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {measurementGoals.length > 0 && (
                <div className="space-y-2">
                  {measurementGoals.map(g => {
                    const display = g.targetCm > 0 ? cmToDisplay(g.targetCm, measureUnit).toString() : '';
                    return (
                      <div key={g.key} className="flex items-center gap-2">
                        <span className="flex-1 text-sm">{measurementLabel(g.key)}</span>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={display}
                          onChange={(e) => updateMeasurementGoalValue(g.key, e.target.value)}
                          placeholder="0"
                          className="w-20 h-8 bg-secondary border-0 text-sm text-right"
                        />
                        <span className="text-xs text-muted-foreground w-7">{measureUnit}</span>
                        <button
                          onClick={() => removeMeasurementGoal(g.key)}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive"
                          aria-label="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <Button
                type="button"
                variant="secondary"
                onClick={openPicker}
                disabled={availableForPicker.length === 0}
                className="w-full h-9 text-sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Measurement Goals
              </Button>
            </div>
          )}
        </div>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-4 pt-3 border-t border-border bg-background/95 backdrop-blur-lg"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)' }}
      >
        <Button onClick={handleSave} className="w-full h-12 text-base font-semibold">Save Goals</Button>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Measurement Goals</DialogTitle>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-y-auto -mx-2 px-2">
            {availableForPicker.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                All measurements already added.
              </p>
            ) : (
              <div className="space-y-1">
                {availableForPicker.map(opt => {
                  const checked = pickerSelection.has(opt.key);
                  return (
                    <label
                      key={opt.key}
                      className="flex items-center gap-3 px-2 py-2.5 rounded-md hover:bg-secondary/60 cursor-pointer"
                    >
                      <Checkbox checked={checked} onCheckedChange={() => togglePick(opt.key)} />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <Button variant="ghost" onClick={() => setPickerOpen(false)}>Cancel</Button>
            <Button onClick={confirmPicker} disabled={pickerSelection.size === 0}>
              Add{pickerSelection.size > 0 ? ` (${pickerSelection.size})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
