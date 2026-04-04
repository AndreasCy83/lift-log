import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import WeightRulerPicker from './WeightRulerPicker';
import { addBodyEntry, updateBodyEntry } from '@/lib/bodyTrackerStorage';
import { getSettings, getProfile } from '@/lib/storage';
import { toDisplayWeight, toStorageKg, weightUnitLabel } from '@/lib/units';
import { BodyEntry } from '@/types/bodyTracker';
import { format } from 'date-fns';

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

  const [weight, setWeight] = useState(defaultWeight);
  const [bodyFat, setBodyFat] = useState(editEntry?.bodyFatPercent ?? 0);
  const [muscleMass, setMuscleMass] = useState(editEntry?.muscleMassPercent ?? 0);
  const [note, setNote] = useState(editEntry?.note ?? '');
  const [showBodyFat, setShowBodyFat] = useState(!!(editEntry?.bodyFatPercent));
  const [showMuscleMass, setShowMuscleMass] = useState(!!(editEntry?.muscleMassPercent));

  if (!open) return null;

  const handleSave = () => {
    const now = new Date();
    const weightKg = toStorageKg(weight, wu) ?? weight;

    if (editEntry) {
      updateBodyEntry({
        ...editEntry,
        weightKg,
        bodyFatPercent: showBodyFat && bodyFat > 0 ? bodyFat : null,
        muscleMassPercent: showMuscleMass && muscleMass > 0 ? muscleMass : null,
        note,
      });
    } else {
      addBodyEntry({
        date: format(now, 'yyyy-MM-dd'),
        time: format(now, 'HH:mm'),
        weightKg,
        bodyFatPercent: showBodyFat && bodyFat > 0 ? bodyFat : null,
        muscleMassPercent: showMuscleMass && muscleMass > 0 ? muscleMass : null,
        note,
      });
    }
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={onClose} className="p-1"><X className="h-5 w-5 text-muted-foreground" /></button>
        <h2 className="font-display text-lg font-semibold">{editEntry ? 'Edit Entry' : 'New Body Entry'}</h2>
        <div className="w-7" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)' }}>
        {/* Date/time display */}
        <div className="text-center">
          <div className="inline-block rounded-full bg-primary/20 px-4 py-1.5">
            <span className="text-sm font-medium text-primary">
              {format(new Date(), 'EEE, d MMM yyyy')} — {format(new Date(), 'HH:mm')}
            </span>
          </div>
        </div>

        {/* Weight ruler */}
        <div className="gym-card">
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

        {/* Body fat toggle + ruler */}
        <div className="gym-card">
          <div className="flex items-center justify-between mb-3">
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

        {/* Muscle mass toggle + ruler */}
        <div className="gym-card">
          <div className="flex items-center justify-between mb-3">
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

        {/* Comment */}
        <div className="gym-card">
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
      <div className="px-4 pb-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
        <Button onClick={handleSave} className="w-full h-12 text-base font-semibold">
          {editEntry ? 'Update Entry' : 'Save Entry'}
        </Button>
      </div>
    </div>
  );
}
