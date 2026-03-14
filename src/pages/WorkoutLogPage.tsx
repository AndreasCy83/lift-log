import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Check, Timer } from 'lucide-react';
import { format } from 'date-fns';
import {
  getWorkoutByDate, getExercisesForWorkout, getSetsForWorkoutExercise,
  getExercises, getCategories, generateId, addWorkout, addWorkoutExercise,
  addWorkoutSet, updateWorkoutSet, deleteWorkoutSet, removeWorkoutExercise,
  getPersonalRecord, updateWorkout
} from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import RestTimer from '@/components/RestTimer';
import ExerciseSelectionScreen from '@/components/ExerciseSelectionScreen';
import DynamicSetInputs, { SetColumnHeaders } from '@/components/DynamicSetInputs';
import type { Workout, WorkoutSet, SetTag } from '@/types/fitness';

export default function WorkoutLogPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const allExercises = useMemo(() => getExercises(), []);
  const categories = useMemo(() => getCategories(), []);

  const [workout, setWorkout] = useState<Workout | null>(() => {
    if (!date) return null;
    let w = getWorkoutByDate(date);
    if (!w) {
      w = { id: generateId(), date, startTime: new Date().toISOString(), endTime: null, notes: '' };
      addWorkout(w);
    }
    return w;
  });

  const [workoutExercises, setWorkoutExercises] = useState(() =>
    workout ? getExercisesForWorkout(workout.id) : []
  );
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [, forceUpdate] = useState(0);

  // Re-read exercises after custom creation
  const [exercises, setExercisesState] = useState(() => getExercises());

  const refresh = useCallback(() => {
    if (workout) {
      setWorkoutExercises(getExercisesForWorkout(workout.id));
      setExercisesState(getExercises());
      forceUpdate(n => n + 1);
    }
  }, [workout]);

  if (!date || !workout) return <div className="p-4">Invalid date</div>;

  const handleAddExercises = (exerciseIds: string[]) => {
    const currentExercises = getExercises();
    exerciseIds.forEach((exerciseId, i) => {
      const we = {
        id: generateId(), workoutId: workout.id, exerciseId, position: workoutExercises.length + i, notes: ''
      };
      addWorkoutExercise(we);
      const ex = currentExercises.find(e => e.id === exerciseId);
      addWorkoutSet({
        id: generateId(), workoutExerciseId: we.id, setIndex: 0,
        weightKg: null, reps: ex?.defaultRepsMin ?? null, distanceKm: null, durationMinutes: null,
        rpe: null, setTag: 'N', isWarmup: false, isCompleted: false, notes: ''
      });
    });
    refresh();
    setShowAddExercise(false);
    if (exerciseIds.length === 1) {
      const wes = getExercisesForWorkout(workout.id);
      setExpandedExercise(wes[wes.length - 1]?.id ?? null);
    }
  };

  const handleRemoveExercise = (weId: string) => {
    removeWorkoutExercise(weId);
    refresh();
  };

  const handleAddSet = (weId: string) => {
    const sets = getSetsForWorkoutExercise(weId);
    const last = sets[sets.length - 1];
    addWorkoutSet({
      id: generateId(), workoutExerciseId: weId, setIndex: sets.length,
      weightKg: last?.weightKg ?? null, reps: last?.reps ?? null, distanceKm: last?.distanceKm ?? null,
      durationMinutes: last?.durationMinutes ?? null, rpe: null, setTag: 'N', isWarmup: false, isCompleted: false, notes: ''
    });
    forceUpdate(n => n + 1);
  };

  const handleToggleComplete = (s: WorkoutSet) => {
    updateWorkoutSet({ ...s, isCompleted: !s.isCompleted });
    forceUpdate(n => n + 1);
  };

  const handleUpdateSet = (s: WorkoutSet, field: keyof WorkoutSet, value: any) => {
    updateWorkoutSet({ ...s, [field]: value });
    forceUpdate(n => n + 1);
  };

  const handleDeleteSet = (id: string) => {
    deleteWorkoutSet(id);
    forceUpdate(n => n + 1);
  };

  const handleFinishWorkout = () => {
    updateWorkout({ ...workout, endTime: new Date().toISOString() });
    navigate('/');
  };

  const getEx = (exId: string) => exercises.find(e => e.id === exId);
  const getExName = (exId: string) => getEx(exId)?.name ?? 'Unknown';
  const getCatName = (exId: string) => {
    const ex = getEx(exId);
    return ex ? categories.find(c => c.id === ex.categoryId)?.name ?? '' : '';
  };

  return (
    <div className="flex min-h-screen flex-col pb-20">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button onClick={() => navigate('/')} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-lg font-bold">Workout</h1>
            <p className="text-xs text-muted-foreground">{format(new Date(date), 'EEEE, MMM d, yyyy')}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setShowTimer(!showTimer)} className="text-primary">
            <Timer className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={handleFinishWorkout} className="rounded-full bg-primary text-primary-foreground">
            Finish
          </Button>
        </div>
      </header>

      {showTimer && (
        <div className="mx-auto w-full max-w-lg px-4 pt-3">
          <RestTimer onClose={() => setShowTimer(false)} />
        </div>
      )}

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-4 space-y-3">
        {workoutExercises.map(we => {
          const sets = getSetsForWorkoutExercise(we.id);
          const isExpanded = expandedExercise === we.id;
          const ex = getEx(we.exerciseId);
          const exSetType = ex?.setType ?? 'WEIGHT_REPS';
          const exWeightUnit = ex?.weightUnit ?? 'kg';
          const pr = getPersonalRecord(we.exerciseId);

          return (
            <div key={we.id} className="gym-card">
              <div className="flex items-center justify-between mb-2">
                <button onClick={() => setExpandedExercise(isExpanded ? null : we.id)} className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-semibold">{getExName(we.exerciseId)}</span>
                    <span className="text-[10px] rounded-full bg-secondary px-2 py-0.5 text-muted-foreground">{getCatName(we.exerciseId)}</span>
                  </div>
                  {pr && (
                    <p className="text-[10px] text-gym-pr mt-0.5">PR: {pr.weight}{exWeightUnit} × {pr.reps}</p>
                  )}
                </button>
                <button onClick={() => handleRemoveExercise(we.id)} className="p-1 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {isExpanded && (
                <div className="space-y-2 animate-slide-up">
                  {/* Dynamic Headers */}
                  <div className="grid gap-1 text-[10px] uppercase text-muted-foreground font-medium px-1" style={{ gridTemplateColumns: '1.5rem 2rem 0.75rem 1fr 1fr 1fr 2rem 1rem' }}>
                    <div>Set</div>
                    <div>Type</div>
                    <div></div>
                    <SetColumnHeaders setType={exSetType} weightUnit={exWeightUnit} />
                    <div className="text-center">✓</div>
                    <div></div>
                  </div>

                  {sets.map(s => {
                    const tag = s.setTag ?? 'N';
                    const tagColors: Record<SetTag, string> = {
                      N: 'bg-secondary text-muted-foreground',
                      W: 'bg-yellow-500/20 text-yellow-500',
                      D: 'bg-blue-500/20 text-blue-500',
                      F: 'bg-red-500/20 text-red-500',
                    };
                    const nextTag: Record<SetTag, SetTag> = { N: 'W', W: 'D', D: 'F', F: 'N' };
                    return (
                    <div key={s.id} className={`grid gap-1 items-center px-1 py-1 rounded-lg transition-colors ${s.isCompleted ? 'bg-primary/10' : ''}`} style={{ gridTemplateColumns: '1.5rem 2rem 0.75rem 1fr 1fr 1fr 2rem 1rem' }}>
                      <div className="text-xs text-muted-foreground">{s.setIndex + 1}</div>
                      <div className="flex justify-center">
                        <button
                          onClick={() => handleUpdateSet(s, 'setTag', nextTag[tag])}
                          className={`h-6 w-6 rounded text-[10px] font-bold flex items-center justify-center transition-colors ${tagColors[tag]}`}
                          title={tag === 'N' ? 'Normal' : tag === 'W' ? 'Warmup' : tag === 'D' ? 'Dropset' : 'Failure'}
                        >
                          {tag === 'N' ? '–' : tag}
                        </button>
                      </div>
                      <DynamicSetInputs
                        set={s}
                        setType={exSetType}
                        weightUnit={exWeightUnit}
                        onUpdate={(field, value) => handleUpdateSet(s, field, value)}
                      />
                      <div className="flex justify-center">
                        <button
                          onClick={() => handleToggleComplete(s)}
                          className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors ${s.isCompleted ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'}`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex justify-center">
                        <button onClick={() => handleDeleteSet(s.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    );
                  })}

                  <Button size="sm" variant="ghost" onClick={() => handleAddSet(we.id)} className="w-full text-xs text-primary">
                    <Plus className="h-3 w-3 mr-1" /> Add Set
                  </Button>
                </div>
              )}

              {!isExpanded && (
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span>{sets.length} sets</span>
                  <span>·</span>
                  <span>{sets.filter(s => s.isCompleted).length} done</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Add Exercise Button */}
        <button
          onClick={() => setShowAddExercise(true)}
          className="w-full gym-card flex items-center justify-center gap-2 py-4 text-sm font-medium text-primary border-dashed border-2 border-primary/30 hover:border-primary/50 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Exercise
        </button>

        {/* Exercise Selection Dialog */}
        <Dialog open={showAddExercise} onOpenChange={setShowAddExercise}>
          <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
            <DialogHeader><DialogTitle>Add Exercise</DialogTitle></DialogHeader>
            <ExerciseSelectionScreen
              onSelect={handleAddExercises}
              onClose={() => setShowAddExercise(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
