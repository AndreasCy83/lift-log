import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, MoreVertical, Trash2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isToday } from 'date-fns';
import { getWorkouts, getExercisesForWorkout, getExercises, getCategories, generateId, addWorkout, getSetsForWorkoutExercise, deleteWorkout, copyWorkoutToDate, moveWorkoutToDate } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { getCategoryColor } from '@/lib/categoryColors';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function HomePage() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date | undefined>(undefined);

  const workouts = useMemo(() => getWorkouts(), [refreshKey]);
  const allExercises = useMemo(() => getExercises(), []);
  const allCategories = useMemo(() => getCategories(), []);
  const workoutDates = useMemo(() => new Set(workouts.map(w => w.date)), [workouts]);

  // Build a map: date -> unique category IDs for that workout
  const workoutCategoryMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    workouts.forEach(w => {
      const wExercises = getExercisesForWorkout(w.id);
      const catIds = [...new Set(wExercises.map(we => {
        const ex = allExercises.find(e => e.id === we.exerciseId);
        return ex?.categoryId;
      }).filter(Boolean))] as string[];
      map[w.date] = catIds;
    });
    return map;
  }, [workouts, allExercises]);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const startDayOffset = useMemo(() => {
    const d = getDay(startOfMonth(currentMonth));
    return d === 0 ? 6 : d - 1; // Monday start
  }, [currentMonth]);

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedWorkout = workouts.find(w => w.date === selectedDateStr);
  const selectedExercises = selectedWorkout ? getExercisesForWorkout(selectedWorkout.id) : [];

  // Compute totals for selected day
  const selectedDayStats = useMemo(() => {
    if (!selectedWorkout) return null;
    const wExercises = getExercisesForWorkout(selectedWorkout.id);
    let totalVolume = 0, totalReps = 0, totalDistanceKm = 0, totalDurationMin = 0;
    let hasStrength = false, hasCardio = false;
    wExercises.forEach(we => {
      const ex = allExercises.find(e => e.id === we.exerciseId);
      const sets = getSetsForWorkoutExercise(we.id).filter(s => !s.isWarmup);
      sets.forEach(s => {
        if (ex?.setType === 'REPS_DISTANCE' || ex?.setType === 'REPS_TIME' || ex?.type === 'CARDIO') {
          hasCardio = true;
          if (s.distanceKm) totalDistanceKm += s.distanceKm;
          if (s.durationMinutes) totalDurationMin += s.durationMinutes;
        } else {
          hasStrength = true;
          if (s.weightKg && s.reps) totalVolume += s.weightKg * s.reps;
          if (s.reps) totalReps += s.reps;
        }
      });
    });
    return { totalVolume, totalReps, totalDistanceKm, totalDurationMin, hasStrength, hasCardio };
  }, [selectedWorkout, allExercises]);

  // Muscle group breakdown for pie chart
  const categoryBreakdown = useMemo(() => {
    if (!selectedWorkout) return [];
    const wExercises = getExercisesForWorkout(selectedWorkout.id);
    const countMap: Record<string, number> = {};
    wExercises.forEach(we => {
      const ex = allExercises.find(e => e.id === we.exerciseId);
      if (!ex) return;
      const sets = getSetsForWorkoutExercise(we.id).filter(s => !s.isWarmup);
      countMap[ex.categoryId] = (countMap[ex.categoryId] || 0) + sets.length;
    });
    const total = Object.values(countMap).reduce((a, b) => a + b, 0);
    if (total === 0) return [];
    return Object.entries(countMap).map(([catId, count]) => {
      const cat = allCategories.find(c => c.id === catId);
      return {
        name: cat?.name ?? catId,
        value: count,
        percent: Math.round((count / total) * 100),
        color: getCategoryColor(catId),
      };
    }).sort((a, b) => b.value - a.value);
  }, [selectedWorkout, allExercises, allCategories]);

  const handleStartWorkout = useCallback(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    let workout = workouts.find(w => w.date === today);
    if (!workout) {
      workout = {
        id: generateId(),
        date: today,
        startTime: new Date().toISOString(),
        endTime: null,
        notes: '',
      };
      addWorkout(workout);
    }
    navigate(`/workout/${today}`);
  }, [navigate, workouts]);

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
  };

  const handleDayDoubleClick = (day: Date) => {
    navigate(`/workout/${format(day, 'yyyy-MM-dd')}`);
  };

  const handleDeleteWorkout = useCallback(() => {
    if (selectedWorkout) {
      deleteWorkout(selectedWorkout.id);
      setRefreshKey(k => k + 1);
    }
    setShowDeleteConfirm(false);
  }, [selectedWorkout]);

  const handleCopyWorkout = useCallback(() => {
    if (selectedWorkout && pickerDate) {
      copyWorkoutToDate(selectedWorkout.id, format(pickerDate, 'yyyy-MM-dd'));
      setRefreshKey(k => k + 1);
    }
    setCopyDialogOpen(false);
    setPickerDate(undefined);
  }, [selectedWorkout, pickerDate]);

  const handleMoveWorkout = useCallback(() => {
    if (selectedWorkout && pickerDate) {
      moveWorkoutToDate(selectedWorkout.id, format(pickerDate, 'yyyy-MM-dd'));
      setSelectedDate(pickerDate);
      setRefreshKey(k => k + 1);
    }
    setMoveDialogOpen(false);
    setPickerDate(undefined);
  }, [selectedWorkout, pickerDate]);

  return (
    <div className="flex min-h-screen flex-col pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="font-display text-xl font-bold">FitLog</h1>
          <Button
            size="sm"
            onClick={handleStartWorkout}
            className="gap-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Start Workout
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-4">
        {/* Month navigation */}
        <div className="mb-4 flex items-center justify-between">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="font-display text-lg font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Calendar */}
        <div className="gym-card mb-4">
          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEKDAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-medium uppercase text-muted-foreground">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startDayOffset }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const hasWorkout = workoutDates.has(dateStr);
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayClick(day)}
                  onDoubleClick={() => handleDayDoubleClick(day)}
                  className={`relative flex h-10 w-full flex-col items-center justify-center rounded-lg text-sm font-medium transition-all
                    ${isSelected ? 'bg-primary text-primary-foreground' : ''}
                    ${!isSelected && isTodayDate ? 'ring-1 ring-primary text-primary' : ''}
                    ${!isSelected && !isTodayDate ? 'text-foreground hover:bg-secondary' : ''}
                  `}
                >
                  <span>{format(day, 'd')}</span>
                  {hasWorkout && (
                    <div className="absolute bottom-0.5 flex gap-0.5">
                      {(workoutCategoryMap[dateStr] ?? []).slice(0, 5).map(catId => (
                        <span
                          key={catId}
                          className="h-1 w-1 rounded-full"
                          style={{ backgroundColor: isSelected ? 'hsl(var(--primary-foreground))' : getCategoryColor(catId) }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day summary */}
        <div className="gym-card">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold">
              {isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEE, MMM d')}
            </h3>
            {selectedWorkout && (
              <div className="flex items-center gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => { setPickerDate(undefined); setCopyDialogOpen(true); }}>
                      Copy Workout
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setPickerDate(undefined); setMoveDialogOpen(true); }}>
                      Move this Workout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => navigate(`/workout/${selectedDateStr}`)}
                  className="text-xs font-medium text-primary ml-1"
                >
                  View Workout →
                </button>
              </div>
            )}
          </div>
          {selectedWorkout ? (
            <div className="space-y-1.5">
              {selectedWorkout.notes ? (
                <p className="text-sm text-foreground/80 italic">"{selectedWorkout.notes}"</p>
              ) : null}
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>{selectedExercises.length} exercise{selectedExercises.length !== 1 ? 's' : ''}</span>
              </div>
              {selectedDayStats && (selectedDayStats.hasStrength || selectedDayStats.hasCardio) && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground border-t border-border pt-2">
                  {selectedDayStats.hasStrength && (
                    <>
                      <span>Vol: <span className="font-semibold text-foreground">{selectedDayStats.totalVolume.toLocaleString()} kg</span></span>
                      <span>Reps: <span className="font-semibold text-foreground">{selectedDayStats.totalReps}</span></span>
                    </>
                  )}
                  {selectedDayStats.hasCardio && (
                    <>
                      <span>Dist: <span className="font-semibold text-foreground">{selectedDayStats.totalDistanceKm.toFixed(2)} km</span></span>
                      <span>Time: <span className="font-semibold text-foreground">{selectedDayStats.totalDurationMin.toFixed(0)} min</span></span>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No workout logged</p>
          )}
        </div>
        {/* Muscle Group Breakdown Pie Chart */}
        {categoryBreakdown.length > 0 && (
          <div className="gym-card mt-4">
            <h3 className="font-display text-sm font-semibold mb-3 text-center">Muscle Group Breakdown</h3>
            <div className="flex flex-col items-center gap-4">
              <div className="h-36 w-36 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={28}
                      outerRadius={60}
                      strokeWidth={2}
                      stroke="hsl(var(--background))"
                    >
                      {categoryBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-1.5 min-w-0">
                {categoryBreakdown.map(entry => (
                  <div key={entry.name} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="truncate text-muted-foreground">{entry.name}</span>
                    <span className="ml-auto font-semibold text-foreground">{entry.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
