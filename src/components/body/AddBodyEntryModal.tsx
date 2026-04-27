import { useState, useMemo } from 'react';
import { X, CalendarClock, Plus, Ruler, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import WeightRulerPicker from './WeightRulerPicker';
import { addBodyEntry, updateBodyEntry, getBodyEntries } from '@/lib/bodyTrackerStorage';
import { getSettings, getProfile } from '@/lib/storage';
import { toDisplayWeight, toStorageKg, weightUnitLabel } from '@/lib/units';
import type { BodyEntry, BodyMeasurement, BodyMeasurementKey, BodyMeasurementUnit } from '@/types/bodyTracker';
import { format } from 'date-fns';
import {
  MEASUREMENT_OPTIONS,
  measurementLabel as labelFor,
  cmToDisplay,
  displayToCm,
  getHistoricMeasurementKeys,
} from '@/lib/bodyMeasurements';

interface AddBodyEntryModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editEntry?: BodyEntry | null;
}

export default function AddBodyEntryModal({ open, onClose, onSaved, editEntry }: AddBodyEntryModalProps) {
  const settings = getSettings();
  const profile = getProfile();
  const wu = settings.weightUnit;
  const unitLabel = weightUnitLabel(wu);

  const defaultWeight = editEntry
    ? (toDisplayWeight(editEntry.weightKg, wu) ?? 75)
    : (toDisplayWeight(profile?.currentWeightKg ?? 75, wu) ?? 75);

  const initialDate = editEntry
    ? new Date(editEntry.date + 'T' + editEntry.time)
    : new Date();

  // Preselect measurement keys that have ever been used in past entries (only for new entries).
  const historicKeys = useMemo(() => {
    if (editEntry) return new Set<BodyMeasurementKey>();
    return getHistoricMeasurementKeys(getBodyEntries());
  }, [editEntry, open]);

  const initialMeasurements: BodyMeasurement[] = editEntry?.measurements
    ? editEntry.measurements
    : Array.from(historicKeys).map(k => ({ key: k, valueCm: 0 }));

  const [entryDate, setEntryDate] = useState(initialDate);
  const [weight, setWeight] = useState(defaultWeight);
  const [bodyFat, setBodyFat] = useState(editEntry?.bodyFatPercent ?? 0);
  const [muscleMass, setMuscleMass] = useState(editEntry?.muscleMassPercent ?? 0);
  const [note, setNote] = useState(editEntry?.note ?? '');
  const [showBodyFat, setShowBodyFat] = useState(!!(editEntry?.bodyFatPercent));
  const [showMuscleMass, setShowMuscleMass] = useState(!!(editEntry?.muscleMassPercent));
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Extra measurements
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>(initialMeasurements);
  const [measureUnit, setMeasureUnit] = useState<BodyMeasurementUnit>('cm');
  const [moreOpen, setMoreOpen] = useState(initialMeasurements.length > 0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSelection, setPickerSelection] = useState<Set<BodyMeasurementKey>>(new Set());

  if (!open) return null;

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    const newDate = new Date(entryDate);
    const [y, m, d] = val.split('-').map(Number);
    newDate.setFullYear(y, m - 1, d);
    setEntryDate(newDate);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    const [h, min] = val.split(':').map(Number);
    const newDate = new Date(entryDate);
    newDate.setHours(h, min);
    setEntryDate(newDate);
  };

  const openPicker = () => {
    setPickerSelection(new Set());
    setPickerOpen(true);
  };

  const togglePick = (k: BodyMeasurementKey) => {
    setPickerSelection(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const confirmPicker = () => {
    setMeasurements(prev => {
      const existing = new Set(prev.map(m => m.key));
      const additions: BodyMeasurement[] = [];
      pickerSelection.forEach(k => {
        if (!existing.has(k)) additions.push({ key: k, valueCm: 0 });
      });
      return [...prev, ...additions];
    });
    setPickerOpen(false);
  };

  const removeMeasurement = (k: BodyMeasurementKey) => {
    setMeasurements(prev => prev.filter(m => m.key !== k));
  };

  const updateMeasurementValue = (k: BodyMeasurementKey, displayVal: string) => {
    const num = parseFloat(displayVal);
    setMeasurements(prev => prev.map(m =>
      m.key === k
        ? { ...m, valueCm: isNaN(num) ? 0 : displayToCm(num, measureUnit) }
        : m
    ));
  };

  const handleSave = () => {
    const weightKg = toStorageKg(weight, wu) ?? weight;
    const cleanedMeasurements = measurements.filter(m => m.valueCm > 0);

    if (editEntry) {
      updateBodyEntry({
        ...editEntry,
        date: format(entryDate, 'yyyy-MM-dd'),
        time: format(entryDate, 'HH:mm'),
        weightKg,
        bodyFatPercent: showBodyFat && bodyFat > 0 ? bodyFat : null,
        muscleMassPercent: showMuscleMass && muscleMass > 0 ? muscleMass : null,
        note,
        measurements: cleanedMeasurements.length > 0 ? cleanedMeasurements : undefined,
      });
    } else {
      addBodyEntry({
        date: format(entryDate, 'yyyy-MM-dd'),
        time: format(entryDate, 'HH:mm'),
        weightKg,
        bodyFatPercent: showBodyFat && bodyFat > 0 ? bodyFat : null,
        muscleMassPercent: showMuscleMass && muscleMass > 0 ? muscleMass : null,
        note,
        measurements: cleanedMeasurements.length > 0 ? cleanedMeasurements : undefined,
      });
    }
    onSaved();
    onClose();
  };

  const availableForPicker = MEASUREMENT_OPTIONS.filter(
    o => !measurements.some(m => m.key === o.key)
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={onClose} className="p-1"><X className="h-5 w-5 text-muted-foreground" /></button>
        <h2 className="font-display text-lg font-semibold">{editEntry ? 'Edit Entry' : 'New Body Entry'}</h2>
        <div className="w-7" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 160px)' }}>
        {/* Date/time pill */}
        <div className="text-center">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="inline-flex items-center gap-2 rounded-full bg-primary/20 px-4 py-1.5 active:scale-95 transition-transform"
          >
            <CalendarClock className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">
              {format(entryDate, 'EEE, d MMM yyyy')} — {format(entryDate, 'HH:mm')}
            </span>
          </button>
          {showDatePicker && (
            <div className="mt-3 flex justify-center gap-3">
              <Input
                type="date"
                value={format(entryDate, 'yyyy-MM-dd')}
                onChange={handleDateChange}
                className="w-auto bg-card border-border text-sm"
              />
              <Input
                type="time"
                value={format(entryDate, 'HH:mm')}
                onChange={handleTimeChange}
                className="w-auto bg-card border-border text-sm"
              />
            </div>
          )}
        </div>

        {/* Weight ruler — compact */}
        <div className="gym-card !p-3" data-tutorial="body-weight">
          <WeightRulerPicker
            value={weight}
            onChange={setWeight}
            min={wu === 'lbs' ? 60 : 30}
            max={wu === 'lbs' ? 440 : 200}
            step={0.1}
            unit={unitLabel}
            label="Weight"
            color="hsl(var(--primary))"
          />
        </div>

        {/* Body fat */}
        <div className="gym-card !p-3" data-tutorial="body-fat">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Body Fat %</span>
            <button
              onClick={() => setShowBodyFat(!showBodyFat)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${showBodyFat ? 'bg-primary/20 border-primary text-primary' : 'border-border text-muted-foreground'}`}
            >
              {showBodyFat ? 'On' : 'Off'}
            </button>
          </div>
          {showBodyFat && (
            <WeightRulerPicker
              value={bodyFat}
              onChange={setBodyFat}
              min={3}
              max={50}
              step={0.1}
              unit="%"
              color="hsl(38, 92%, 50%)"
            />
          )}
        </div>

        {/* Muscle mass */}
        <div className="gym-card !p-3" data-tutorial="body-muscle">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Muscle Mass %</span>
            <button
              onClick={() => setShowMuscleMass(!showMuscleMass)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${showMuscleMass ? 'bg-primary/20 border-primary text-primary' : 'border-border text-muted-foreground'}`}
            >
              {showMuscleMass ? 'On' : 'Off'}
            </button>
          </div>
          {showMuscleMass && (
            <WeightRulerPicker
              value={muscleMass}
              onChange={setMuscleMass}
              min={20}
              max={80}
              step={0.1}
              unit="%"
              color="hsl(190, 80%, 50%)"
            />
          )}
        </div>

        {/* More Measurements */}
        <div className="gym-card !p-3 space-y-3" data-tutorial="body-measurements">
          <button
            type="button"
            onClick={() => setMoreOpen(o => !o)}
            className="w-full flex items-center justify-between"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Ruler className="h-4 w-4 text-primary" />
              More Measurements
              {measurements.length > 0 && (
                <span className="text-[10px] text-muted-foreground">({measurements.length})</span>
              )}
            </span>
            {moreOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {moreOpen && (
            <div className="space-y-3">
              {/* Unit toggle */}
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

              {/* List of measurements */}
              {measurements.length > 0 && (
                <div className="space-y-2">
                  {measurements.map(m => {
                    const display = m.valueCm > 0 ? cmToDisplay(m.valueCm, measureUnit).toString() : '';
                    return (
                      <div key={m.key} className="flex items-center gap-2">
                        <span className="flex-1 text-sm">{labelFor(m.key)}</span>
                        <Input
                          type="number"
                          inputMode="decimal"
                          value={display}
                          onChange={(e) => updateMeasurementValue(m.key, e.target.value)}
                          placeholder="0"
                          className="w-20 h-8 bg-secondary border-0 text-sm text-right"
                        />
                        <span className="text-xs text-muted-foreground w-7">{measureUnit}</span>
                        <button
                          onClick={() => removeMeasurement(m.key)}
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

              {/* Add button */}
              <Button
                type="button"
                variant="secondary"
                onClick={openPicker}
                disabled={availableForPicker.length === 0}
                className="w-full h-9 text-sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Measurements
              </Button>
            </div>
          )}
        </div>

        {/* Comment */}
        <div className="gym-card !p-3">
          <Textarea
            placeholder="Comment (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="bg-transparent border-none resize-none text-sm"
            rows={2}
          />
        </div>
      </div>

      {/* Save button */}
      <div className="px-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}>
        <Button onClick={handleSave} className="w-full h-12 text-base font-semibold">
          {editEntry ? 'Update Entry' : 'Save Entry'}
        </Button>
      </div>

      {/* Picker dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Measurements</DialogTitle>
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
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => togglePick(opt.key)}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <Button variant="ghost" onClick={() => setPickerOpen(false)}>Cancel</Button>
            <Button
              onClick={confirmPicker}
              disabled={pickerSelection.size === 0}
            >
              Add{pickerSelection.size > 0 ? ` (${pickerSelection.size})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
