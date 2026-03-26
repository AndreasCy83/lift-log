import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface StatsChartProps {
  title: string;
  data: { label: string; value: number }[];
  type: 'line' | 'bar';
  summary?: string;
  valueFormatter?: (v: number) => string;
}

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  fontSize: 12,
};

const TICK_STYLE = { fontSize: 9, fill: 'hsl(var(--muted-foreground))' };

export default function StatsChart({ title, data, type, summary, valueFormatter }: StatsChartProps) {
  if (data.length === 0) {
    return (
      <div className="gym-card">
        <h4 className="font-display text-xs font-semibold mb-2">{title}</h4>
        <p className="text-center text-muted-foreground py-6 text-xs">No workout data for this period</p>
      </div>
    );
  }

  return (
    <div className="gym-card">
      <h4 className="font-display text-xs font-semibold mb-2">{title}</h4>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'line' ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={TICK_STYLE} interval="preserveStartEnd" />
              <YAxis tick={TICK_STYLE} width={40} tickFormatter={valueFormatter} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: number) => [valueFormatter ? valueFormatter(v) : v.toLocaleString(), '']}
              />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', r: 2 }} />
            </LineChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={TICK_STYLE} interval="preserveStartEnd" />
              <YAxis tick={TICK_STYLE} width={40} tickFormatter={valueFormatter} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(v: number) => [valueFormatter ? valueFormatter(v) : v.toLocaleString(), '']}
              />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {summary && (
        <p className="text-[10px] text-muted-foreground mt-1">{summary}</p>
      )}
    </div>
  );
}
