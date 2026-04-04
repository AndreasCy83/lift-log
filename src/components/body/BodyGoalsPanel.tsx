import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getBodyGoals, saveBodyGoals } from '@/lib/bodyTrackerStorage';
import { getSettings } from '@/lib/storage';
import { toDisplayWeight, toStorageKg, weightUnitLabel } from '@/lib/units';
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

  const [targetWeight, setTargetWeight] = useState(
    goals.targetWeightKg != null ? String(toDisplayWeight(goals.targetWeightKg, wu) ?? '') : ''
  );
  const [targetBf, setTargetBf] = useState(goals.targetBodyFatPercent != null ? String(goals.targetBodyFatPercent) : '');
  const [targetMm, setTargetMm] = useState(goals.targetMuscleMassPercent != null ? String(goals.targetMuscleMassPercent) : '');

  const handleSave = () => {
    const tw = targetWeight ? parseFloat(targetWeight) : null;
    saveBodyGoals({
      targetWeightKg: tw != null ? (toStorageKg(tw, wu) ?? tw) : null,
      targetBodyFatPercent: targetBf ? parseFloat(targetBf) : null,
      targetMuscleMassPercent: targetMm ? parseFloat(targetMm) : null,
    });
    toast.success('Goals saved');
    onSaved();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={onBack} className="p-1"><ChevronLeft className="h-5 w-5" /></button>
        <h2 className="font-display text-lg font-semibold">Body Goals</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
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
      </div>

      <div className="px-4 pb-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
        <Button onClick={handleSave} className="w-full h-12 text-base font-semibold">Save Goals</Button>
      </div>
    </div>
  );
}
