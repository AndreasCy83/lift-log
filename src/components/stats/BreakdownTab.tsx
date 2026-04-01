import { useState, useMemo, useCallback } from 'react';
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, subWeeks, addWeeks, subMonths, addMonths,
  subYears, addYears, isWithinInterval, parseISO
} from 'date-fns';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { getWorkouts, getWorkoutExercises, getWorkoutSets, getExercises, getCategories, getSettings } from '@/lib/storage';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type BreakdownMetric =
  | 'sets-category' | 'reps-category' | 'workouts-category' | 'volume-category'
  | 'sets-exercise' | 'reps-exercise' | 'workouts-exercise' | 'volume-exercise';

type PeriodType = 'workout' | 'week' | 'month' | 'year' | 'all' | 'custom';

const BREAKDOWN_OPTIONS: { value: BreakdownMetric; label: string; group: string }[] = [
  { value: 'sets-category', label: 'Number of Sets (by Category)', group: 'Category Breakdown' },
  { value: 'reps-category', label: 'Number of Reps (by Category)', group: 'Category Breakdown' },
  { value: 'workouts-category', label: 'Number of Workouts (by Category)', group: 'Category Breakdown' },
  { value: 'volume-category', label: 'Training Volume (by Category)', group: 'Category Breakdown' },
  { value: 'sets-exercise', label: 'Number of Sets (by Exercise)', group: 'Exercise Breakdown' },
  { value: 'reps-exercise', label: 'Number of Reps (by Exercise)', group: 'Exercise Breakdown' },
  { value: 'workouts-exercise', label: 'Number of Workouts (by Exercise)', group: 'Exercise Breakdown' },
  { value: 'volume-exercise', label: 'Training Volume (by Exercise)', group: 'Exercise Breakdown' },
];

const SLICE_COLORS = [
  'hsl(348, 83%, 55%)',   // Red
  'hsl(217, 91%, 60%)',   // Blue
  'hsl(174, 72%, 46%)',   // Teal
  'hsl(271, 91%, 65%)',   // Purple
  'hsl(25, 95%, 53%)',    // Orange
  'hsl(142, 71%, 45%)',   // Green
  'hsl(215, 20%, 55%)',   // Slate
  'hsl(47, 96%, 53%)',    // Yellow
  'hsl(330, 81%, 60%)',   // Pink
  'hsl(189, 94%, 43%)',   // Cyan
  'hsl(15, 80%, 50%)',    // Burnt Orange
  'hsl(260, 60%, 55%)',   // Indigo
];

function hasMeaningfulData(s: { weightKg: number | null; reps: number | null; distanceKm: number | null; durationMinutes: number | null }) {
  return [s.weightKg, s.reps, s.distanceKm, s.durationMinutes].some(v => typeof v === 'number' && v > 0);
}

function formatUnit(metric: BreakdownMetric, value: number, wuLabel: string): string {
  const m = metric.split('-')[0];
  if (m === 'sets') return `${value} sets`;
  if (m === 'reps') return `${value} reps`;
  if (m === 'workouts') return `${value} workouts`;
  if (m === 'volume') return `${value.toLocaleString()} ${wuLabel}`;
  return `${value}`;
}

export default function BreakdownTab() {
  const exercises = useMemo(() => getExercises(), []);
  const categories = useMemo(() => getCategories(), []);
  const workouts = useMemo(() => getWorkouts(), []);
  const allWEs = useMemo(() => getWorkoutExercises(), []);
  const allSets = useMemo(() => getWorkoutSets(), []);
  const globalWeightUnit = getSettings().weightUnit;
  const wuLabel = weightUnitLabel(globalWeightUnit);

  const [breakdown, setBreakdown] = useState<BreakdownMetric>('sets-category');
  const [periodType, setPeriodType] = useState<PeriodType>('week');
  const [refDate, setRefDate] = useState(new Date());
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [workoutDate, setWorkoutDate] = useState<Date | undefined>(undefined);

  const isGroupByCategory = breakdown.endsWith('-category');
  const metricType = breakdown.split('-')[0] as 'sets' | 'reps' | 'workouts' | 'volume';

  const dateRange = useMemo<{ start: Date; end: Date } | null>(() => {
    if (periodType === 'all') return null;
    if (periodType === 'workout') {
      if (!workoutDate) return null;
      const d = workoutDate;
      return { start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0), end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59) };
    }
    if (periodType === 'custom') {
      if (!customFrom || !customTo) return null;
      return { start: customFrom, end: customTo };
    }
    if (periodType === 'week') return { start: startOfWeek(refDate, { weekStartsOn: 1 }), end: endOfWeek(refDate, { weekStartsOn: 1 }) };
    if (periodType === 'month') return { start: startOfMonth(refDate), end: endOfMonth(refDate) };
    if (periodType === 'year') return { start: startOfYear(refDate), end: endOfYear(refDate) };
    return null;
  }, [periodType, refDate, workoutDate, customFrom, customTo]);

  const dateLabel = useMemo(() => {
    if (periodType === 'all') return 'All Time';
    if (periodType === 'workout') return workoutDate ? format(workoutDate, 'dd MMM yyyy') : 'Select date';
    if (periodType === 'custom') {
      if (customFrom && customTo) return `${format(customFrom, 'dd MMM yyyy')} – ${format(customTo, 'dd MMM yyyy')}`;
      return 'Select range';
    }
    if (!dateRange) return '';
    if (periodType === 'week') return `${format(dateRange.start, 'dd MMM yyyy')} – ${format(dateRange.end, 'dd MMM yyyy')}`;
    if (periodType === 'month') return format(refDate, 'MMMM yyyy');
    if (periodType === 'year') return format(refDate, 'yyyy');
    return '';
  }, [periodType, dateRange, refDate, workoutDate, customFrom, customTo]);

  const navigateDate = useCallback((dir: -1 | 1) => {
    setRefDate(d => {
      if (periodType === 'week') return dir === -1 ? subWeeks(d, 1) : addWeeks(d, 1);
      if (periodType === 'month') return dir === -1 ? subMonths(d, 1) : addMonths(d, 1);
      if (periodType === 'year') return dir === -1 ? subYears(d, 1) : addYears(d, 1);
      return d;
    });
  }, [periodType]);

  const filteredWorkouts = useMemo(() => {
    if (!dateRange) return workouts;
    return workouts.filter(w => {
      const parts = w.date.split('T')[0].split('-');
      const d = new Date(
        parseInt(parts[0]),
        parseInt(parts[1]) - 1,
        parseInt(parts[2]),
        12, 0, 0
      );
      return isWithinInterval(d, { start: dateRange.start, end: dateRange.end });
    });
  }, [workouts, dateRange]);

  const summaryStats = useMemo(() => {
    let totalSets = 0, totalReps = 0, totalVolume = 0;
    for (const w of filteredWorkouts) {
      const wes = allWEs.filter(we => we.workoutId === w.id);
      for (const we of wes) {
        const sets = allSets.filter(s => s.workoutExerciseId === we.id && !s.isWarmup && hasMeaningfulData(s));
        totalSets += sets.length;
        for (const s of sets) {
          totalReps += s.reps ?? 0;
          totalVolume += (s.weightKg ?? 0) * (s.reps ?? 0);
        }
      }
    }
    return { workouts: filteredWorkouts.length, sets: totalSets, reps: totalReps, volume: Math.round(totalVolume) };
  }, [filteredWorkouts, allWEs, allSets]);

  const breakdownData = useMemo(() => {
    const map = new Map<string, { id: string; name: string; value: number; workoutIds: Set<string> }>();

    for (const w of filteredWorkouts) {
      const wes = allWEs.filter(we => we.workoutId === w.id);
      for (const we of wes) {
        const ex = exercises.find(e => e.id === we.exerciseId);
        if (!ex) continue;

        const key = isGroupByCategory ? ex.categoryId : ex.id;
        const name = isGroupByCategory
          ? (categories.find(c => c.id === ex.categoryId)?.name ?? 'Unknown')
          : ex.name;

        if (!map.has(key)) map.set(key, { id: key, name, value: 0, workoutIds: new Set() });
        const entry = map.get(key)!;
        entry.workoutIds.add(w.id);

        const sets = allSets.filter(s => s.workoutExerciseId === we.id && !s.isWarmup && hasMeaningfulData(s));

        if (metricType === 'sets') entry.value += sets.length;
        else if (metricType === 'reps') {
          for (const s of sets) entry.value += s.reps ?? 0;
        } else if (metricType === 'volume') {
          for (const s of sets) entry.value += (s.weightKg ?? 0) * (s.reps ?? 0);
        }
      }
    }

    if (metricType === 'workouts') {
      for (const entry of map.values()) {
        entry.value = entry.workoutIds.size;
      }
    }

    return Array.from(map.values())
      .map(e => ({ ...e, value: Math.round(e.value) }))
      .filter(e => e.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [filteredWorkouts, allWEs, allSets, exercises, categories, isGroupByCategory, metricType]);

  const total = useMemo(() => breakdownData.reduce((s, d) => s + d.value, 0), [breakdownData]);

  const safeIdx = breakdownData.length === 0 ? -1 : Math.min(highlightIdx, breakdownData.length - 1);

  const cycleHighlight = (dir: 1 | -1) => {
    if (breakdownData.length === 0) return;
    setHighlightIdx(i => {
      const next = i + dir;
      if (next < 0) return breakdownData.length - 1;
      if (next >= breakdownData.length) return 0;
      return next;
    });
  };

  const showNav = ['week', 'month', 'year'].includes(periodType);

  return (
    <div className="space-y-4 pb-4">
      <div className="gym-card space-y-3">
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Breakdown</label>
          <Select value={breakdown} onValueChange={v => { setBreakdown(v as BreakdownMetric); setHighlightIdx(0); }}>
            <SelectTrigger className="mt-1 h-9 text-xs bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Category Breakdown</SelectLabel>
                {BREAKDOWN_OPTIONS.filter(o => o.group === 'Category Breakdown').map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Exercise Breakdown</SelectLabel>
                {BREAKDOWN_OPTIONS.filter(o => o.group === 'Exercise Breakdown').map(o => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Period</label>
          <Select value={periodType} onValueChange={v => { setPeriodType(v as PeriodType); setHighlightIdx(0); }}>
            <SelectTrigger className="mt-1 h-9 text-xs bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['workout', 'week', 'month', 'year', 'all', 'custom'] as PeriodType[]).map(p => (
                <SelectItem key={p} value={p} className="text-xs capitalize">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Date</label>
          {periodType === 'all' ? (
            <div className="mt-1 h-9 flex items-center rounded-md bg-secondary px-3 text-xs text-foreground">All Time</div>
          ) : periodType === 'workout' ? (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("mt-1 w-full justify-start text-xs h-9 bg-secondary border-border", !workoutDate && "text-muted-foreground")}>
                  {workoutDate ? format(workoutDate, 'dd MMM yyyy') : 'Select workout date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={workoutDate} onSelect={setWorkoutDate} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          ) : periodType === 'custom' ? (
            <div className="mt-1 flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("flex-1 justify-start text-xs h-9 bg-secondary border-border", !customFrom && "text-muted-foreground")}>
                    {customFrom ? format(customFrom, 'dd MMM yy') : 'From'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("flex-1 justify-start text-xs h-9 bg-secondary border-border", !customTo && "text-muted-foreground")}>
                    {customTo ? format(customTo, 'dd MMM yy') : 'To'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customTo} onSelect={setCustomTo} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-1">
              {showNav && (
                <button onClick={() => navigateDate(-1)} className="h-9 w-9 flex items-center justify-center rounded-md bg-secondary text-muted-foreground hover:text-foreground">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <div className="flex-1 h-9 flex items-center justify-center rounded-md bg-secondary text-xs text-foreground">{dateLabel}</div>
              {showNav && (
                <button onClick={() => navigateDate(1)} className="h-9 w-9 flex items-center justify-center rounded-md bg-secondary text-muted-foreground hover:text-foreground">
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="gym-card relative">
        {breakdownData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <p className="text-sm">No data for this period</p>
          </div>
        ) : (
          <div className="relative flex items-center justify-center" style={{ minHeight: 240 }}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={breakdownData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={1}
                  strokeWidth={0}
                >
                  {breakdownData.map((entry, i) => (
                    <Cell
                      key={entry.id}
                      fill={SLICE_COLORS[i % SLICE_COLORS.length]}
                      opacity={safeIdx === i ? 1 : 0.5}
                      onClick={() => setHighlightIdx(i)}
                      style={{ cursor: 'pointer', transform: safeIdx === i ? 'scale(1.04)' : 'scale(1)', transformOrigin: 'center' }}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>

            {safeIdx >= 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] text-muted-foreground max-w-[100px] text-center leading-tight">{breakdownData[safeIdx].name}</span>
                <span className="text-lg font-bold text-foreground">{total > 0 ? ((breakdownData[safeIdx].value / total) * 100).toFixed(1) : 0}%</span>
              </div>
            )}

            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1">
              <button onClick={() => cycleHighlight(-1)} className="h-8 w-8 flex items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground">
                <ChevronUp className="h-4 w-4" />
              </button>
              <button onClick={() => cycleHighlight(1)} className="h-8 w-8 flex items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground">
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {breakdownData.length > 0 && (
        <div className="gym-card p-0 divide-y divide-border">
          {breakdownData.map((item, i) => {
            const pct = total > 0 ? ((item.value / total) * 100).toFixed(2) : '0.00';
            const isActive = safeIdx === i;
            return (
              <button
                key={item.id}
                onClick={() => setHighlightIdx(i)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 text-left transition-colors",
                  isActive ? 'bg-secondary' : 'hover:bg-secondary/50'
                )}
                style={{ height: 48 }}
              >
                <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }} />
                <span className="flex-1 text-sm text-foreground truncate">{item.name}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{formatUnit(breakdown, metricType === 'volume' ? Math.round(toDisplayWeight(item.value, globalWeightUnit) ?? 0) : item.value, wuLabel)}</span>
                <span className="text-xs font-medium text-foreground w-14 text-right">{pct}%</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Workouts', value: summaryStats.workouts.toLocaleString() },
          { label: 'Total Sets', value: summaryStats.sets.toLocaleString() },
          { label: 'Total Reps', value: summaryStats.reps.toLocaleString() },
          { label: 'Total Volume', value: `${(toDisplayWeight(summaryStats.volume, globalWeightUnit) ?? 0).toLocaleString()} ${wuLabel}` },
        ].map(s => (
          <div key={s.label} className="gym-card flex flex-col items-center justify-center py-3">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</span>
            <span className="text-lg font-bold text-primary">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
