import { useMemo } from 'react';
import { BodyEntry } from '@/types/bodyTracker';
import { getSettings, getProfile } from '@/lib/storage';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';
import { subDays } from 'date-fns';
import { ChevronLeft } from 'lucide-react';

const BMI_CATEGORIES = [
  { max: 18.5, label: 'Underweight', color: 'hsl(200, 80%, 55%)' },
  { max: 25, label: 'Normal', color: 'hsl(145, 80%, 45%)' },
  { max: 30, label: 'Overweight', color: 'hsl(38, 92%, 50%)' },
  { max: Infinity, label: 'Obese', color: 'hsl(0, 72%, 51%)' },
];

const TREND_PERIODS = [
  { label: '7D', days: 7 },
  { label: '15D', days: 15 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
];

interface Props {
  entries: BodyEntry[];
  onBack: () => void;
}

function calcTrend(entries: BodyEntry[], days: number, field: 'weightKg' | 'bodyFatPercent' | 'muscleMassPercent') {
  if (entries.length < 2) return null;
  const cutoff = subDays(new Date(), days);
  const recent = entries.filter(e => new Date(e.date + 'T12:00:00') >= cutoff);
  if (recent.length < 1) return null;
  const oldest = recent[recent.length - 1];
  const newest = recent[0];
  const oldVal = oldest[field];
  const newVal = newest[field];
  if (oldVal == null || newVal == null) return null;
  return newVal - oldVal;
}

export default function BodyBMITrends({ entries, onBack }: Props) {
  const settings = getSettings();
  const profile = getProfile();
  const wu = settings.weightUnit;
  const unitLabel = weightUnitLabel(wu);
  const heightM = profile ? profile.heightCm / 100 : null;

  const latest = entries[0];
  const currentBMI = latest && heightM ? latest.weightKg / (heightM * heightM) : null;
  const bmiCat = currentBMI ? BMI_CATEGORIES.find(c => currentBMI < c.max) ?? BMI_CATEGORIES[3] : null;

  const TrendCard = ({ label, field, unit: u, displayFn }: { label: string; field: 'weightKg' | 'bodyFatPercent' | 'muscleMassPercent'; unit: string; displayFn?: (v: number) => number }) => (
    <div className="gym-card">
      <h3 className="text-sm font-semibold mb-3">{label}</h3>
      <div className="space-y-2">
        {TREND_PERIODS.map(p => {
          const t = calcTrend(entries, p.days, field);
          if (t == null) return (
            <div key={p.label} className="flex justify-between text-xs text-muted-foreground">
              <span>{p.label}</span><span>—</span>
            </div>
          );
          const display = displayFn ? displayFn(t) : t;
          const sign = display > 0 ? '+' : '';
          const color = field === 'weightKg'
            ? (display < 0 ? 'text-primary' : 'text-destructive')
            : field === 'bodyFatPercent'
              ? (display < 0 ? 'text-primary' : 'text-destructive')
              : (display > 0 ? 'text-primary' : 'text-destructive');
          return (
            <div key={p.label} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{p.label}</span>
              <span className={`font-medium ${color}`}>{sign}{display.toFixed(1)} {u}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={onBack} className="p-1"><ChevronLeft className="h-5 w-5" /></button>
        <h2 className="font-display text-lg font-semibold">BMI & Trends</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {/* BMI */}
        <div className="gym-card text-center">
          {currentBMI && bmiCat ? (
            <>
              <p className="text-xs text-muted-foreground mb-1">Current BMI</p>
              <p className="text-4xl font-bold font-display" style={{ color: bmiCat.color }}>{currentBMI.toFixed(1)}</p>
              <p className="text-sm font-medium mt-1" style={{ color: bmiCat.color }}>{bmiCat.label}</p>
              {!heightM && <p className="text-xs text-muted-foreground mt-2">Set your height in Settings for accurate BMI</p>}
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-4">Add a body entry and set your height in Settings to see BMI</p>
          )}
        </div>

        {/* Trend cards */}
        <TrendCard label={`Weight Change (${unitLabel})`} field="weightKg" unit={unitLabel} displayFn={v => toDisplayWeight(v, wu) ?? v} />
        <TrendCard label="Body Fat Change (%)" field="bodyFatPercent" unit="%" />
        <TrendCard label="Muscle Mass Change (%)" field="muscleMassPercent" unit="%" />
      </div>
    </div>
  );
}
