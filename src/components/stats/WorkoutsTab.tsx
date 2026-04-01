import { useState, useMemo } from 'react';
import { format, subDays, isAfter, startOfWeek, startOfMonth, getYear } from 'date-fns';
import { getWorkouts, getWorkoutExercises, getWorkoutSets, getExercises, getCategories, getSettings } from '@/lib/storage';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';
import PeriodSelector, { Period, periodToDays } from '@/components/PeriodSelector';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CsvExportButtons from '@/components/CsvExportButtons';
import StatsChart from './StatsChart';

function hasMeaningfulData(s: { weightKg: number | null; reps: number | null; distanceKm: number | null; durationMinutes: number | null }) {
  return [s.weightKg, s.reps, s.distanceKm, s.durationMinutes].some(v => typeof v === 'number' && v > 0);
}

export default function WorkoutsTab() {
  const exercises = useMemo(() => getExercises(), []);
  const categories = useMemo(() => getCategories(), []);
  const workouts = useMemo(() => getWorkouts(), []);
  const allWEs = useMemo(() => getWorkoutExercises(), []);
  const allSets = useMemo(() => getWorkoutSets(), []);
  const globalWeightUnit = getSettings().weightUnit;
  const wuLabel = weightUnitLabel(globalWeightUnit);

  const [period, setPeriod] = useState<Period>('1M');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedExercise, setSelectedExercise] = useState('all');

  // Filter exercises by category for dropdown
  const exerciseOptions = useMemo(() => {
    if (selectedCategory === 'all') return exercises;
    return exercises.filter(e => e.categoryId === selectedCategory);
  }, [exercises, selectedCategory]);

  // Reset exercise when category changes
  const handleCategoryChange = (v: string) => {
    setSelectedCategory(v);
    setSelectedExercise('all');
  };

  // Filtered workouts by period
  const filteredWorkouts = useMemo(() => {
    const days = periodToDays(period);
    if (!days) return workouts;
    const cutoff = subDays(new Date(), days);
    return workouts.filter(w => isAfter(new Date(w.date), cutoff));
  }, [workouts, period]);

  // Per-workout data with filters applied
  const perWorkoutData = useMemo(() => {
    return filteredWorkouts
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(w => {
        const wes = allWEs.filter(we => we.workoutId === w.id);
        let volume = 0, sets = 0, reps = 0, duration = 0;
        let hasDuration = false;

        for (const we of wes) {
          const ex = exercises.find(e => e.id === we.exerciseId);
          if (!ex) continue;
          if (selectedCategory !== 'all' && ex.categoryId !== selectedCategory) continue;
          if (selectedExercise !== 'all' && ex.id !== selectedExercise) continue;

          const weSets = allSets.filter(s => s.workoutExerciseId === we.id && !s.isWarmup && (s.isCompleted || hasMeaningfulData(s)));
          for (const s of weSets) {
            sets++;
            const r = s.reps ?? 0;
            const wt = s.weightKg ?? 0;
            reps += r;
            volume += wt * r;
          }
        }

        if (w.startTime && w.endTime) {
          duration = (new Date(w.endTime).getTime() - new Date(w.startTime).getTime()) / 60000;
          hasDuration = true;
        }

        return {
          date: w.date,
          label: format(new Date(w.date), 'dd MMM'),
          volume,
          sets,
          reps,
          duration: Math.round(duration),
          hasDuration,
        };
      })
      .filter(d => d.sets > 0 || d.hasDuration);
  }, [filteredWorkouts, allWEs, allSets, exercises, selectedCategory, selectedExercise]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalVolume = perWorkoutData.reduce((s, d) => s + d.volume, 0);
    const totalSets = perWorkoutData.reduce((s, d) => s + d.sets, 0);
    const totalReps = perWorkoutData.reduce((s, d) => s + d.reps, 0);
    const count = perWorkoutData.length;
    return { workouts: count, totalSets, totalReps, totalVolume };
  }, [perWorkoutData]);

  // Aggregate helper
  function aggregate(keyFn: (date: string) => string) {
    const map: Record<string, { volume: number; sets: number; reps: number; duration: number; count: number }> = {};
    for (const d of perWorkoutData) {
      const key = keyFn(d.date);
      if (!map[key]) map[key] = { volume: 0, sets: 0, reps: 0, duration: 0, count: 0 };
      map[key].volume += d.volume;
      map[key].sets += d.sets;
      map[key].reps += d.reps;
      map[key].duration += d.duration;
      map[key].count++;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, v]) => ({ label, ...v }));
  }

  const weeklyData = useMemo(() => aggregate(d => {
    const ws = startOfWeek(new Date(d), { weekStartsOn: 1 });
    return format(ws, 'MMM') + ' W' + Math.ceil(new Date(d).getDate() / 7);
  }), [perWorkoutData]);

  const monthlyData = useMemo(() => aggregate(d => format(startOfMonth(new Date(d)), 'MMM yyyy')), [perWorkoutData]);

  const yearlyData = useMemo(() => aggregate(d => String(getYear(new Date(d)))), [perWorkoutData]);

  const hasDurationData = perWorkoutData.some(d => d.hasDuration);
  const fmtK = (v: number) => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(v);
  const toDisp = (v: number) => Math.round(toDisplayWeight(v, globalWeightUnit) ?? 0);

  return (
    <div className="space-y-4">
      {/* Export */}
      <div className="gym-card">
        <CsvExportButtons />
      </div>

      {/* Filters */}
      <div className="gym-card space-y-2">
        <h3 className="font-display text-xs font-semibold">Filters</h3>
        <div className="flex gap-2">
          <Select value={selectedCategory} onValueChange={handleCategoryChange}>
            <SelectTrigger className="flex-1 h-8 text-xs">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedExercise} onValueChange={setSelectedExercise}>
            <SelectTrigger className="flex-1 h-8 text-xs">
              <SelectValue placeholder="All Exercises" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Exercises</SelectItem>
              {exerciseOptions.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Time range */}
      <PeriodSelector value={period} onChange={setPeriod} />

      {/* Overview */}
      <div className="gym-card">
        <h3 className="font-display text-xs font-semibold mb-2">Overview</h3>
        <div className="grid grid-cols-4 gap-2">
          {[
            { v: summaryStats.workouts, l: 'Workouts' },
            { v: summaryStats.totalSets, l: 'Sets' },
            { v: summaryStats.totalReps, l: 'Reps' },
            { v: toDisp(summaryStats.totalVolume), l: `Volume (${wuLabel})` },
          ].map(s => (
            <div key={s.l} className="text-center">
              <div className="font-display text-lg font-bold text-primary">{s.v >= 1000 ? fmtK(s.v) : s.v}</div>
              <div className="text-[9px] text-muted-foreground uppercase">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Per Workout */}
      <h3 className="font-display text-sm font-semibold text-muted-foreground">Per Workout</h3>
      <StatsChart
        title={`Volume per Workout (${wuLabel})`}
        data={perWorkoutData.map(d => ({ label: d.label, value: toDisp(d.volume) }))}
        type="line"
        summary={perWorkoutData.length > 0 ? `Avg: ${fmtK(toDisp(Math.round(summaryStats.totalVolume / perWorkoutData.length)))} ${wuLabel}/workout` : undefined}
        valueFormatter={fmtK}
      />
      <StatsChart
        title="Sets per Workout"
        data={perWorkoutData.map(d => ({ label: d.label, value: d.sets }))}
        type="line"
        summary={perWorkoutData.length > 0 ? `Avg: ${(summaryStats.totalSets / perWorkoutData.length).toFixed(1)} sets/workout` : undefined}
      />
      <StatsChart
        title="Reps per Workout"
        data={perWorkoutData.map(d => ({ label: d.label, value: d.reps }))}
        type="line"
        summary={perWorkoutData.length > 0 ? `Avg: ${(summaryStats.totalReps / perWorkoutData.length).toFixed(1)} reps/workout` : undefined}
      />
      {hasDurationData && (
        <StatsChart
          title="Duration per Workout"
          data={perWorkoutData.filter(d => d.hasDuration).map(d => ({ label: d.label, value: d.duration }))}
          type="line"
          summary={`Avg: ${Math.round(perWorkoutData.filter(d => d.hasDuration).reduce((s, d) => s + d.duration, 0) / perWorkoutData.filter(d => d.hasDuration).length)} min`}
          valueFormatter={v => v + 'm'}
        />
      )}

      {/* Weekly */}
      <h3 className="font-display text-sm font-semibold text-muted-foreground">Weekly</h3>
      <StatsChart title="Workouts per Week" data={weeklyData.map(d => ({ label: d.label, value: d.count }))} type="bar" summary={`Total: ${summaryStats.workouts} workouts`} />
      <StatsChart title={`Volume per Week (${wuLabel})`} data={weeklyData.map(d => ({ label: d.label, value: toDisp(d.volume) }))} type="bar" valueFormatter={fmtK} />
      <StatsChart title="Sets per Week" data={weeklyData.map(d => ({ label: d.label, value: d.sets }))} type="bar" summary={`Total: ${summaryStats.totalSets} sets`} />
      <StatsChart title="Reps per Week" data={weeklyData.map(d => ({ label: d.label, value: d.reps }))} type="bar" summary={`Total: ${summaryStats.totalReps} reps`} />
      {hasDurationData && <StatsChart title="Duration per Week" data={weeklyData.map(d => ({ label: d.label, value: d.duration }))} type="bar" valueFormatter={v => v + 'm'} />}

      {/* Monthly */}
      <h3 className="font-display text-sm font-semibold text-muted-foreground">Monthly</h3>
      <StatsChart title="Workouts per Month" data={monthlyData.map(d => ({ label: d.label, value: d.count }))} type="bar" />
      <StatsChart title="Volume per Month" data={monthlyData.map(d => ({ label: d.label, value: d.volume }))} type="bar" valueFormatter={fmtK} />
      <StatsChart title="Sets per Month" data={monthlyData.map(d => ({ label: d.label, value: d.sets }))} type="bar" />
      <StatsChart title="Reps per Month" data={monthlyData.map(d => ({ label: d.label, value: d.reps }))} type="bar" />
      {hasDurationData && <StatsChart title="Duration per Month" data={monthlyData.map(d => ({ label: d.label, value: d.duration }))} type="bar" valueFormatter={v => v + 'm'} />}

      {/* Yearly */}
      <h3 className="font-display text-sm font-semibold text-muted-foreground">Yearly</h3>
      <StatsChart title="Workouts per Year" data={yearlyData.map(d => ({ label: d.label, value: d.count }))} type="bar" />
      <StatsChart title="Volume per Year" data={yearlyData.map(d => ({ label: d.label, value: d.volume }))} type="bar" valueFormatter={fmtK} />
      <StatsChart title="Sets per Year" data={yearlyData.map(d => ({ label: d.label, value: d.sets }))} type="bar" />
      <StatsChart title="Reps per Year" data={yearlyData.map(d => ({ label: d.label, value: d.reps }))} type="bar" />
      {hasDurationData && <StatsChart title="Duration per Year" data={yearlyData.map(d => ({ label: d.label, value: d.duration }))} type="bar" valueFormatter={v => v + 'm'} />}
    </div>
  );
}
