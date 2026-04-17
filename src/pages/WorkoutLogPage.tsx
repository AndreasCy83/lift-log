import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Timer, StickyNote, BarChart3, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import {
  getWorkoutByDate, getExercisesForWorkout, getSetsForWorkoutExercise,
  getExercises, getCategories, generateId, addWorkout, addWorkoutExercise,
  addWorkoutSet, updateWorkoutSet, deleteWorkoutSet, removeWorkoutExercise,
  getPersonalRecord, updateWorkout, updateWorkoutExercise, getGoalsForExercise,
  getExerciseHistory, getSettings
} from '@/lib/storage';
import { schedulePendingBackup } from '@/lib/autoBackup';
import { toDisplayWeight, toStorageKg, weightUnitLabel } from '@/lib/units';
import { getLastUsedRestSeconds, saveLastUsedRestSeconds } from '@/lib/restTimerState';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import RestTimer from '@/components/RestTimer';
import ExerciseSelectionScreen from '@/components/ExerciseSelectionScreen';
import ExerciseDetailPanel from '@/components/ExerciseDetailPanel';
import DynamicSetInputs, { SetColumnHeaders } from '@/components/DynamicSetInputs';
import ExerciseStatsDialog from '@/components/ExerciseStatsDialog';
import ExerciseGoalsDialog from '@/components/ExerciseGoalsDialog';
import SetRestTimerRow from '@/components/SetRestTimerRow';
import RestTimerEditorSheet from '@/components/RestTimerEditorSheet';
import ExerciseRestTimerSheet from '@/components/ExerciseRestTimerSheet';
import ExerciseTutorialOverlay, { type TutorialStep } from '@/components/ExerciseTutorialOverlay';
import { startRestTimer } from '@/lib/restTimerState';
import type { Workout, WorkoutSet, WorkoutExercise, SetTag } from '@/types/fitness';

const TUTORIAL_STEPS: TutorialStep[] = [
  { selector: '[data-tutorial="exercise-notes"]', title: 'Exercise Notes', text: 'Tap here to add specific notes for this entire exercise.' },
  { selector: '[data-tutorial="exercise-goals"]', title: 'Exercise Goals', text: 'Tap here to set and track specific weight/rep goals for this exercise.' },
  { selector: '[data-tutorial="exercise-stats"]', title: 'Exercise Stats', text: 'Tap here to view your past performance, history, and graphs for this exercise.' },
  { selector: '[data-tutorial="exercise-timer"]', title: 'Global Timer', text: 'Tap here to set a default rest timer that applies to all sets for this exercise.' },
  { selector: '[data-tutorial="set-tag"]', title: 'Set Types', text: 'Tap to cycle between Normal (N), Warmup (W), Dropset (D), and Failure (F).' },
  { selector: '[data-tutorial="set-rest"]', title: 'Set Timer', text: 'Tap to customize the rest time specifically after this individual set.' },
];

export default function WorkoutLogPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const allExercises = useMemo(() => getExercises(), []);
  const categories = useMemo(() => getCategories(), []);
  const globalWeightUnit = getSettings().weightUnit;
  const wuLabel = weightUnitLabel(globalWeightUnit);

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
  const [updateKey, forceUpdate] = useState(0);
  const [noteExpanded, setNoteExpanded] = useState<string | null>(null);
  const [setNoteOpen, setSetNoteOpen] = useState<string | null>(null);
  const [statsExercise, setStatsExercise] = useState<{ id: string; name: string; weightUnit: 'kg' | 'lb' } | null>(null);
  const [goalsExercise, setGoalsExercise] = useState<{ id: string; name: string; weightUnit: 'kg' | 'lb' } | null>(null);

  // Rest timer editor state
  const [restEditorOpen, setRestEditorOpen] = useState(false);
  const [restEditorTarget, setRestEditorTarget] = useState<{ weId: string; setIndex: number; current: number | null } | null>(null);
  const [exerciseTimerSheet, setExerciseTimerSheet] = useState<{ weId: string; exerciseId: string; exerciseName: string; current: number | null } | null>(null);

  const [exercises, setExercisesState] = useState(() => getExercises());

  // Tutorial overlay
  const [tutorialOpen, setTutorialOpen] = useState(false);

  /** Get rest seconds for a specific set: per-set override > exercise default > null */
  const getRestForSet = useCallback((we: WorkoutExercise, setIndex: number): number | null => {
    const sets = getSetsForWorkoutExercise(we.id);
    const set = sets.find(s => s.setIndex === setIndex);
    if (set?.restSeconds != null) return set.restSeconds;
    if (we.defaultRestSeconds != null) return we.defaultRestSeconds;
    return null;
  }, [updateKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    if (workout) {
      setWorkoutExercises(getExercisesForWorkout(workout.id));
      setExercisesState(getExercises());
      forceUpdate(n => n + 1);
    }
  }, [workout]);

  // Trigger tutorial first time an exercise is expanded with a visible set
  useEffect(() => {
    if (tutorialOpen) return;
    if (localStorage.getItem('hasSeenExerciseTutorial') === 'true') return;
    if (!expandedExercise) return;
    const sets = getSetsForWorkoutExercise(expandedExercise);
    if (sets.length === 0) return;
    const t = setTimeout(() => setTutorialOpen(true), 350);
    return () => clearTimeout(t);
  }, [expandedExercise, tutorialOpen]);

  if (!date || !workout) return <div className="p-4">Invalid date</div>;

  const getLastSessionFirstSet = (exerciseId: string) => {
    const history = getExerciseHistory(exerciseId);
    if (history.length === 0) return { weightKg: null, reps: null };
    const lastSession = history[0];
    const firstSet = lastSession.sets[0];
    if (!firstSet) return { weightKg: null, reps: null };
    return { weightKg: firstSet.weightKg ?? null, reps: firstSet.reps ?? null };
  };

  /** Get the exercise's default rest seconds from history or seed data */
  const getExerciseRestDefault = (exerciseId: string): number | null => {
    const lastUsed = getLastUsedRestSeconds(exerciseId);
    if (lastUsed) return lastUsed;
    const ex = allExercises.find(e => e.id === exerciseId);
    return ex?.defaultRestSeconds ?? null;
  };

  const handleAddExercises = (exerciseIds: string[]) => {
    exerciseIds.forEach((exerciseId, i) => {
      const restDefault = getExerciseRestDefault(exerciseId);
      const we: WorkoutExercise = {
        id: generateId(), workoutId: workout.id, exerciseId, position: workoutExercises.length + i, notes: '',
        defaultRestSeconds: restDefault,
      };
      addWorkoutExercise(we);
      const prefill = getLastSessionFirstSet(exerciseId);
      addWorkoutSet({
        id: generateId(), workoutExerciseId: we.id, setIndex: 0,
        weightKg: prefill.weightKg, reps: prefill.reps, distanceKm: null, durationMinutes: null,
        rpe: null, setTag: 'N', isWarmup: false, isCompleted: false, notes: '',
        restSeconds: restDefault,
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
    const we = workoutExercises.find(x => x.id === weId);
    const restSec = we?.defaultRestSeconds ?? null;
    addWorkoutSet({
      id: generateId(), workoutExerciseId: weId, setIndex: sets.length,
      weightKg: null, reps: null, distanceKm: null, durationMinutes: null,
      rpe: null, setTag: 'N', isWarmup: false, isCompleted: false, notes: '',
      restSeconds: restSec,
    });
    forceUpdate(n => n + 1);
  };

  const handleUpdateSet = (s: WorkoutSet, field: keyof WorkoutSet, value: any) => {
    const updated = { ...s, [field]: value };
    updateWorkoutSet(updated);
    forceUpdate(n => n + 1);

    // Auto-start rest timer when completing a set
    if (field === 'isCompleted' && value === true) {
      const we = workoutExercises.find(x => x.id === s.workoutExerciseId);
      if (we) {
        const restSec = updated.restSeconds ?? we.defaultRestSeconds;
        if (restSec && restSec > 0) {
          startRestTimer(we.id, s.setIndex, restSec);
          forceUpdate(n => n + 1);
        }
      }
    }
  };

  const handleDeleteSet = (id: string) => {
    deleteWorkoutSet(id);
    forceUpdate(n => n + 1);
  };

  const handleFinishWorkout = () => {
    // Save last-used rest timers per exercise
    workoutExercises.forEach(we => {
      if (we.defaultRestSeconds && we.defaultRestSeconds > 0) {
        saveLastUsedRestSeconds(we.exerciseId, we.defaultRestSeconds);
      }
    });
    updateWorkout({ ...workout, endTime: new Date().toISOString() });
    schedulePendingBackup();
    navigate('/');
  };

  // Per-set rest timer tap → open exercise-level sheet with full options
  const handleRestTimerTap = (weId: string, _setIndex: number) => {
    const we = workoutExercises.find(x => x.id === weId);
    if (!we) return;
    const exName = getExName(we.exerciseId);
    const current = we.defaultRestSeconds ?? null;
    setExerciseTimerSheet({ weId, exerciseId: we.exerciseId, exerciseName: exName, current });
  };

  // Save per-set rest
  const handleSaveSetRest = (seconds: number) => {
    if (!restEditorTarget) return;
    const sets = getSetsForWorkoutExercise(restEditorTarget.weId);
    const set = sets.find(s => s.setIndex === restEditorTarget.setIndex);
    if (set) {
      updateWorkoutSet({ ...set, restSeconds: seconds });
      refresh();
    }
  };

  // Exercise-level timer actions
  const handleExerciseTimerAction = (action: 'all' | 'future' | 'both' | 'clear', seconds?: number) => {
    if (!exerciseTimerSheet) return;
    const weId = exerciseTimerSheet.weId;
    const we = workoutExercises.find(x => x.id === weId);
    if (!we) return;

    if (action === 'clear') {
      // Clear all set rest overrides and default
      const sets = getSetsForWorkoutExercise(weId);
      sets.forEach(s => updateWorkoutSet({ ...s, restSeconds: null }));
      updateWorkoutExercise({ ...we, defaultRestSeconds: null });
      setWorkoutExercises(prev => prev.map(x => x.id === weId ? { ...x, defaultRestSeconds: null } : x));
    } else {
      if (!seconds) return;
      if (action === 'all' || action === 'both') {
        const sets = getSetsForWorkoutExercise(weId);
        sets.forEach(s => updateWorkoutSet({ ...s, restSeconds: seconds }));
      }
      if (action === 'future' || action === 'both') {
        updateWorkoutExercise({ ...we, defaultRestSeconds: seconds });
        setWorkoutExercises(prev => prev.map(x => x.id === weId ? { ...x, defaultRestSeconds: seconds } : x));
      }
    }
    forceUpdate(n => n + 1);
  };

  const getEx = (exId: string) => exercises.find(e => e.id === exId);
  const getExName = (exId: string) => getEx(exId)?.name ?? 'Unknown';
  const getCatName = (exId: string) => {
    const ex = getEx(exId);
    return ex ? categories.find(c => c.id === ex.categoryId)?.name ?? '' : '';
  };

  return (
    <div className="flex min-h-screen flex-col pb-24">
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

      {/* Workout Comment */}
      <div className="mx-auto w-full max-w-lg px-4 pt-4">
        <Textarea
          placeholder="Add a comment about this workout…"
          value={workout.notes}
          onChange={(e) => {
            const updated = { ...workout, notes: e.target.value };
            setWorkout(updated);
            updateWorkout(updated);
          }}
          className="min-h-[48px] resize-none text-sm bg-secondary/50 border-border/50 placeholder:text-muted-foreground/60"
          rows={2}
        />
      </div>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-4 space-y-3">
        {workoutExercises.map(we => {
          const sets = getSetsForWorkoutExercise(we.id);
          const isExpanded = expandedExercise === we.id;
          const ex = getEx(we.exerciseId);
          const exSetType = ex?.setType ?? 'WEIGHT_REPS';
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
                    <p className="text-[10px] text-gym-pr mt-0.5">PR: {toDisplayWeight(pr.weight, globalWeightUnit)}{wuLabel} × {pr.reps}</p>
                  )}
                </button>
                <button
                  onClick={() => setNoteExpanded(noteExpanded === we.id ? null : we.id)}
                  className={`p-1 transition-colors ${we.notes ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  title="Exercise note"
                >
                  <StickyNote className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setGoalsExercise({ id: we.exerciseId, name: getExName(we.exerciseId), weightUnit: ex?.weightUnit ?? 'kg' })}
                  className={`p-1 transition-colors ${getGoalsForExercise(we.exerciseId).length > 0 ? 'text-purple-500' : 'text-muted-foreground hover:text-foreground'}`}
                  title="Exercise goals"
                >
                  <Trophy className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setStatsExercise({ id: we.exerciseId, name: getExName(we.exerciseId), weightUnit: ex?.weightUnit ?? 'kg' })}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  title="Exercise stats"
                >
                  <BarChart3 className="h-4 w-4" />
                </button>
                {/* Exercise-level rest timer icon */}
                <button
                  onClick={() => setExerciseTimerSheet({
                    weId: we.id,
                    exerciseId: we.exerciseId,
                    exerciseName: getExName(we.exerciseId),
                    current: we.defaultRestSeconds ?? null,
                  })}
                  className={`p-1 transition-colors ${we.defaultRestSeconds ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  title="Set rest timer for exercise"
                >
                  <Timer className="h-4 w-4" />
                </button>
                <button onClick={() => handleRemoveExercise(we.id)} className="p-1 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {noteExpanded === we.id && (
                <div className="mb-2 animate-slide-up">
                  <Textarea
                    placeholder="Add a note for this exercise…"
                    value={we.notes}
                    onChange={(e) => {
                      const updated = { ...we, notes: e.target.value };
                      updateWorkoutExercise(updated);
                      setWorkoutExercises(prev => prev.map(x => x.id === we.id ? updated : x));
                    }}
                    className="min-h-[40px] resize-none text-xs bg-secondary/50 border-border/50 placeholder:text-muted-foreground/60"
                    rows={2}
                  />
                </div>
              )}

              {isExpanded && (
                <div className="space-y-2 animate-slide-up">
                  <ExerciseDetailPanel
                    exerciseId={we.exerciseId}
                    exerciseName={getExName(we.exerciseId)}
                    weightUnit={ex?.weightUnit ?? 'kg'}
                    refreshKey={updateKey}
                    onPrefill={(weight, reps) => {
                      const currentSets = getSetsForWorkoutExercise(we.id);
                      const lastSet = currentSets[currentSets.length - 1];
                      if (lastSet && !lastSet.isCompleted && lastSet.weightKg === null) {
                        handleUpdateSet(lastSet, 'weightKg', weight);
                        handleUpdateSet({ ...lastSet, weightKg: weight }, 'reps', reps);
                      } else {
                        addWorkoutSet({
                          id: generateId(), workoutExerciseId: we.id, setIndex: currentSets.length,
                          weightKg: weight, reps, distanceKm: null, durationMinutes: null,
                          rpe: null, setTag: 'N', isWarmup: false, isCompleted: false, notes: '',
                          restSeconds: we.defaultRestSeconds ?? null,
                        });
                        forceUpdate(n => n + 1);
                      }
                    }}
                  />
                  {/* Dynamic Headers */}
                  <div className="grid gap-1 text-[10px] uppercase text-muted-foreground font-medium px-1" style={{ gridTemplateColumns: '1.2rem 1rem 1.8rem 0.5rem 1fr 1fr minmax(2rem,0.8fr) 1rem' }}>
                    <div>Set</div>
                    <div></div>
                    <div>Type</div>
                    <div></div>
                    <SetColumnHeaders setType={exSetType} weightUnit={globalWeightUnit} />
                    <div></div>
                  </div>

                  {sets.map((s, idx) => {
                    const tag = s.setTag ?? 'N';
                    const tagColors: Record<SetTag, string> = {
                      N: 'bg-secondary text-muted-foreground',
                      W: 'bg-yellow-500/20 text-yellow-500',
                      D: 'bg-blue-500/20 text-blue-500',
                      F: 'bg-red-500/20 text-red-500',
                    };
                    const nextTag: Record<SetTag, SetTag> = { N: 'W', W: 'D', D: 'F', F: 'N' };
                    const restSec = s.restSeconds ?? we.defaultRestSeconds ?? null;

                    return (
                    <div key={s.id}>
                      <div className={`grid gap-1 items-center px-1 py-1 rounded-lg transition-colors`} style={{ gridTemplateColumns: '1.2rem 1rem 1.8rem 0.5rem 1fr 1fr minmax(2rem,0.8fr) 1rem' }}>
                        <div className="text-xs text-muted-foreground">{s.setIndex + 1}</div>
                        <div className="flex justify-center">
                          <button
                            onClick={() => setSetNoteOpen(setNoteOpen === s.id ? null : s.id)}
                            className={`p-0.5 transition-colors ${s.notes ? 'text-primary' : 'text-muted-foreground/40 hover:text-foreground'}`}
                            title="Set note"
                          >
                            <StickyNote className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="flex justify-center">
                          <button
                            onClick={() => handleUpdateSet(s, 'setTag', nextTag[tag])}
                            className={`h-6 w-6 rounded text-[10px] font-bold flex items-center justify-center transition-colors ${tagColors[tag]}`}
                            title={tag === 'N' ? 'Normal' : tag === 'W' ? 'Warmup' : tag === 'D' ? 'Dropset' : 'Failure'}
                          >
                            {tag === 'N' ? '–' : tag}
                          </button>
                        </div>
                        <div></div>
                        <DynamicSetInputs
                          set={s}
                          setType={exSetType}
                          weightUnit={globalWeightUnit}
                          onUpdate={(field, value) => handleUpdateSet(s, field, value)}
                        />
                        <div className="flex justify-center">
                          <button onClick={() => handleDeleteSet(s.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      {setNoteOpen === s.id && (
                        <div className="ml-6 mr-1 mt-1 mb-1 animate-slide-up">
                          <Textarea
                            placeholder="Add a note for this set…"
                            value={s.notes}
                            onChange={(e) => {
                              handleUpdateSet(s, 'notes', e.target.value);
                            }}
                            className="min-h-[36px] resize-none text-xs bg-secondary/50 border-border/50 placeholder:text-muted-foreground/60"
                            rows={1}
                          />
                        </div>
                      )}
                      {/* Rest timer separator between/after sets */}
                      <SetRestTimerRow
                        key={`rest-${s.id}-${restSec}`}
                        workoutExerciseId={we.id}
                        afterSetIndex={s.setIndex}
                        restSeconds={restSec}
                        onTap={() => handleRestTimerTap(we.id, s.setIndex)}
                      />
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
                  {we.defaultRestSeconds && <span>• {Math.floor(we.defaultRestSeconds / 60)}:{(we.defaultRestSeconds % 60).toString().padStart(2, '0')} rest</span>}
                </div>
              )}
            </div>
          );
        })}

        {/* Workout Totals */}
        {workoutExercises.length > 0 && (() => {
          let totalVolume = 0, totalReps = 0, totalDistanceKm = 0, totalDurationMin = 0;
          let hasStrength = false, hasCardio = false;
          workoutExercises.forEach(we => {
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
          const displayVolume = toDisplayWeight(totalVolume, globalWeightUnit);
          return (hasStrength || hasCardio) ? (
            <div className="gym-card flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
              {hasStrength && (
                <>
                  <span>Total Volume: <span className="font-semibold text-foreground">{displayVolume?.toLocaleString()} {wuLabel}</span></span>
                  <span>Total Reps: <span className="font-semibold text-foreground">{totalReps}</span></span>
                </>
              )}
              {hasCardio && (
                <>
                  <span>Total Distance: <span className="font-semibold text-foreground">{totalDistanceKm.toFixed(2)} km</span></span>
                  <span>Total Duration: <span className="font-semibold text-foreground">{totalDurationMin.toFixed(0)} min</span></span>
                </>
              )}
            </div>
          ) : null;
        })()}

        {/* Add Exercise Button */}
        <button
          onClick={() => setShowAddExercise(true)}
          className="w-full gym-card flex items-center justify-center gap-2 py-4 text-sm font-medium text-primary border-dashed border-2 border-primary/30 hover:border-primary/50 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Exercise
        </button>

        {/* Dialogs */}
        <Dialog open={showAddExercise} onOpenChange={setShowAddExercise}>
          <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
            <DialogHeader><DialogTitle>Add Exercise</DialogTitle></DialogHeader>
            <ExerciseSelectionScreen
              onSelect={handleAddExercises}
              onClose={() => setShowAddExercise(false)}
            />
          </DialogContent>
        </Dialog>
        {statsExercise && (
          <ExerciseStatsDialog
            open={!!statsExercise}
            onOpenChange={(open) => !open && setStatsExercise(null)}
            exerciseId={statsExercise.id}
            exerciseName={statsExercise.name}
            weightUnit={statsExercise.weightUnit}
          />
        )}
        {goalsExercise && (
          <ExerciseGoalsDialog
            open={!!goalsExercise}
            onOpenChange={(open) => !open && setGoalsExercise(null)}
            exerciseId={goalsExercise.id}
            exerciseName={goalsExercise.name}
            weightUnit={goalsExercise.weightUnit}
          />
        )}

        {/* Exercise-level rest timer sheet (used for both per-set tap and exercise header) */}

        {/* Exercise-level rest timer sheet */}
        {exerciseTimerSheet && (
          <ExerciseRestTimerSheet
            open={!!exerciseTimerSheet}
            onOpenChange={(open) => !open && setExerciseTimerSheet(null)}
            exerciseName={exerciseTimerSheet.exerciseName}
            currentDefault={exerciseTimerSheet.current}
            onAction={handleExerciseTimerAction}
          />
        )}
      </div>
    </div>
  );
}
