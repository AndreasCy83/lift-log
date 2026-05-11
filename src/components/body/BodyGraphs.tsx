import { useMemo, useState } from 'react';
import { BodyEntry, BodyMeasurementUnit } from '@/types/bodyTracker';
import { getSettings } from '@/lib/storage';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';
import { format, subDays } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronLeft } from 'lucide-react';
import { getHistoricMeasurementKeys, measurementLabel, cmToDisplay } from '@/lib/bodyMeasurements';

const PERIODS = [
  { label: '7D', days: 7 },
  { label: '15D', days: 15 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: 'ALL', days: 0 },
];

interface Props {
  entries: BodyEntry[];
  onBack: () => void;
}

export default function BodyGraphs({ entries, onBack }: Props) {
  const [period, setPeriod] = useState(30);
  const [measurementUnit, setMeasurementUnit] = useState<BodyMeasurementUnit>('cm');
  const settings = getSettings();
  const wu = settings.weightUnit;
  const unitLabel = weightUnitLabel(wu);

  const filtered = useMemo(() => {
    if (period === 0) return [...entries].reverse();
    const cutoff = subDays(new Date(), period);
    return entries.filter(e => {
      const d = new Date(e.date + 'T12:00:00');
      return d >= cutoff;
    }).reverse();
  }, [entries, period]);

  const weightData = useMemo(() => filtered.map(e => ({
    date: format(new Date(e.date + 'T12:00:00'), 'MMM d'),
    value: toDisplayWeight(e.weightKg, wu) ?? 0,
  })), [filtered, wu]);

  const bfData = useMemo(() => filtered.filter(e => e.bodyFatPercent != null).map(e => ({
    date: format(new Date(e.date + 'T12:00:00'), 'MMM d'),
    value: e.bodyFatPercent!,
  })), [filtered]);

  const mmData = useMemo(() => filtered.filter(e => e.muscleMassPercent != null).map(e => ({
    date: format(new Date(e.date + 'T12:00:00'), 'MMM d'),
    value: e.muscleMassPercent!,
  })), [filtered]);

  const historicMeasurementKeys = useMemo(() => Array.from(getHistoricMeasurementKeys(entries)), [entries]);

  const measurementSeries = useMemo(() => {
    return historicMeasurementKeys.map(key => {
      const data = filtered
        .map(e => {
          const m = e.measurements?.find(x => x.key === key);
          if (!m || !Number.isFinite(m.valueCm) || m.valueCm <= 0) return null;
          return {
            date: format(new Date(e.date + 'T12:00:00'), 'MMM d'),
            value: cmToDisplay(m.valueCm, measurementUnit),
          };
        })
        .filter((d): d is { date: string; value: number } => d !== null);
      return { key, data };
    });
  }, [historicMeasurementKeys, filtered, measurementUnit]);

  const Chart = ({ data, color, title, unit: u }: { data: { date: string; value: number }[]; color: string; title: string; unit: string }) => (
    <div className="gym-card mb-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {data.length < 2 ? (
        <p className="text-xs text-muted-foreground text-center py-6">Not enough data</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
              formatter={(v: number) => [`${v.toFixed(1)} ${u}`, title]}
            />
            <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );

  // Distinct colors for measurement charts
  const MEASUREMENT_COLORS = [
    'hsl(280, 70%, 60%)',
    'hsl(340, 75%, 55%)',
    'hsl(20, 85%, 55%)',
    'hsl(160, 70%, 45%)',
    'hsl(220, 75%, 60%)',
    'hsl(50, 85%, 50%)',
    'hsl(0, 70%, 55%)',
    'hsl(120, 60%, 45%)',
    'hsl(260, 65%, 60%)',
    'hsl(180, 70%, 45%)',
    'hsl(310, 70%, 55%)',
    'hsl(90, 60%, 45%)',
  ];

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <div
        className="sticky top-0 z-20 bg-background flex items-center gap-3 px-4 py-3 border-b border-border"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <button onClick={onBack} className="p-1"><ChevronLeft className="h-5 w-5" /></button>
        <h2 className="font-display text-lg font-semibold">Graphs</h2>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Period pills */}
        <div className="flex gap-1.5 px-4 py-3 overflow-x-auto no-scrollbar">
          {PERIODS.map(p => (
            <button
              key={p.label}
              onClick={() => setPeriod(p.days)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors flex-shrink-0 ${period === p.days ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground'}`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="px-4" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
          <Chart data={weightData} color="hsl(145, 80%, 45%)" title={`Weight (${unitLabel})`} unit={unitLabel} />
          <Chart data={bfData} color="hsl(38, 92%, 50%)" title="Body Fat (%)" unit="%" />
          <Chart data={mmData} color="hsl(190, 80%, 50%)" title="Muscle Mass (%)" unit="%" />

          {historicMeasurementKeys.length > 0 && (
            <div className="flex items-center justify-between mb-3 mt-2">
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

          {measurementSeries.map((s, i) => (
            <Chart
              key={s.key}
              data={s.data}
              color={MEASUREMENT_COLORS[i % MEASUREMENT_COLORS.length]}
              title={`${measurementLabel(s.key)} (${measurementUnit})`}
              unit={measurementUnit}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
