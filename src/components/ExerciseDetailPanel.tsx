import { useState, useMemo } from 'react';
import { format, subDays, isAfter } from 'date-fns';
import { Trophy, History, TrendingUp, Copy, ChevronDown, ChevronUp, Flame, StickyNote } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getExerciseHistory, getPersonalRecord, getSettings } from '@/lib/storage';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';
import { Button } from '@/components/ui/button';
import type { WorkoutSet } from '@/types/fitness';

type Period = '30d' | '90d' | '1y' | 'all';
type GraphMode = 'weight' | 'reps';

interface Props {
  exerciseId: string;
  exerciseName: string;
  weightUnit: 'kg' | 'lb';
  onPrefill: (weightKg: number, reps: number) => void;
  refreshKey?: number;
}

function HistorySessionCard({ session, bestSet, unitLabel, globalWeightUnit, onPrefill }: {
  session: { date: string; sets: WorkoutSet[]; exerciseNotes: string };
  bestSet: WorkoutSet | null;
  unitLabel: string;
  globalWeightUnit: 'kg' | 'lbs';
  onPrefill: (w: number, r: number) => void;
}) {
  const [showNote, setShowNote] = useState(false);
  const [expandedSetNote, setExpandedSetNote] = useState<number | null>(null);
  const hasNote = !!session.exerciseNotes;

  return (
    <div className="rounded-lg bg-secondary/50 px-3 py-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold">{format(new Date(session.date), 'EEE, MMM d, yyyy')}</span>
        <div className="flex items-center gap-1.5">
          {hasNote && (
            <button
              onClick={() => setShowNote(!showNote)}
              className="text-primary transition-colors"
              title="View exercise note"
            >
              <StickyNote className="h-3 w-3" />
            </button>
          )}
          <button
            onClick={() => { if (bestSet) onPrefill(bestSet.weightKg!, bestSet.reps!); }}
            className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Copy best set to today"
            disabled={!bestSet}
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
      </div>
      {showNote && hasNote && (
        <p className="text-[11px] italic text-foreground/80 bg-primary/5 rounded px-2 py-1 mb-1.5">"{session.exerciseNotes}"</p>
      )}
      <div className="space-y-0.5">
        {session.sets.map((s, si) => (
          <div key={si}>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="w-4 text-[10px] text-muted-foreground/60">#{si + 1}</span>
              {s.notes ? (
                <button
                  onClick={() => setExpandedSetNote(expandedSetNote === si ? null : si)}
                  className="text-primary transition-colors"
                  title="View set note"
                >
                  <StickyNote className="h-2.5 w-2.5" />
                </button>
              ) : null}
              <span className="font-medium text-foreground">
                {typeof s.weightKg === 'number' ? `${toDisplayWeight(s.weightKg, globalWeightUnit)}${unitLabel}` : '—'}
                {typeof s.reps === 'number' ? ` × ${s.reps}` : ''}
              </span>
              {typeof s.rpe === 'number' && <span className="text-[10px]">RPE {s.rpe}</span>}
              {s.setTag && s.setTag !== 'N' && (
                <span className={`text-[10px] rounded px-1 ${
                  s.setTag === 'W' ? 'bg-yellow-500/20 text-yellow-500' :
                  s.setTag === 'D' ? 'bg-blue-500/20 text-blue-500' :
                  'bg-red-500/20 text-red-500'
                }`}>{s.setTag === 'W' ? 'Warmup' : s.setTag === 'D' ? 'Drop' : 'Failure'}</span>
              )}
            </div>
            {expandedSetNote === si && s.notes && (
              <p className="text-[10px] italic text-foreground/70 bg-primary/5 rounded px-2 py-0.5 ml-7 mt-0.5">"{s.notes}"</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExerciseDetailPanel({ exerciseId, exerciseName, weightUnit, onPrefill, refreshKey = 0 }: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [period, setPeriod] = useState<Period>('all');
  const [graphMode, setGraphMode] = useState<GraphMode>('weight');
  const [prFlash, setPrFlash] = useState(false);

  const history = useMemo(() => getExerciseHistory(exerciseId), [exerciseId, refreshKey]);
  const pr = useMemo(() => getPersonalRecord(exerciseId), [exerciseId, refreshKey]);

  const recentWeights = useMemo(() => {
    const weights: number[] = [];
    for (const session of history) {
      for (const s of session.sets) {
        if (s.weightKg && !weights.includes(s.weightKg)) {
          weights.push(s.weightKg);
          if (weights.length >= 3) break;
        }
      }
      if (weights.length >= 3) break;
    }
    if (pr && !weights.includes(pr.weight)) weights.push(pr.weight);
    return [...new Set(weights)].sort((a, b) => a - b);
  }, [history, pr]);

  const filteredHistory = useMemo(() => {
    if (period === 'all') return history;
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 365;
    const cutoff = subDays(new Date(), days);
    return history.filter(h => isAfter(new Date(h.date), cutoff));
  }, [history, period]);

  const chartData = useMemo(() => {
    return [...filteredHistory]
      .reverse()
      .map((session) => {
        const weightValues = session.sets
          .map((s) => s.weightKg)
          .filter((value): value is number => typeof value === 'number' && value > 0);

        const repValues = session.sets
          .map((s) => s.reps)
          .filter((value): value is number => typeof value === 'number' && value > 0);

        const maxWeight = weightValues.length > 0 ? Math.max(...weightValues) : null;
        const maxReps = repValues.length > 0 ? Math.max(...repValues) : null;

        if (maxWeight === null && maxReps === null) return null;

        return {
          date: format(new Date(session.date), 'MMM d'),
          weight: maxWeight,
          reps: maxReps,
        };
      })
      .filter((point): point is { date: string; weight: number | null; reps: number | null } => point !== null);
  }, [filteredHistory]);

  const unitLabel = weightUnit === 'lb' ? 'lb' : 'kg';
  const periods: { key: Period; label: string }[] = [
    { key: '30d', label: '30D' },
    { key: '90d', label: '90D' },
    { key: '1y', label: '1Y' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="space-y-2 mb-3">
      {/* Personal Best */}
      {pr && (
        <div className={`rounded-lg bg-gym-pr/10 border border-gym-pr/20 px-3 py-2 transition-all ${prFlash ? 'animate-pulse ring-2 ring-gym-pr' : ''}`}>
          <div className="flex items-center gap-1.5 mb-0.5">
            <Trophy className="h-3.5 w-3.5 text-gym-pr" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-gym-pr">Personal Best</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-display font-bold">{pr.weight}{unitLabel}</span>
            <span className="text-sm text-muted-foreground">× {pr.reps}</span>
            <span className="text-[10px] text-muted-foreground ml-auto">{format(new Date(pr.date), 'MMM d, yyyy')}</span>
          </div>
        </div>
      )}

      {/* Quick-Add Buttons */}
      {recentWeights.length > 0 && (
        <div className="flex items-center gap-1.5">
          <Flame className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground uppercase font-medium">Quick:</span>
          <div className="flex gap-1.5 flex-wrap">
            {recentWeights.map(w => (
              <button
                key={w}
                onClick={() => onPrefill(w, pr?.weight === w ? pr.reps : 8)}
                className="rounded-md bg-secondary hover:bg-secondary/80 px-2.5 py-1 text-xs font-medium transition-colors"
              >
                {w}{unitLabel}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* History Toggle */}
      {history.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <History className="h-3.5 w-3.5" />
            <span className="uppercase text-[10px] font-bold tracking-wider">History</span>
            <span className="text-[10px]">({history.length} sessions)</span>
            <div className="flex-1" />
            {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showHistory && (
            <div className="mt-2 space-y-2 animate-slide-up">
              {/* Graph Toggle + Period Filter */}
              <div className="flex items-center gap-2">
                <Button
                  variant={showGraph ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowGraph(!showGraph)}
                  className="text-[10px] h-6 gap-1"
                >
                  <TrendingUp className="h-3 w-3" /> Graph
                </Button>
                {showGraph && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => setGraphMode('weight')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        graphMode === 'weight' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      Weight
                    </button>
                    <button
                      onClick={() => setGraphMode('reps')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        graphMode === 'reps' ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      Reps
                    </button>
                  </div>
                )}
                <div className="flex gap-1 ml-auto">
                  {periods.map(p => (
                    <button
                      key={p.key}
                      onClick={() => setPeriod(p.key)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        period === p.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Graph */}
              {showGraph && chartData.length > 0 && (
                <div className="rounded-lg bg-secondary/50 p-2">
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={chartData}>
                      <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" width={30} />
                      <Tooltip
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Line
                        type="monotone"
                        dataKey={graphMode}
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                        name={graphMode === 'weight' ? `Weight (${unitLabel})` : 'Reps'}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* History List - Date grouped with sets detail */}
              <div className="max-h-60 overflow-y-auto space-y-2">
                {filteredHistory.map((session, i) => {
                  const bestSet = session.sets
                    .filter(
                      (s) =>
                        typeof s.weightKg === 'number' &&
                        s.weightKg > 0 &&
                        typeof s.reps === 'number' &&
                        s.reps > 0,
                    )
                    .reduce((best, current) => {
                      if (!best) return current;
                      return current.weightKg! > best.weightKg! ? current : best;
                    }, null as WorkoutSet | null);

                  return (
                    <HistorySessionCard
                      key={`${session.date}-${i}`}
                      session={session}
                      bestSet={bestSet}
                      unitLabel={unitLabel}
                      onPrefill={onPrefill}
                    />
                  );
                })}
                {filteredHistory.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No data for this period</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
