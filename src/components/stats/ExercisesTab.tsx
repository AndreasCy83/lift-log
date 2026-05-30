import { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Dumbbell, MoreVertical, Star, History } from 'lucide-react';
import { format, subMonths, isAfter } from 'date-fns';
import {
  getExercises, getExerciseHistory, getCategories, saveExercises, getSettings,
} from '@/lib/storage';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import ExerciseStatsDialog from '@/components/ExerciseStatsDialog';
import type { WorkoutSet } from '@/types/fitness';
import { useExerciseName } from '@/i18n/exerciseNames';

const GRAPH_OPTIONS = [
  { value: 'e1rm', label: 'Estimated 1RM' },
  { value: 'maxWeight', label: 'Max Weight' },
  { value: 'maxReps', label: 'Max Reps' },
  { value: 'maxVolume', label: 'Max Volume' },
  { value: 'maxWeightForReps', label: 'Max Weight for Reps' },
  { value: 'workoutVolume', label: 'Workout Volume' },
  { value: 'workoutReps', label: 'Workout Reps' },
  { value: 'pr', label: 'Personal Records' },
] as const;

type GraphType = (typeof GRAPH_OPTIONS)[number]['value'];

const PERIODS = [
  { value: '1m', label: '1m', months: 1 },
  { value: '3m', label: '3m', months: 3 },
  { value: '6m', label: '6m', months: 6 },
  { value: '1y', label: '1y', months: 12 },
  { value: 'all', label: 'all', months: 0 },
] as const;

type PeriodValue = (typeof PERIODS)[number]['value'];

const LINE_COLOR = '#38bdf8';
const AREA_FILL = 'rgba(56, 189, 248, 0.15)';
const PR_COLOR = '#facc15';

function computeMetric(
  sets: WorkoutSet[],
  graph: GraphType,
  targetReps: number,
): number | null {
  const validSets = sets.filter(
    s => typeof s.weightKg === 'number' && typeof s.reps === 'number',
  );

  switch (graph) {
    case 'e1rm': {
      let best = 0;
      for (const s of validSets) {
        const w = s.weightKg ?? 0;
        const r = s.reps ?? 0;
        if (w > 0 && r > 0) {
          const e = w * (1 + r / 30);
          if (e > best) best = e;
        }
      }
      return best > 0 ? Math.round(best * 10) / 10 : null;
    }
    case 'maxWeight': {
      let best = 0;
      for (const s of sets) if ((s.weightKg ?? 0) > best) best = s.weightKg!;
      return best > 0 ? best : null;
    }
    case 'maxReps': {
      let best = 0;
      for (const s of sets) if ((s.reps ?? 0) > best) best = s.reps!;
      return best > 0 ? best : null;
    }
    case 'maxVolume': {
      let best = 0;
      for (const s of validSets) {
        const v = (s.weightKg ?? 0) * (s.reps ?? 0);
        if (v > best) best = v;
      }
      return best > 0 ? best : null;
    }
    case 'maxWeightForReps': {
      let best = 0;
      for (const s of validSets) {
        if (s.reps === targetReps && (s.weightKg ?? 0) > best) best = s.weightKg!;
      }
      return best > 0 ? best : null;
    }
    case 'workoutVolume': {
      let total = 0;
      for (const s of validSets) total += (s.weightKg ?? 0) * (s.reps ?? 0);
      return total > 0 ? total : null;
    }
    case 'workoutReps': {
      let total = 0;
      for (const s of sets) total += s.reps ?? 0;
      return total > 0 ? total : null;
    }
    case 'pr':
    default:
      return null;
  }
}

export default function ExercisesTab() {
  const tExName = useExerciseName();
  const exercises = useMemo(() => {
    const all = getExercises();
    const withHistory = all.filter(e => getExerciseHistory(e.id).length > 0);
    return withHistory.sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const [selectedExId, setSelectedExId] = useState<string>(exercises[0]?.id ?? '');
  const [graph, setGraph] = useState<GraphType>('e1rm');
  const [period, setPeriod] = useState<PeriodValue>('6m');
  const [targetReps, setTargetReps] = useState(1);
  const [showHistory, setShowHistory] = useState(false);

  const selectedEx = exercises.find(e => e.id === selectedExId);

  const chartData = useMemo(() => {
    if (!selectedExId) return [];
    const history = getExerciseHistory(selectedExId);
    const periodCfg = PERIODS.find(p => p.value === period)!;
    const cutoff = periodCfg.months > 0 ? subMonths(new Date(), periodCfg.months) : null;

    const filtered = cutoff
      ? history.filter(h => isAfter(new Date(h.date), cutoff))
      : history;

    const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date));

    if (graph === 'pr') {
      let bestSoFar = 0;
      const points: { date: string; label: string; value: number; sets: number; reps: number; isPR: boolean }[] = [];
      for (const session of sorted) {
        let sessionBest = 0;
        let totalReps = 0;
        for (const s of session.sets) {
          const w = s.weightKg ?? 0;
          const r = s.reps ?? 0;
          totalReps += r;
          if (w > 0 && r > 0) {
            const e = w * (1 + r / 30);
            if (e > sessionBest) sessionBest = e;
          }
        }
        if (sessionBest > bestSoFar) {
          bestSoFar = sessionBest;
          points.push({
            date: session.date,
            label: format(new Date(session.date), 'd MMM yyyy'),
            value: Math.round(sessionBest * 10) / 10,
            sets: session.sets.length,
            reps: totalReps,
            isPR: true,
          });
        }
      }
      return points;
    }

    return sorted
      .map(session => {
        const val = computeMetric(session.sets, graph, targetReps);
        if (val === null) return null;
        let totalReps = 0;
        for (const s of session.sets) totalReps += s.reps ?? 0;
        return {
          date: session.date,
          label: format(new Date(session.date), 'd MMM yyyy'),
          value: val,
          sets: session.sets.length,
          reps: totalReps,
          isPR: false,
        };
      })
      .filter(Boolean) as { date: string; label: string; value: number; sets: number; reps: number; isPR: boolean }[];
  }, [selectedExId, graph, period, targetReps]);

  const graphLabel = GRAPH_OPTIONS.find(g => g.value === graph)?.label ?? '';
  const globalWeightUnit = getSettings().weightUnit;
  const unit = weightUnitLabel(globalWeightUnit);

  const handleToggleFavorite = () => {
    if (!selectedEx) return;
    const all = getExercises();
    const idx = all.findIndex(e => e.id === selectedEx.id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], isFavorite: !all[idx].isFavorite };
      saveExercises(all);
    }
  };

  const tickStyle = { fontSize: 9, fill: 'hsl(var(--muted-foreground))' };

  if (exercises.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
        <Dumbbell className="h-10 w-10" />
        <p className="text-sm">No exercise data yet. Complete some workouts first!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="gym-card space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Exercise:</label>
            <Select value={selectedExId} onValueChange={setSelectedExId}>
              <SelectTrigger className="mt-1 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {exercises.map(ex => (
                  <SelectItem key={ex.id} value={ex.id}>{tExName(ex)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="mt-5 p-1.5 rounded-md hover:bg-secondary">
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleToggleFavorite}>
                <Star className="h-4 w-4 mr-2" />
                {selectedEx?.isFavorite ? 'Remove from Favourites' : 'Add to Favourites'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowHistory(true)}>
                <History className="h-4 w-4 mr-2" />
                View Exercise History
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div>
          <label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Graph:</label>
          <Select value={graph} onValueChange={v => setGraph(v as GraphType)}>
            <SelectTrigger className="mt-1 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRAPH_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {graph === 'maxWeightForReps' && (
          <div>
            <label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">For Reps:</label>
            <Input
              type="number"
              min={1}
              value={targetReps}
              onChange={e => setTargetReps(Math.max(1, Number(e.target.value) || 1))}
              className="mt-1 h-9 w-24 text-sm"
            />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              period === p.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="gym-card">
        <h4 className="font-display text-xs font-semibold mb-2">
          {graphLabel}{graph === 'maxWeightForReps' ? ` (${targetReps} rep${targetReps > 1 ? 's' : ''})` : ''}
        </h4>

        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <Dumbbell className="h-8 w-8" />
            <p className="text-xs">No data for {selectedEx?.name ?? 'this exercise'} in this period</p>
          </div>
        ) : (
          <>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={graph === 'pr' ? PR_COLOR : LINE_COLOR} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={graph === 'pr' ? PR_COLOR : LINE_COLOR} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tick={tickStyle}
                    interval={Math.max(0, Math.floor(chartData.length / 4) - 1)}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={tickStyle}
                    width={50}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    tickLine={false}
                    domain={['auto', 'auto']}
                    tickFormatter={v => v.toLocaleString()}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [`${(toDisplayWeight(v, globalWeightUnit) ?? v).toLocaleString()} ${unit}`, graphLabel]}
                    labelFormatter={(label: string) => `Date: ${label}`}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-border bg-card p-2.5 text-xs space-y-0.5 shadow-lg">
                          <div className="text-muted-foreground">Date: {d.label}</div>
                          <div className="font-semibold text-foreground">{graphLabel}: {(toDisplayWeight(d.value, globalWeightUnit) ?? d.value).toLocaleString()} {unit}</div>
                          <div className="text-muted-foreground">Sets: {d.sets} · Reps: {d.reps}</div>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type={graph === 'pr' ? 'stepAfter' : 'monotone'}
                    dataKey="value"
                    stroke={graph === 'pr' ? PR_COLOR : LINE_COLOR}
                    strokeWidth={2}
                    fill="url(#areaGrad)"
                    dot={{
                      fill: graph === 'pr' ? PR_COLOR : LINE_COLOR,
                      stroke: 'hsl(var(--card))',
                      strokeWidth: 2,
                      r: 4,
                    }}
                    activeDot={{
                      fill: 'white',
                      stroke: graph === 'pr' ? PR_COLOR : LINE_COLOR,
                      strokeWidth: 2,
                      r: 6,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Tap a point on the graph to view more details.
            </p>
          </>
        )}
      </div>

      {selectedEx && (
        <ExerciseStatsDialog
          open={showHistory}
          onOpenChange={setShowHistory}
          exerciseId={selectedEx.id}
          exerciseName={tExName(selectedEx)}
          weightUnit={selectedEx.weightUnit}
        />
      )}
    </div>
  );
}
