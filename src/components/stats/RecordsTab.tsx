import { useState, useMemo, useEffect, useRef } from 'react';
import { Trophy, MoreVertical, ArrowUpDown, Dumbbell } from 'lucide-react';
import { format } from 'date-fns';
import {
  getExercises, getCategories, getWorkouts,
  getWorkoutExercises, getWorkoutSets, getSettings,
} from '@/lib/storage';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';
import { getCategoryColor } from '@/lib/categoryColors';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import ExerciseStatsDialog from '@/components/ExerciseStatsDialog';
import type { Exercise, WorkoutSet } from '@/types/fitness';

type SortMode = 'recent' | 'alpha' | 'category';
const SORT_LABELS: Record<SortMode, string> = {
  recent: 'Recent',
  alpha: 'A → Z',
  category: 'Category',
};

interface PRData {
  exerciseId: string;
  exerciseName: string;
  categoryId: string;
  categoryName: string;
  lastLoggedDate: string;
  e1rm: { value: number; date: string } | null;
  maxWeight: { weight: number; reps: number; date: string } | null;
  maxReps: { reps: number; weight: number; date: string } | null;
  bestSetVolume: { volume: number; date: string } | null;
  bestSessionVolume: { volume: number; date: string } | null;
}

function hasMeaningfulData(s: WorkoutSet) {
  return [s.weightKg, s.reps, s.distanceKm, s.durationMinutes].some(v => typeof v === 'number' && v > 0);
}

export default function RecordsTab() {
  const exercises = useMemo(() => getExercises(), []);
  const categories = useMemo(() => getCategories(), []);
  const workouts = useMemo(() => getWorkouts(), []);
  const allWEs = useMemo(() => getWorkoutExercises(), []);
  const allSets = useMemo(() => getWorkoutSets(), []);

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedExercise, setSelectedExercise] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [historyExId, setHistoryExId] = useState<string | null>(null);
  const latestRef = useRef<HTMLDivElement>(null);

  // Build PR data for every exercise that has logged sets
  const allPRs = useMemo<PRData[]>(() => {
    const workoutDateMap = new Map(workouts.map(w => [w.id, w.date]));
    const catMap = new Map(categories.map(c => [c.id, c.name]));

    // Group sets by exerciseId with their workout date
    const exSessionMap = new Map<string, { date: string; sets: WorkoutSet[] }[]>();

    for (const we of allWEs) {
      const date = workoutDateMap.get(we.workoutId);
      if (!date) continue;
      const sets = allSets.filter(s => s.workoutExerciseId === we.id && !s.isWarmup && hasMeaningfulData(s));
      if (sets.length === 0) continue;
      if (!exSessionMap.has(we.exerciseId)) exSessionMap.set(we.exerciseId, []);
      exSessionMap.get(we.exerciseId)!.push({ date, sets });
    }

    const results: PRData[] = [];

    for (const [exId, sessions] of exSessionMap) {
      const ex = exercises.find(e => e.id === exId);
      if (!ex) continue;

      let e1rm: PRData['e1rm'] = null;
      let maxWeight: PRData['maxWeight'] = null;
      let maxReps: PRData['maxReps'] = null;
      let bestSetVol: PRData['bestSetVolume'] = null;
      let bestSessionVol: PRData['bestSessionVolume'] = null;
      let lastDate = '';

      for (const session of sessions) {
        if (session.date > lastDate) lastDate = session.date;
        let sessionVol = 0;

        for (const s of session.sets) {
          const w = s.weightKg ?? 0;
          const r = s.reps ?? 0;

          // E1RM
          if (w > 0 && r > 0) {
            const val = Math.round(w * (1 + r / 30) * 10) / 10;
            if (!e1rm || val > e1rm.value || (val === e1rm.value && session.date > e1rm.date)) {
              e1rm = { value: val, date: session.date };
            }
          }

          // Max weight
          if (w > 0) {
            if (!maxWeight || w > maxWeight.weight || (w === maxWeight.weight && session.date > maxWeight.date)) {
              maxWeight = { weight: w, reps: r, date: session.date };
            }
          }

          // Max reps
          if (r > 0) {
            if (!maxReps || r > maxReps.reps || (r === maxReps.reps && session.date > maxReps.date)) {
              maxReps = { reps: r, weight: w, date: session.date };
            }
          }

          // Best set volume
          if (w > 0 && r > 0) {
            const sv = w * r;
            if (!bestSetVol || sv > bestSetVol.volume || (sv === bestSetVol.volume && session.date > bestSetVol.date)) {
              bestSetVol = { volume: Math.round(sv * 10) / 10, date: session.date };
            }
            sessionVol += sv;
          }
        }

        // Best session volume
        if (sessionVol > 0) {
          if (!bestSessionVol || sessionVol > bestSessionVol.volume || (sessionVol === bestSessionVol.volume && session.date > bestSessionVol.date)) {
            bestSessionVol = { volume: Math.round(sessionVol * 10) / 10, date: session.date };
          }
        }
      }

      results.push({
        exerciseId: exId,
        exerciseName: ex.name,
        categoryId: ex.categoryId,
        categoryName: catMap.get(ex.categoryId) ?? 'Other',
        lastLoggedDate: lastDate,
        e1rm, maxWeight, maxReps,
        bestSetVolume: bestSetVol,
        bestSessionVolume: bestSessionVol,
      });
    }

    return results;
  }, [exercises, categories, workouts, allWEs, allSets]);

  // Categories that have PR data
  const availableCategories = useMemo(() => {
    const catIds = new Set(allPRs.map(p => p.categoryId));
    return categories.filter(c => catIds.has(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [allPRs, categories]);

  // Filtered exercises for dropdown
  const availableExercises = useMemo(() => {
    let list = allPRs;
    if (selectedCategory !== 'all') list = list.filter(p => p.categoryId === selectedCategory);
    return list.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
  }, [allPRs, selectedCategory]);

  // Filtered + sorted results
  const filteredPRs = useMemo(() => {
    let list = allPRs;
    if (selectedCategory !== 'all') list = list.filter(p => p.categoryId === selectedCategory);
    if (selectedExercise !== 'all') list = list.filter(p => p.exerciseId === selectedExercise);

    switch (sortMode) {
      case 'recent':
        return [...list].sort((a, b) => b.lastLoggedDate.localeCompare(a.lastLoggedDate));
      case 'alpha':
        return [...list].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
      case 'category':
        return [...list].sort((a, b) => a.categoryName.localeCompare(b.categoryName) || a.exerciseName.localeCompare(b.exerciseName));
    }
  }, [allPRs, selectedCategory, selectedExercise, sortMode]);

  const latestExId = useMemo(() => {
    if (allPRs.length === 0) return null;
    return [...allPRs].sort((a, b) => b.lastLoggedDate.localeCompare(a.lastLoggedDate))[0].exerciseId;
  }, [allPRs]);

  // Scroll to latest on mount
  useEffect(() => {
    if (latestRef.current) {
      latestRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  const handleCategoryChange = (v: string) => {
    setSelectedCategory(v);
    setSelectedExercise('all');
  };

  const cycleSortMode = () => {
    const modes: SortMode[] = ['recent', 'alpha', 'category'];
    setSortMode(modes[(modes.indexOf(sortMode) + 1) % modes.length]);
  };

  const formatDate = (d: string) => {
    try { return format(new Date(d), 'd MMM yyyy'); }
    catch { return d; }
  };

  const fmtNum = (n: number) => n >= 1000 ? n.toLocaleString() : String(n);

  const historyEx = historyExId ? exercises.find(e => e.id === historyExId) : null;

  if (allPRs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <Trophy className="h-10 w-10" />
        <p className="text-sm font-medium">No personal records yet</p>
        <p className="text-xs">Start logging workouts to track your personal bests</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-20 shrink-0">Category:</span>
          <Select value={selectedCategory} onValueChange={handleCategoryChange}>
            <SelectTrigger className="h-8 text-xs flex-1 bg-card border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {availableCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-20 shrink-0">Exercise:</span>
          <Select value={selectedExercise} onValueChange={setSelectedExercise}>
            <SelectTrigger className="h-8 text-xs flex-1 bg-card border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Exercises</SelectItem>
              {availableExercises.map(p => <SelectItem key={p.exerciseId} value={p.exerciseId}>{p.exerciseName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sort toggle */}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 text-muted-foreground" onClick={cycleSortMode}>
          <ArrowUpDown className="h-3 w-3" />
          {SORT_LABELS[sortMode]}
        </Button>
      </div>

      {/* Cards */}
      {filteredPRs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Trophy className="h-8 w-8" />
          <p className="text-sm">No records found for this selection</p>
          <Button variant="outline" size="sm" onClick={() => { setSelectedCategory('all'); setSelectedExercise('all'); }}>
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredPRs.map(pr => {
            const isLatest = pr.exerciseId === latestExId && selectedExercise === 'all';
            const catColor = getCategoryColor(pr.categoryId);

            return (
              <div
                key={pr.exerciseId}
                ref={isLatest ? latestRef : undefined}
                className={`rounded-xl bg-card border overflow-hidden ${isLatest ? 'border-l-[3px]' : 'border-border'}`}
                style={isLatest ? { borderLeftColor: 'hsl(var(--primary))' } : undefined}
              >
                {/* Card header */}
                <div className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground shrink-0">
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
                      {pr.categoryName}
                    </span>
                    <span className="text-sm font-semibold text-foreground truncate">{pr.exerciseName}</span>
                    {isLatest && (
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold bg-primary/20 text-primary shrink-0">
                        LATEST
                      </span>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setHistoryExId(pr.exerciseId)}>View Exercise History</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* PR rows */}
                <div className="divide-y divide-border">
                  <PRRow label="Estimated 1RM" value={pr.e1rm ? `${fmtNum(pr.e1rm.value)} kg` : '—'} date={pr.e1rm?.date} formatDate={formatDate} />
                  <PRRow label="Max Weight" value={pr.maxWeight ? `${fmtNum(pr.maxWeight.weight)} kg × ${pr.maxWeight.reps} reps` : '—'} date={pr.maxWeight?.date} formatDate={formatDate} />
                  <PRRow label="Max Reps (single set)" value={pr.maxReps ? `${pr.maxReps.reps} reps @ ${fmtNum(pr.maxReps.weight)} kg` : '—'} date={pr.maxReps?.date} formatDate={formatDate} />
                  <PRRow label="Best Volume (single set)" value={pr.bestSetVolume ? `${fmtNum(pr.bestSetVolume.volume)} kg` : '—'} date={pr.bestSetVolume?.date} formatDate={formatDate} />
                  <PRRow label="Best Session Volume" value={pr.bestSessionVolume ? `${fmtNum(pr.bestSessionVolume.volume)} kg` : '—'} date={pr.bestSessionVolume?.date} formatDate={formatDate} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {historyEx && (
        <ExerciseStatsDialog
          open={!!historyExId}
          onOpenChange={open => { if (!open) setHistoryExId(null); }}
          exerciseId={historyEx.id}
          exerciseName={historyEx.name}
          weightUnit={historyEx.weightUnit ?? 'kg'}
        />
      )}
    </div>
  );
}

function PRRow({ label, value, date, formatDate }: { label: string; value: string; date?: string; formatDate: (d: string) => string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
        <div className="flex items-center gap-1.5">
          <Trophy className="h-3 w-3 shrink-0 text-amber-500" />
          <span className="text-sm font-bold text-foreground">{value}</span>
        </div>
      </div>
      {date && (
        <span className="text-[11px] text-muted-foreground shrink-0 ml-2">📅 {formatDate(date)}</span>
      )}
    </div>
  );
}
