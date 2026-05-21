import { useMemo, useState } from 'react';
import { BodyEntry, BodyMeasurementUnit } from '@/types/bodyTracker';
import { getSettings } from '@/lib/storage';
import { getBodyGoals } from '@/lib/bodyTrackerStorage';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';
import { format, subDays } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';
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

interface ChartPoint {
  label: string;
  dateKey: string;
  actual: number | null;
  goal: number | null;
}

/**
 * Combine actual measurement series with an optional goal trajectory.
 * Goal line: solid anchor on last actual point -> dotted line to (targetDate, targetValue).
 */
function buildSeries(
  actuals: { date: string; value: number }[], // ASC by date
  targetValue: number | null | undefined,
  targetDateStr: string | null | undefined,
): { data: ChartPoint[]; targetLabel: string | null; targetValue: number | null } {
  const base: ChartPoint[] = actuals.map(a => ({
    label: format(new Date(a.date + 'T12:00:00'), 'MMM d'),
    dateKey: a.date,
    actual: a.value,
    goal: null,
  }));

  if (!actuals.length || targetValue == null || !Number.isFinite(targetValue) || !targetDateStr) {
    return { data: base, targetLabel: null, targetValue: null };
  }

  const last = actuals[actuals.length - 1];
  const lastDate = new Date(last.date + 'T12:00:00');
  const targetDate = new Date(targetDateStr + 'T12:00:00');
  if (!Number.isFinite(targetDate.getTime()) || targetDate <= lastDate) {
    // Expired / already past — skip goal line, no marker
    return { data: base, targetLabel: null, targetValue: null };
  }

  // Anchor goal line to the last actual point
  base[base.length - 1] = { ...base[base.length - 1], goal: last.value };

  const targetLabel = format(targetDate, 'MMM d');
  base.push({
    label: targetLabel,
    dateKey: targetDateStr,
    actual: null,
    goal: targetValue,
  });

  return { data: base, targetLabel, targetValue };
}

export default function BodyGraphs({ entries, onBack }: Props) {
  const [period, setPeriod] = useState(30);
  const [measurementUnit, setMeasurementUnit] = useState<BodyMeasurementUnit>('cm');
  const settings = getSettings();
  const goals = useMemo(() => getBodyGoals(), []);
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

  const weightSeries = useMemo(() => {
    const actuals = filtered.map(e => ({ date: e.date, value: toDisplayWeight(e.weightKg, wu) ?? 0 }));
    const target = goals.targetWeightKg != null ? (toDisplayWeight(goals.targetWeightKg, wu) ?? null) : null;
    return buildSeries(actuals, target, goals.targetWeightDate);
  }, [filtered, wu, goals]);

  const bfSeries = useMemo(() => {
    const actuals = filtered
      .filter(e => e.bodyFatPercent != null)
      .map(e => ({ date: e.date, value: e.bodyFatPercent! }));
    return buildSeries(actuals, goals.targetBodyFatPercent, goals.targetBodyFatDate);
  }, [filtered, goals]);

  const mmSeries = useMemo(() => {
    const actuals = filtered
      .filter(e => e.muscleMassPercent != null)
      .map(e => ({ date: e.date, value: e.muscleMassPercent! }));
    return buildSeries(actuals, goals.targetMuscleMassPercent, goals.targetMuscleMassDate);
  }, [filtered, goals]);

  const historicMeasurementKeys = useMemo(() => Array.from(getHistoricMeasurementKeys(entries)), [entries]);

  const measurementSeries = useMemo(() => {
    return historicMeasurementKeys.map(key => {
      const actuals = filtered
        .map(e => {
          const m = e.measurements?.find(x => x.key === key);
          if (!m || !Number.isFinite(m.valueCm) || m.valueCm <= 0) return null;
          return { date: e.date, value: cmToDisplay(m.valueCm, measurementUnit) };
        })
        .filter((d): d is { date: string; value: number } => d !== null);
      const goal = goals.measurementGoals?.find(g => g.key === key);
      const targetVal = goal && goal.targetCm > 0
        ? cmToDisplay(goal.targetCm, measurementUnit)
        : null;
      return { key, ...buildSeries(actuals, targetVal, goal?.targetDate) };
    });
  }, [historicMeasurementKeys, filtered, measurementUnit, goals]);

  const Chart = ({
    series,
    color,
    title,
    unit: u,
  }: {
    series: { data: ChartPoint[]; targetLabel: string | null; targetValue: number | null };
    color: string;
    title: string;
    unit: string;
  }) => {
    const { data, targetLabel, targetValue } = series;
    const actualCount = data.filter(d => d.actual != null).length;
    return (
      <div className="gym-card mb-4">
        <h3 className="text-sm font-semibold mb-3">{title}</h3>
        {actualCount < 2 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Not enough data</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, name: string) => [
                  `${v.toFixed(1)} ${u}`,
                  name === 'goal' ? 'Goal' : title,
                ]}
              />
              <Line
                type="monotone"
                dataKey="actual"
                name="actual"
                stroke={color}
                strokeWidth={2}
                dot={{ r: 3, fill: color }}
                activeDot={{ r: 5 }}
                connectNulls={false}
                isAnimationActive={false}
              />
              {targetLabel && targetValue != null && (
                <Line
                  type="monotone"
                  dataKey="goal"
                  name="goal"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls
                  isAnimationActive={false}
                />
              )}
              {targetLabel && targetValue != null && (
                <ReferenceDot
                  x={targetLabel}
                  y={targetValue}
                  r={5}
                  fill="hsl(var(--background))"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  ifOverflow="extendDomain"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
        {targetLabel && targetValue != null && actualCount >= 2 && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Goal: {targetValue.toFixed(1)} {u} by {targetLabel}
          </p>
        )}
      </div>
    );
  };

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
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex w-max gap-1.5 px-4 py-3 pr-8">
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
        </div>

        <div className="px-4" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
          <Chart series={weightSeries} color="hsl(145, 80%, 45%)" title={`Weight (${unitLabel})`} unit={unitLabel} />
          <Chart series={bfSeries} color="hsl(38, 92%, 50%)" title="Body Fat (%)" unit="%" />
          <Chart series={mmSeries} color="hsl(190, 80%, 50%)" title="Muscle Mass (%)" unit="%" />

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
              series={{ data: s.data, targetLabel: s.targetLabel, targetValue: s.targetValue }}
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
