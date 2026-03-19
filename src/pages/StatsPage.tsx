import { useState, useMemo } from 'react';
import { getWorkouts, getWorkoutExercises, getWorkoutSets, getExercises, getCategories, getPersonalRecord, getWeightHistory, getProfile, addWeightEntry } from '@/lib/storage';
import { format, subDays, isAfter } from 'date-fns';
import BMICalculator from '@/components/BMICalculator';
import OneRMCalculator from '@/components/OneRMCalculator';
import PlateCalculator from '@/components/PlateCalculator';
import PeriodSelector, { Period, periodToDays } from '@/components/PeriodSelector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import CsvExportButtons from '@/components/CsvExportButtons';

function filterByPeriod<T extends { date: string }>(data: T[], period: Period): T[] {
  const days = periodToDays(period);
  if (!days) return data;
  const cutoff = subDays(new Date(), days);
  return data.filter(d => isAfter(new Date(d.date), cutoff));
}

function hasMeaningfulData(s: { weightKg: number | null; reps: number | null; distanceKm: number | null; durationMinutes: number | null }) {
  return [s.weightKg, s.reps, s.distanceKm, s.durationMinutes].some(v => typeof v === 'number' && v > 0);
}

export default function StatsPage() {
  const exercises = useMemo(() => getExercises(), []);
  const categories = useMemo(() => getCategories(), []);
  const workouts = useMemo(() => getWorkouts(), []);
  const allWEs = useMemo(() => getWorkoutExercises(), []);
  const allSets = useMemo(() => getWorkoutSets(), []);
  const profile = useMemo(() => getProfile(), []);

  const [summaryPeriod, setSummaryPeriod] = useState<Period>('1W');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [weightPeriod, setWeightPeriod] = useState<Period>('3M');
  const [newWeight, setNewWeight] = useState('');
  const [weightHistory, setWeightHistory] = useState(() => getWeightHistory());

  // Filtered workouts by period
  const recentWorkouts = useMemo(() => filterByPeriod(workouts, summaryPeriod), [workouts, summaryPeriod]);

  // Volume per category filtered by period & selected category
  const volumeByCategory = useMemo(() => {
    const catMap: Record<string, number> = {};
    for (const w of recentWorkouts) {
      const wes = allWEs.filter(we => we.workoutId === w.id);
      for (const we of wes) {
        const ex = exercises.find(e => e.id === we.exerciseId);
        if (!ex) continue;
        const cat = categories.find(c => c.id === ex.categoryId);
        const catName = cat?.name ?? 'Other';
        if (selectedCategory !== 'all' && cat?.id !== selectedCategory) continue;
        const sets = allSets.filter(s => s.workoutExerciseId === we.id && !s.isWarmup && (s.isCompleted || hasMeaningfulData(s)));
        if (sets.length > 0) {
          catMap[catName] = (catMap[catName] || 0) + sets.length;
        }
      }
    }
    return Object.entries(catMap).map(([name, sets]) => ({ name, sets })).sort((a, b) => b.sets - a.sets);
  }, [recentWorkouts, allWEs, allSets, exercises, categories, selectedCategory]);

  // Summary stats
  const summaryStats = useMemo(() => {
    let totalSets = 0;
    let totalExercises = 0;
    for (const w of recentWorkouts) {
      const wes = allWEs.filter(x => x.workoutId === w.id);
      totalExercises += wes.length;
      for (const we of wes) {
        totalSets += allSets.filter(s => s.workoutExerciseId === we.id && !s.isWarmup && (s.isCompleted || hasMeaningfulData(s))).length;
      }
    }
    return { workouts: recentWorkouts.length, sets: totalSets, exercises: totalExercises };
  }, [recentWorkouts, allWEs, allSets]);

  // PRs
  const prs = useMemo(() => {
    return exercises
      .filter(e => e.type === 'RESISTANCE')
      .map(e => ({ exercise: e, pr: getPersonalRecord(e.id) }))
      .filter(x => x.pr !== null)
      .sort((a, b) => {
        const a1rm = a.pr!.weight * (1 + a.pr!.reps / 30);
        const b1rm = b.pr!.weight * (1 + b.pr!.reps / 30);
        return b1rm - a1rm;
      });
  }, [exercises]);

  // Weight chart data
  const weightChartData = useMemo(() => {
    const filtered = filterByPeriod(weightHistory, weightPeriod);
    return filtered
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(e => ({ date: format(new Date(e.date), 'dd MMM'), weight: e.weightKg }));
  }, [weightHistory, weightPeriod]);

  const handleAddWeight = () => {
    const w = parseFloat(newWeight);
    if (isNaN(w) || w <= 0) return;
    const entry = { date: format(new Date(), 'yyyy-MM-dd'), weightKg: w };
    addWeightEntry(entry);
    setWeightHistory(getWeightHistory());
    setNewWeight('');
  };

  return (
    <div className="flex min-h-screen flex-col pb-20">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="mx-auto max-w-lg">
          <h1 className="font-display text-xl font-bold">Stats & Tools</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-4">
        <Tabs defaultValue="summary" className="w-full">
          <TabsList className="w-full mb-4 bg-secondary">
            <TabsTrigger value="summary" className="flex-1 text-xs">Summary</TabsTrigger>
            <TabsTrigger value="weight" className="flex-1 text-xs">Weight</TabsTrigger>
            <TabsTrigger value="prs" className="flex-1 text-xs">PRs</TabsTrigger>
            <TabsTrigger value="tools" className="flex-1 text-xs">Calcs</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-4">
            <PeriodSelector value={summaryPeriod} onChange={setSummaryPeriod} />

            <div className="gym-card">
              <h3 className="font-display text-sm font-semibold mb-3">Overview</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="font-display text-2xl font-bold text-primary">{summaryStats.workouts}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Workouts</div>
                </div>
                <div className="text-center">
                  <div className="font-display text-2xl font-bold text-primary">{summaryStats.sets}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Sets</div>
                </div>
                <div className="text-center">
                  <div className="font-display text-2xl font-bold text-primary">{summaryStats.exercises}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Exercises</div>
                </div>
              </div>
            </div>

            {/* Category filter */}
            <div className="gym-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display text-sm font-semibold">Sets by Muscle Group</h3>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue placeholder="All Groups" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {volumeByCategory.length > 0 ? (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={volumeByCategory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
                      <Bar dataKey="sets" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8 text-sm">No data for this period</p>
              )}
            </div>
          </TabsContent>

          {/* Weight Tracker Tab */}
          <TabsContent value="weight" className="space-y-4">
            <PeriodSelector value={weightPeriod} onChange={setWeightPeriod} />

            <div className="gym-card">
              <h3 className="font-display text-sm font-semibold mb-3">Log Weight</h3>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder={profile ? `Current: ${profile.currentWeightKg} kg` : 'Weight (kg)'}
                  value={newWeight}
                  onChange={e => setNewWeight(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleAddWeight} size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
            </div>

            <div className="gym-card">
              <h3 className="font-display text-sm font-semibold mb-3">Weight Progress</h3>
              {weightChartData.length > 1 ? (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weightChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
                      <Line type="monotone" dataKey="weight" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))', r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  {weightChartData.length === 1 ? 'Add more entries to see the trend' : 'No weight entries yet'}
                </p>
              )}
            </div>
          </TabsContent>

          {/* PRs Tab */}
          <TabsContent value="prs" className="space-y-2">
            {prs.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">Complete some workouts to see PRs</p>
            ) : (
              prs.map(({ exercise, pr }) => (
                <div key={exercise.id} className="gym-card flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{exercise.name}</div>
                    <div className="text-xs text-muted-foreground">{categories.find(c => c.id === exercise.categoryId)?.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gym-pr">{pr!.weight}kg × {pr!.reps}</div>
                    <div className="text-[10px] text-muted-foreground">{pr!.date}</div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Calculators Tab */}
          <TabsContent value="tools" className="space-y-4">
            <BMICalculator />
            <OneRMCalculator />
            <PlateCalculator />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
