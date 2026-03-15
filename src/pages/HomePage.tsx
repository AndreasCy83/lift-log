import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isToday } from 'date-fns';
import { getWorkouts, getExercisesForWorkout, getExercises, generateId, addWorkout } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { getCategoryColor } from '@/lib/categoryColors';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function HomePage() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const workouts = useMemo(() => getWorkouts(), []);
  const allExercises = useMemo(() => getExercises(), []);
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
                  className={`relative flex h-9 w-full items-center justify-center rounded-lg text-sm font-medium transition-all
                    ${isSelected ? 'bg-primary text-primary-foreground' : ''}
                    ${!isSelected && isTodayDate ? 'ring-1 ring-primary text-primary' : ''}
                    ${!isSelected && !isTodayDate ? 'text-foreground hover:bg-secondary' : ''}
                  `}
                >
                  {format(day, 'd')}
                  {hasWorkout && !isSelected && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />
                  )}
                  {hasWorkout && isSelected && (
                    <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary-foreground" />
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
              <button
                onClick={() => navigate(`/workout/${selectedDateStr}`)}
                className="text-xs font-medium text-primary"
              >
                View Workout →
              </button>
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
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No workout logged</p>
          )}
        </div>
      </div>
    </div>
  );
}
