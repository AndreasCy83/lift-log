import { useMemo, useState } from 'react';
import { BodyEntry } from '@/types/bodyTracker';
import { getSettings } from '@/lib/storage';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';
import { format, parseISO, subDays, subMonths, subYears } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChevronLeft } from 'lucide-react';

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

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <button onClick={onBack} className="p-1"><ChevronLeft className="h-5 w-5" /></button>
        <h2 className="font-display text-lg font-semibold">Graphs</h2>
      </div>

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

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <Chart data={weightData} color="hsl(145, 80%, 45%)" title={`Weight (${unitLabel})`} unit={unitLabel} />
        <Chart data={bfData} color="hsl(38, 92%, 50%)" title="Body Fat (%)" unit="%" />
        <Chart data={mmData} color="hsl(190, 80%, 50%)" title="Muscle Mass (%)" unit="%" />
      </div>
    </div>
  );
}
