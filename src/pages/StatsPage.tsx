import { useState, useMemo } from 'react';
import { getWorkouts, getWorkoutExercises, getWorkoutSets, getExercises, getCategories, getPersonalRecord, getBMIHistory, getProfile } from '@/lib/storage';
import { format, subDays, isAfter } from 'date-fns';
import BMICalculator from '@/components/BMICalculator';
import OneRMCalculator from '@/components/OneRMCalculator';
import PlateCalculator from '@/components/PlateCalculator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function StatsPage() {
  const exercises = useMemo(() => getExercises(), []);
  const categories = useMemo(() => getCategories(), []);
  const workouts = useMemo(() => getWorkouts(), []);
  const allWEs = useMemo(() => getWorkoutExercises(), []);
  const allSets = useMemo(() => getWorkoutSets(), []);

  // Weekly summary
  const weekAgo = subDays(new Date(), 7);
  const recentWorkouts = workouts.filter(w => isAfter(new Date(w.date), weekAgo));

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

  // Volume per category this week
  const volumeByCategory = useMemo(() => {
    const catMap: Record<string, number> = {};
    for (const w of recentWorkouts) {
      const wes = allWEs.filter(we => we.workoutId === w.id);
      for (const we of wes) {
        const ex = exercises.find(e => e.id === we.exerciseId);
        if (!ex) continue;
        const catName = categories.find(c => c.id === ex.categoryId)?.name ?? 'Other';
        const sets = allSets.filter(s => s.workoutExerciseId === we.id && s.isCompleted);
        catMap[catName] = (catMap[catName] || 0) + sets.length;
      }
    }
    return Object.entries(catMap).map(([name, sets]) => ({ name, sets })).sort((a, b) => b.sets - a.sets);
  }, [recentWorkouts, allWEs, allSets, exercises, categories]);

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
            <TabsTrigger value="prs" className="flex-1 text-xs">PRs</TabsTrigger>
            <TabsTrigger value="tools" className="flex-1 text-xs">Calculators</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            {/* Weekly overview */}
            <div className="gym-card">
              <h3 className="font-display text-sm font-semibold mb-3">Last 7 Days</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="font-display text-2xl font-bold text-primary">{recentWorkouts.length}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">Workouts</div>
                </div>
                <div className="text-center">
                  <div className="font-display text-2xl font-bold text-primary">
                    {allSets.filter(s => {
                      const we = allWEs.find(x => x.id === s.workoutExerciseId);
                      return we && recentWorkouts.some(w => w.id === we.workoutId) && s.isCompleted;
                    }).length}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">Sets</div>
                </div>
                <div className="text-center">
                  <div className="font-display text-2xl font-bold text-primary">
                    {(() => {
                      let total = 0;
                      for (const w of recentWorkouts) {
                        const wes = allWEs.filter(x => x.workoutId === w.id);
                        total += wes.length;
                      }
                      return total;
                    })()}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase">Exercises</div>
                </div>
              </div>
            </div>

            {/* Volume chart */}
            {volumeByCategory.length > 0 && (
              <div className="gym-card">
                <h3 className="font-display text-sm font-semibold mb-3">Sets by Muscle Group</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={volumeByCategory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                      />
                      <Bar dataKey="sets" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </TabsContent>

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
