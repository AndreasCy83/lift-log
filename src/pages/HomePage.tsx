import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ChevronDown, Plus, MoreVertical, Trash2, Heart, Settings } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isToday, startOfWeek, endOfWeek, subWeeks, isSameMonth } from 'date-fns';

import { getWorkouts, getExercisesForWorkout, getExercises, getCategories, generateId, addWorkout, getSetsForWorkoutExercise, deleteWorkout, copyWorkoutToDate, moveWorkoutToDate, getSettings } from '@/lib/storage';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';
import { startSession, formatHMS } from '@/lib/workoutSession';
import { Button } from '@/components/ui/button';
import { getCategoryColor } from '@/lib/categoryColors';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import RecoveryFatigueCard from '@/components/RecoveryFatigueCard';
import VolumeInsightsCard from '@/components/VolumeInsightsCard';
import CoachRecommendationsCard from '@/components/CoachRecommendationsCard';
import SupportModal from '@/components/SupportModal';


export default function HomePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const WEEKDAYS = [
    t('home.weekdays.mon'), t('home.weekdays.tue'), t('home.weekdays.wed'),
    t('home.weekdays.thu'), t('home.weekdays.fri'), t('home.weekdays.sat'), t('home.weekdays.sun'),
  ];
  const globalWeightUnit = getSettings().weightUnit;
  const unit = weightUnitLabel(globalWeightUnit);
  const dw = (v: number) => toDisplayWeight(v, globalWeightUnit) ?? v;

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState<Date | undefined>(undefined);
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

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
    if (calendarExpanded) {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      return eachDayOfInterval({ start, end });
    }
    // Collapsed: 3 weeks = current week + previous 2 (Monday-start)
    const today = new Date();
    const endWeek = endOfWeek(today, { weekStartsOn: 1 });
    const startWeek = startOfWeek(subWeeks(today, 2), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: startWeek, end: endWeek });
  }, [currentMonth, calendarExpanded]);

  const startDayOffset = useMemo(() => {
    if (!calendarExpanded) return 0;
    const d = getDay(startOfMonth(currentMonth));
    return d === 0 ? 6 : d - 1; // Monday start
  }, [currentMonth, calendarExpanded]);

  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedWorkout = workouts.find(w => w.date === selectedDateStr);
  const selectedExercises = selectedWorkout ? getExercisesForWorkout(selectedWorkout.id) : [];

  // Compute totals for selected day
  const selectedDayStats = useMemo(() => {
    if (!selectedWorkout) return null;
    const wExercises = getExercisesForWorkout(selectedWorkout.id);
    let totalVolume = 0, totalReps = 0, totalSets = 0, totalDistanceKm = 0, totalDurationMin = 0;
    let hasStrength = false, hasCardio = false;
    wExercises.forEach(we => {
      const ex = allExercises.find(e => e.id === we.exerciseId);
      const sets = getSetsForWorkoutExercise(we.id).filter(s => !s.isWarmup && s.isCompleted === true);
      sets.forEach(s => {
        totalSets++;
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
    return { totalVolume, totalReps, totalSets, totalDistanceKm, totalDurationMin, hasStrength, hasCardio };
  }, [selectedWorkout, allExercises]);

  // Muscle group breakdown for pie chart
  const categoryBreakdown = useMemo(() => {
    if (!selectedWorkout) return [];
    const wExercises = getExercisesForWorkout(selectedWorkout.id);
    const countMap: Record<string, number> = {};
    wExercises.forEach(we => {
      const ex = allExercises.find(e => e.id === we.exerciseId);
      if (!ex) return;
      const sets = getSetsForWorkoutExercise(we.id).filter(s => !s.isWarmup && s.isCompleted === true);
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
    // Start (or resume) the live workout session timer immediately.
    startSession(workout.id);
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
    <div
      className="flex min-h-screen flex-col"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6rem)' }}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <Button
            size="sm"
            onClick={handleStartWorkout}
            className="gap-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t('home.startWorkout')}
          </Button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSupportModalOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              aria-label="Support the creator"
            >
              <Heart className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              aria-label={t('nav.settings')}
            >
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-4">
        {/* Month / range navigation */}
        <div className="mb-4 flex items-center justify-between">
          {calendarExpanded ? (
            <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary">
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : <div className="w-9" />}
          <h2 className="font-display text-lg font-semibold">
            {calendarExpanded
              ? format(currentMonth, 'MMMM yyyy')
              : (() => {
                  const first = days[0];
                  const last = days[days.length - 1];
                  return isSameMonth(first, last)
                    ? format(last, 'MMMM yyyy')
                    : `${format(first, 'MMM')} – ${format(last, 'MMM yyyy')}`;
                })()}
          </h2>
          {calendarExpanded ? (
            <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary">
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : <div className="w-9" />}
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

          <div className="mt-2 grid grid-cols-[64px_1fr_64px] items-center">
            <div />
            <button
              onClick={() => setCalendarExpanded(e => !e)}
              className="flex items-center justify-center gap-1 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70 hover:text-foreground transition-colors"
            >
              {calendarExpanded ? t('home.showThreeWeeks') : t('home.showFullMonth')}
              <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${calendarExpanded ? 'rotate-180' : ''}`} />
            </button>
            <div className="flex items-center justify-end gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={!selectedWorkout}
                    aria-label={t('home.actions.copyWorkout')}
                    className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setPickerDate(undefined); setCopyDialogOpen(true); }}>
                    {t('home.actions.copyWorkout')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setPickerDate(undefined); setMoveDialogOpen(true); }}>
                    {t('home.actions.moveWorkout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={!selectedWorkout}
                aria-label={t('home.delete.title')}
                className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Volume insights */}
        <VolumeInsightsCard refreshKey={refreshKey} />

        {/* Recovery / Fatigue */}
        <RecoveryFatigueCard refreshKey={refreshKey} />

        {/* Coach recommendations (offline rules engine) */}
        <CoachRecommendationsCard refreshKey={refreshKey} />

        {/* Selected day summary */}
        <div className="gym-card mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold">
              {isToday(selectedDate) ? t('home.today') : format(selectedDate, 'EEE, MMM d')}
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
                      {t('home.actions.copyWorkout')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setPickerDate(undefined); setMoveDialogOpen(true); }}>
                      {t('home.actions.moveWorkout')}
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
                  {t('home.viewWorkout')}
                </button>
              </div>
            )}
          </div>
          {selectedWorkout ? (
            <div className="space-y-1.5">
              {selectedWorkout.notes ? (
                <p className="text-sm text-foreground/80 italic">"{selectedWorkout.notes}"</p>
              ) : null}
              <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
                <span>{t('home.exercise', { count: selectedExercises.length })}</span>
                {typeof selectedWorkout.durationSeconds === 'number' && selectedWorkout.durationSeconds > 0 && (
                  <span>{t('home.duration')}: <span className="font-semibold text-foreground tabular-nums">{formatHMS(selectedWorkout.durationSeconds)}</span></span>
                )}
              </div>
              {selectedDayStats && (selectedDayStats.hasStrength || selectedDayStats.hasCardio) && (
                <div className="mt-2 border-t border-border pt-2 space-y-1">
                  {selectedDayStats.hasStrength && (
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <span>{t('home.vol')}: <span className="font-semibold text-foreground tabular-nums">{Math.round(dw(selectedDayStats.totalVolume)).toLocaleString()} {unit}</span></span>
                      <span className="text-center">{t('home.reps')}: <span className="font-semibold text-foreground tabular-nums">{selectedDayStats.totalReps}</span></span>
                      <span className="text-right">{t('home.sets')}: <span className="font-semibold text-foreground tabular-nums">{selectedDayStats.totalSets}</span></span>
                    </div>
                  )}
                  {selectedDayStats.hasCardio && (
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>{t('home.dist')}: <span className="font-semibold text-foreground tabular-nums">{selectedDayStats.totalDistanceKm.toFixed(2)} km</span></span>
                      <span className="text-right">{t('home.time')}: <span className="font-semibold text-foreground tabular-nums">{selectedDayStats.totalDurationMin.toFixed(0)} min</span></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('home.noWorkoutLogged')}</p>
        )}
        <div className="h-6" aria-hidden="true" />
      </div>

        {/* Muscle Group Breakdown Pie Chart */}
        {categoryBreakdown.length > 0 && (
          <div className="gym-card mt-4">
            <h3 className="font-display text-sm font-semibold mb-3 text-center">{t('home.muscleGroupBreakdown')}</h3>
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

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('home.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('home.delete.description', { date: format(selectedDate, 'MMM d, yyyy') })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('home.delete.no')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteWorkout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('home.delete.yes')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Copy Workout Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('home.copy.title')}</DialogTitle>
            <DialogDescription>{t('home.copy.description')}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">
            <Calendar mode="single" selected={pickerDate} onSelect={setPickerDate} />
          </div>
          <Button disabled={!pickerDate} onClick={handleCopyWorkout} className="w-full">
            {t('home.copy.cta', { date: pickerDate ? format(pickerDate, 'MMM d, yyyy') : '…' })}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Move Workout Dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('home.move.title')}</DialogTitle>
            <DialogDescription>{t('home.move.description')}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center">
            <Calendar mode="single" selected={pickerDate} onSelect={setPickerDate} />
          </div>
          <Button disabled={!pickerDate} onClick={handleMoveWorkout} className="w-full">
            {t('home.move.cta', { date: pickerDate ? format(pickerDate, 'MMM d, yyyy') : '…' })}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Support Modal */}
      <SupportModal
        open={supportModalOpen}
        workoutCount={workouts.length}
        onClose={() => setSupportModalOpen(false)}
      />
    </div>
  );
}
