import { useMemo, useState } from 'react';
import { BodyEntry, BodyMeasurementKey, BodyMeasurementUnit } from '@/types/bodyTracker';
import { getSettings, getProfile } from '@/lib/storage';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';
import { subDays } from 'date-fns';
import { ChevronLeft } from 'lucide-react';
import { getHistoricMeasurementKeys, measurementLabel, cmToDisplay } from '@/lib/bodyMeasurements';

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

function calcTrend(entries: BodyEntry[], days: number, getValue: (e: BodyEntry) => number | null | undefined) {
  if (entries.length < 2) return null;
  const cutoff = subDays(new Date(), days);
  const recent = entries.filter(e => {
    const v = getValue(e);
    return v != null && Number.isFinite(v) && new Date(e.date + 'T12:00:00') >= cutoff;
  });
  if (recent.length < 2) return null;
  const oldest = recent[recent.length - 1];
  const newest = recent[0];
  const oldVal = getValue(oldest);
  const newVal = getValue(newest);
  if (oldVal == null || newVal == null) return null;
  return newVal - oldVal;
}

export default function BodyBMITrends({ entries, onBack }: Props) {
  const settings = getSettings();
  const profile = getProfile();
  const wu = settings.weightUnit;
  const unitLabel = weightUnitLabel(wu);
  const heightM = profile ? profile.heightCm / 100 : null;
  const [measurementUnit, setMeasurementUnit] = useState<BodyMeasurementUnit>('cm');

  const latest = entries[0];
  const currentBMI = latest && heightM ? latest.weightKg / (heightM * heightM) : null;
  const bmiCat = currentBMI ? BMI_CATEGORIES.find(c => currentBMI < c.max) ?? BMI_CATEGORIES[3] : null;

  const historicMeasurementKeys = useMemo(() => Array.from(getHistoricMeasurementKeys(entries)), [entries]);

  const TrendCard = ({ label, getValue, unit: u, displayFn, lowerIsBetter }: {
    label: string;
    getValue: (e: BodyEntry) => number | null | undefined;
    unit: string;
    displayFn?: (v: number) => number;
    lowerIsBetter?: boolean;
  }) => (
    <div className="gym-card">
      <h3 className="text-sm font-semibold mb-3">{label}</h3>
      <div className="space-y-2">
        {TREND_PERIODS.map(p => {
          const t = calcTrend(entries, p.days, getValue);
          if (t == null) return (
            <div key={p.label} className="flex justify-between text-xs text-muted-foreground">
              <span>{p.label}</span><span>—</span>
            </div>
          );
          const display = displayFn ? displayFn(t) : t;
          const sign = display > 0 ? '+' : '';
          const positiveIsGood = lowerIsBetter ? display < 0 : display > 0;
          const color = positiveIsGood ? 'text-primary' : 'text-destructive';
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
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
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
        <TrendCard label={`Weight Change (${unitLabel})`} getValue={e => e.weightKg} unit={unitLabel} displayFn={v => toDisplayWeight(v, wu) ?? v} lowerIsBetter />
        <TrendCard label="Body Fat Change (%)" getValue={e => e.bodyFatPercent} unit="%" lowerIsBetter />
        <TrendCard label="Muscle Mass Change (%)" getValue={e => e.muscleMassPercent} unit="%" />

        {historicMeasurementKeys.length > 0 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">More Measurements</p>
            <div className="inline-flex rounded-full border border-border overflow-hidden">
              {(['cm', 'in'] as const).map(u => (
                <button
                  key={u}
                  onClick={() => setMeasurementUnit(u)}
                  className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    measurementUnit === u ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        )}

        {historicMeasurementKeys.map(key => {
          const getValue = (e: BodyEntry) => {
            const m = e.measurements?.find(x => x.key === key);
            return m && Number.isFinite(m.valueCm) && m.valueCm > 0 ? m.valueCm : null;
          };
          return (
            <TrendCard
              key={key}
              label={`${measurementLabel(key)} Change (${measurementUnit})`}
              getValue={getValue}
              unit={measurementUnit}
              displayFn={v => cmToDisplay(v, measurementUnit)}
              lowerIsBetter
            />
          );
        })}
      </div>
    </div>
  );
}
