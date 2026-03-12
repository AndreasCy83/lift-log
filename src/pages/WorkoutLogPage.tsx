import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import RestTimer from '@/components/RestTimer';
import type { Workout, WorkoutSet } from '@/types/fitness';

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
  const [search, setSearch] = useState('');
  const [showTimer, setShowTimer] = useState(false);
  const [, forceUpdate] = useState(0);

  const refresh = useCallback(() => {
    if (workout) {
      setWorkoutExercises(getExercisesForWorkout(workout.id));
      forceUpdate(n => n + 1);
    }
  }, [workout]);

  if (!date || !workout) return <div className="p-4">Invalid date</div>;

  const filteredExercises = allExercises.filter(ex =>
    ex.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddExercise = (exerciseId: string) => {
    const we = {
      id: generateId(), workoutId: workout.id, exerciseId, position: workoutExercises.length, notes: ''
    };
    addWorkoutExercise(we);
    // Add one empty set
    const ex = allExercises.find(e => e.id === exerciseId);
    addWorkoutSet({
      id: generateId(), workoutExerciseId: we.id, setIndex: 0,
      weightKg: null, reps: ex?.defaultRepsMin ?? null, distanceKm: null, durationMinutes: null,
      rpe: null, isWarmup: false, isCompleted: false, notes: ''
    });
    refresh();
    setShowAddExercise(false);
    setSearch('');
    setExpandedExercise(we.id);
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
      weightKg: last?.weightKg ?? null, reps: last?.reps ?? null, distanceKm: null,
      durationMinutes: null, rpe: null, isWarmup: false, isCompleted: false, notes: ''
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

  const getExName = (exId: string) => allExercises.find(e => e.id === exId)?.name ?? 'Unknown';
  const getExType = (exId: string) => allExercises.find(e => e.id === exId)?.type ?? 'RESISTANCE';
  const getCatName = (exId: string) => {
    const ex = allExercises.find(e => e.id === exId);
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
          const exType = getExType(we.exerciseId);
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
                    <p className="text-[10px] text-gym-pr mt-0.5">PR: {pr.weight}kg × {pr.reps}</p>
                  )}
                </button>
                <button onClick={() => handleRemoveExercise(we.id)} className="p-1 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {isExpanded && (
                <div className="space-y-2 animate-slide-up">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-1 text-[10px] uppercase text-muted-foreground font-medium px-1">
                    <div className="col-span-1">Set</div>
                    {exType === 'RESISTANCE' ? (
                      <>
                        <div className="col-span-3">Weight</div>
                        <div className="col-span-3">Reps</div>
                        <div className="col-span-2">RPE</div>
                      </>
                    ) : (
                      <>
                        <div className="col-span-3">Dist (km)</div>
                        <div className="col-span-3">Time (min)</div>
                        <div className="col-span-2"></div>
                      </>
                    )}
                    <div className="col-span-2 text-center">✓</div>
                    <div className="col-span-1"></div>
                  </div>

                  {sets.map(s => (
                    <div key={s.id} className={`grid grid-cols-12 gap-1 items-center px-1 py-1 rounded-lg transition-colors ${s.isCompleted ? 'bg-primary/10' : ''}`}>
                      <div className="col-span-1 text-xs text-muted-foreground">{s.setIndex + 1}</div>
                      {exType === 'RESISTANCE' ? (
                        <>
                          <div className="col-span-3">
                            <Input
                              type="number" placeholder="0" value={s.weightKg ?? ''}
                              onChange={e => handleUpdateSet(s, 'weightKg', e.target.value ? parseFloat(e.target.value) : null)}
                              className="h-8 text-xs text-center bg-secondary border-0"
                            />
                          </div>
                          <div className="col-span-3">
                            <Input
                              type="number" placeholder="0" value={s.reps ?? ''}
                              onChange={e => handleUpdateSet(s, 'reps', e.target.value ? parseInt(e.target.value) : null)}
                              className="h-8 text-xs text-center bg-secondary border-0"
                            />
                          </div>
                          <div className="col-span-2">
                            <Input
                              type="number" placeholder="-" value={s.rpe ?? ''}
                              onChange={e => handleUpdateSet(s, 'rpe', e.target.value ? parseFloat(e.target.value) : null)}
                              className="h-8 text-xs text-center bg-secondary border-0"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="col-span-3">
                            <Input
                              type="number" placeholder="0" value={s.distanceKm ?? ''}
                              onChange={e => handleUpdateSet(s, 'distanceKm', e.target.value ? parseFloat(e.target.value) : null)}
                              className="h-8 text-xs text-center bg-secondary border-0"
                            />
                          </div>
                          <div className="col-span-3">
                            <Input
                              type="number" placeholder="0" value={s.durationMinutes ?? ''}
                              onChange={e => handleUpdateSet(s, 'durationMinutes', e.target.value ? parseFloat(e.target.value) : null)}
                              className="h-8 text-xs text-center bg-secondary border-0"
                            />
                          </div>
                          <div className="col-span-2" />
                        </>
                      )}
                      <div className="col-span-2 flex justify-center">
                        <button
                          onClick={() => handleToggleComplete(s)}
                          className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors ${s.isCompleted ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground'}`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <button onClick={() => handleDeleteSet(s.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}

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

        <Dialog open={showAddExercise} onOpenChange={setShowAddExercise}>
          <DialogTrigger asChild>
            <button className="w-full gym-card flex items-center justify-center gap-2 py-4 text-sm font-medium text-primary border-dashed border-2 border-primary/30 hover:border-primary/50 transition-colors">
              <Plus className="h-4 w-4" /> Add Exercise
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Exercise</DialogTitle></DialogHeader>
            <Input placeholder="Search exercises..." value={search} onChange={e => setSearch(e.target.value)} className="mb-3" />
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredExercises.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => handleAddExercise(ex.id)}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-secondary transition-colors"
                >
                  <div className="text-sm font-medium">{ex.name}</div>
                  <div className="text-xs text-muted-foreground">{categories.find(c => c.id === ex.categoryId)?.name} · {ex.type}</div>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
