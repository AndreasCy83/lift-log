import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Timer, StickyNote, BarChart3, Trophy, CopyPlus, Check, Pause, Play } from 'lucide-react';
import { format } from 'date-fns';
import {
  getWorkoutByDate, getExercisesForWorkout, getSetsForWorkoutExercise,
  getExercises, getCategories, generateId, addWorkout, addWorkoutExercise,
  addWorkoutSet, updateWorkoutSet, deleteWorkoutSet, removeWorkoutExercise,
  getPersonalRecord, updateWorkout, updateWorkoutExercise, getGoalsForExercise,
  getExerciseHistory, getSettings, getWorkoutSets, saveWorkoutSets, getWorkouts,
  reorderWorkoutExercises, markGoalAcknowledged
} from '@/lib/storage';
import { getRoutines, getPrograms } from '@/lib/storage';
import { appendRoutineToWorkout } from '@/lib/routineRunner';
import { detectNewlyCompletedGoals } from '@/lib/goalProgress';
import GoalCelebrationModal from '@/components/workout/GoalCelebrationModal';
import {
  DndContext, MouseSensor, TouchSensor, useSensor, useSensors,
  closestCenter, type DragEndEvent, type DragStartEvent
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SupportModal from '@/components/SupportModal';
import { incrementWorkoutCount, shouldShowReview, requestReview } from '@/lib/rateApp';


function isSupportMilestone(count: number): boolean {
  if (count === 10 || count === 30 || count === 40) return true;
  if (count > 40 && count % 40 === 0) return true;
  return false;
}
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import FloatingRestTimer from '@/components/FloatingRestTimer';
import { startRestTimer, clearAllTimersForExercise, getActiveTimers, clearAllRestTimers } from '@/lib/restTimerState';
import RestTimerNative from '@/lib/RestTimerNative';
import { stopAllCues } from '@/lib/ttsVoice';
import { isMeaningfulPendingSet, getMissingRequiredFields } from '@/lib/setCompletion';

import type { Workout, WorkoutSet, WorkoutExercise, SetTag, SetType } from '@/types/fitness';
import { useWorkoutSession } from '@/hooks/useWorkoutSession';
import { formatHMS } from '@/lib/workoutSession';
import LeaveWorkoutDialog, { type LeaveAction } from '@/components/LeaveWorkoutDialog';
import { REQUEST_LEAVE_WORKOUT_EVENT } from '@/components/BottomNav';
import WorkoutCelebrationModal from '@/components/workout/WorkoutCelebrationModal';

const TUTORIAL_STEPS: TutorialStep[] = [
  { selector: '[data-tutorial="exercise-notes"]', title: 'Exercise Notes', text: 'Tap here to add specific notes for this entire exercise.' },
  { selector: '[data-tutorial="exercise-goals"]', title: 'Exercise Goals', text: 'Tap here to set and track specific weight/rep goals for this exercise.' },
  { selector: '[data-tutorial="exercise-stats"]', title: 'Exercise Stats', text: 'Tap here to view your past performance, history, and graphs for this exercise.' },
  { selector: '[data-tutorial="exercise-timer"]', title: 'Global Timer', text: 'Tap here to set a default rest timer that applies to all sets for this exercise.' },
  { selector: '[data-tutorial="set-tag"]', title: 'Set Types', text: 'Tap to cycle between Normal (N), Warmup (W), Dropset (D), and Failure (F).' },
  { selector: '[data-tutorial="set-rest"]', title: 'Set Timer', text: 'Tap to customize the rest time specifically after this individual set.' },
];

function SortableExerciseCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? 'relative' : undefined,
    boxShadow: isDragging ? '0 12px 30px hsl(var(--background) / 0.6)' : undefined,
    scale: isDragging ? '1.02' : undefined,
    touchAction: isDragging ? 'none' : 'auto',
  };
  return (
    <div ref={setNodeRef} style={style} className="gym-card" {...attributes} {...listeners}>
      {children}
    </div>
  );
}

export default function WorkoutLogPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const allExercises = useMemo(() => getExercises(), []);
  const categories = useMemo(() => getCategories(), []);
  const globalWeightUnit = getSettings().weightUnit;
  const wuLabel = weightUnitLabel(globalWeightUnit);

  // Track whether this page just created the workout (fresh "+ Start Workout")
  // vs opened an existing saved day. Existing days should NOT auto-start the
  // live timer; they show the saved duration in a compact restored format.
  const freshWorkoutRef = (useMemo(() => ({ value: false }), []));
  const [workout, setWorkout] = useState<Workout | null>(() => {
    if (!date) return null;
    let w = getWorkoutByDate(date);
    if (!w) {
      w = { id: generateId(), date, startTime: new Date().toISOString(), endTime: null, notes: '', source: 'manual', sourceRoutineId: null };
      addWorkout(w);
      freshWorkoutRef.value = true;
    }
    return w;
  });
  const isFreshWorkout = freshWorkoutRef.value;

  const [workoutExercises, setWorkoutExercises] = useState(() =>
    workout ? getExercisesForWorkout(workout.id) : []
  );
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showRoutinePicker, setShowRoutinePicker] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const [updateKey, forceUpdate] = useState(0);
  const [noteExpanded, setNoteExpanded] = useState<string | null>(null);
  const [setNoteOpen, setSetNoteOpen] = useState<string | null>(null);
  const [statsExercise, setStatsExercise] = useState<{ id: string; name: string; weightUnit: 'kg' | 'lb' } | null>(null);
  const [goalsExercise, setGoalsExercise] = useState<{ id: string; name: string; weightUnit: 'kg' | 'lb'; initialAdding?: boolean; initialGoalType?: import('@/types/fitness').GoalType } | null>(null);
  const [completedGoalQueue, setCompletedGoalQueue] = useState<import('@/lib/goalProgress').CompletedGoal[]>([]);

  // Rest timer editor state
  const [restEditorOpen, setRestEditorOpen] = useState(false);
  const [restEditorTarget, setRestEditorTarget] = useState<{ weId: string; setIndex: number; current: number | null } | null>(null);
  const [exerciseTimerSheet, setExerciseTimerSheet] = useState<{ weId: string; exerciseId: string; exerciseName: string; current: number | null } | null>(null);

  const [exercises, setExercisesState] = useState(() => getExercises());

  // Tutorial overlay
  const [tutorialOpen, setTutorialOpen] = useState(false);

  // Repeat-last-routine confirmation state
  const [repeatTarget, setRepeatTarget] = useState<{ weId: string; exerciseId: string } | null>(null);
  const [deleteSetTarget, setDeleteSetTarget] = useState<string | null>(null);

  // Post-workout celebration modal
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportCount, setSupportCount] = useState(0);
  // Warning shown when user taps Finish but has meaningful pending (untoggled) sets.
  const [incompleteWarnOpen, setIncompleteWarnOpen] = useState(false);

  // Live workout session timer (independent from rest timer)
  const session = useWorkoutSession(workout?.id ?? null);
  const [pendingNav, setPendingNav] = useState<string | null>(null);

  // Drag-and-drop sensors: short long-press for touch so vertical scrolling still works.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 280, tolerance: 8 } })
  );
  const handleDragStart = useCallback((_e: DragStartEvent) => {
    try {
      // Capacitor haptics if available, else web vibration
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (w?.Capacitor?.Plugins?.Haptics?.impact) {
        w.Capacitor.Plugins.Haptics.impact({ style: 'MEDIUM' });
      } else if (navigator.vibrate) {
        navigator.vibrate(20);
      }
    } catch { /* noop */ }
  }, []);
  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id || !workout) return;
    setWorkoutExercises(prev => {
      const oldIdx = prev.findIndex(x => x.id === active.id);
      const newIdx = prev.findIndex(x => x.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return prev;
      const next = arrayMove(prev, oldIdx, newIdx).map((we, i) => ({ ...we, position: i }));
      reorderWorkoutExercises(workout.id, next.map(x => x.id));
      return next;
    });
  }, [workout]);


  // Auto-start the session ONLY when this is a freshly started workout
  // (user just pressed "+ Start Workout"). Reopening an existing saved day
  // should not auto-spawn a live timer — it shows the restored summary instead.
  useEffect(() => {
    if (!workout?.id) return;
    if (workout.endTime) return; // already finished — no live timer
    if (!isFreshWorkout) return;
    if (!session.session) session.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout?.id, workout?.endTime, isFreshWorkout]);

  // One-time: silently acknowledge already-completed goals so we don't surface old ones.
  useEffect(() => {
    if (localStorage.getItem('goalCelebrationBackfill_v1')) return;
    detectNewlyCompletedGoals().forEach(c => markGoalAcknowledged(c.goal.id));
    localStorage.setItem('goalCelebrationBackfill_v1', 'true');
  }, []);

  useEffect(() => {
    const onLeaveReq = (e: Event) => {
      const target = (e as CustomEvent).detail?.target as string | undefined;
      if (target) setPendingNav(target);
    };
    window.addEventListener(REQUEST_LEAVE_WORKOUT_EVENT, onLeaveReq);
    return () => window.removeEventListener(REQUEST_LEAVE_WORKOUT_EVENT, onLeaveReq);
  }, []);

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
    // Manual add path: only auto-fill the first set from previous entry when this workout
    // is manual. Routine-created workouts must NOT receive manual autofill on top.
    const isRoutineWorkout = workout.source === 'routine';
    exerciseIds.forEach((exerciseId, i) => {
      const restDefault = getExerciseRestDefault(exerciseId);
      const we: WorkoutExercise = {
        id: generateId(), workoutId: workout.id, exerciseId, position: workoutExercises.length + i, notes: '',
        defaultRestSeconds: restDefault,
      };
      addWorkoutExercise(we);
      const prefill = isRoutineWorkout ? { weightKg: null, reps: null } : getLastSessionFirstSet(exerciseId);
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
    // If the active rest timer belongs to this exercise, stop it.
    const active = getActiveTimers().find(t => t.workoutExerciseId === weId);
    if (active) {
      RestTimerNative.stopTimer().catch(() => {});
    }
    clearAllTimersForExercise(weId);
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

  const handleDuplicateLastSet = (weId: string) => {
    const sets = getSetsForWorkoutExercise(weId);
    if (sets.length === 0) return;
    const last = sets[sets.length - 1];
    addWorkoutSet({
      id: generateId(),
      workoutExerciseId: weId,
      setIndex: sets.length,
      weightKg: last.weightKg,
      reps: last.reps,
      distanceKm: last.distanceKm,
      durationMinutes: last.durationMinutes,
      rpe: null,
      setTag: last.setTag ?? 'N',
      isWarmup: false,
      isCompleted: false,
      notes: '',
      restSeconds: last.restSeconds ?? null,
    });
    forceUpdate(n => n + 1);
    toast('Last set duplicated');
  };

  /** Has the user entered any meaningful data in the current exercise's sets? */
  const hasEnteredSetData = (weId: string): boolean => {
    const sets = getSetsForWorkoutExercise(weId);
    return sets.some(s =>
      (typeof s.weightKg === 'number' && s.weightKg > 0) ||
      (typeof s.reps === 'number' && s.reps > 0) ||
      (typeof s.distanceKm === 'number' && s.distanceKm > 0) ||
      (typeof s.durationMinutes === 'number' && s.durationMinutes > 0) ||
      s.isCompleted ||
      (s.setTag && s.setTag !== 'N')
    );
  };

  /** Returns the previous session sets for this exercise, excluding the current workout. */
  const getPreviousSessionSets = (exerciseId: string): WorkoutSet[] | null => {
    const history = getExerciseHistory(exerciseId).filter(h => h.date !== date);
    if (history.length === 0) return null;
    return history[0].sets;
  };

  const performRepeatLastRoutine = (weId: string, exerciseId: string) => {
    const prev = getPreviousSessionSets(exerciseId);
    if (!prev || prev.length === 0) return;
    // Replace all sets for this exercise with new copies based on previous session
    const all = getWorkoutSets().filter(s => s.workoutExerciseId !== weId);
    const newSets: WorkoutSet[] = prev.map((s, i) => ({
      id: generateId(),
      workoutExerciseId: weId,
      setIndex: i,
      weightKg: s.weightKg ?? null,
      reps: s.reps ?? null,
      distanceKm: s.distanceKm ?? null,
      durationMinutes: s.durationMinutes ?? null,
      rpe: null,
      setTag: s.setTag ?? 'N',
      isWarmup: false,
      isCompleted: false,
      notes: '',
      restSeconds: s.restSeconds ?? null,
    }));
    saveWorkoutSets([...all, ...newSets]);
    forceUpdate(n => n + 1);
    toast('Previous routine loaded');
  };

  const handleRepeatLastRoutine = (weId: string, exerciseId: string) => {
    if (hasEnteredSetData(weId)) {
      setRepeatTarget({ weId, exerciseId });
    } else {
      performRepeatLastRoutine(weId, exerciseId);
    }
  };

  const checkGoalCompletions = useCallback(() => {
    const found = detectNewlyCompletedGoals();
    if (found.length === 0) return;
    setCompletedGoalQueue(prev => {
      const existing = new Set(prev.map(c => c.goal.id));
      const toAdd = found.filter(c => !existing.has(c.goal.id));
      return toAdd.length ? [...prev, ...toAdd] : prev;
    });
  }, []);

  const handleUpdateSet = (s: WorkoutSet, field: keyof WorkoutSet, value: any) => {
    const updated = { ...s, [field]: value };
    updateWorkoutSet(updated);
    forceUpdate(n => n + 1);
    checkGoalCompletions();
  };

  /** Explicit toggle handler for set completion check. Only starts rest timer on incomplete -> complete transition, when setting is enabled. */
  const handleToggleSetComplete = (s: WorkoutSet, setType: SetType | undefined) => {
    const wasCompleted = !!s.isCompleted;
    const nextCompleted = !wasCompleted;

    // Block toggling ON when required fields are missing (RPE never required).
    if (!wasCompleted && nextCompleted) {
      const missing = getMissingRequiredFields(s, setType);
      if (missing.length > 0) {
        const msg =
          missing.length === 1
            ? `Enter ${missing[0]} before completing this set`
            : `Enter ${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]} before completing this set`;
        toast.error(msg);
        // Try to focus the first missing field within this set's row.
        try {
          const placeholderMap: Record<string, string[]> = {
            weight: ['kg', 'lb', 'lbs'],
            reps: ['Reps'],
            distance: ['km'],
            duration: ['Sec', 'Min'],
          };
          const wanted = placeholderMap[missing[0]] ?? [];
          const row = document.querySelector<HTMLElement>(`[data-set-id="${s.id}"]`);
          const inputs = (row ?? document).querySelectorAll<HTMLInputElement>('input');
          for (const inp of Array.from(inputs)) {
            if (wanted.some(p => (inp.placeholder || '').toLowerCase().includes(p.toLowerCase()))) {
              inp.focus();
              break;
            }
          }
        } catch {}
        return;
      }
    }

    const updated = { ...s, isCompleted: nextCompleted };
    updateWorkoutSet(updated);
    forceUpdate(n => n + 1);
    checkGoalCompletions();

    if (!wasCompleted && nextCompleted) {
      const settings = getSettings();
      if (!settings.autoStartRestTimer) return;
      const we = workoutExercises.find(x => x.id === s.workoutExerciseId);
      if (!we) return;
      const restSec = updated.restSeconds ?? we.defaultRestSeconds ?? null;
      if (restSec && restSec > 0) {
        startRestTimer(we.id, s.setIndex, restSec);
        RestTimerNative.startTimer({ seconds: restSec }).catch(() => {});
        forceUpdate(n => n + 1);
      }
    }
  };

  const handleDeleteSet = (id: string) => {
    const allSets = getWorkoutSets();
    const target = allSets.find(s => s.id === id);
    const weId = target?.workoutExerciseId;
    deleteWorkoutSet(id);
    if (weId) {
      const remaining = getSetsForWorkoutExercise(weId);
      remaining.forEach((s, i) => {
        if (s.setIndex !== i) updateWorkoutSet({ ...s, setIndex: i });
      });
    }
    forceUpdate(n => n + 1);
  };

  const performFinishWorkout = () => {
    // Save last-used rest timers per exercise
    workoutExercises.forEach(we => {
      if (we.defaultRestSeconds && we.defaultRestSeconds > 0) {
        saveLastUsedRestSeconds(we.exerciseId, we.defaultRestSeconds);
      }
    });
    // Stop and clear ALL active rest timers — none should keep running after finish.
    clearAllRestTimers();
    RestTimerNative.stopTimer().catch(() => {});
    // Cancel any pending / playing voice cues + finish beeps so they don't
    // continue after the workout ends.
    stopAllCues();
    // Finalize the live workout session timer (independent from rest timer)
    const elapsedSec = session.end();
    updateWorkout({
      ...workout,
      endTime: new Date().toISOString(),
      durationSeconds: elapsedSec ?? workout.durationSeconds ?? null,
    });
    schedulePendingBackup();
    // Check workout milestone for Support modal (read directly from store)
    const totalWorkouts = getWorkouts().filter(w => w.endTime).length;
    if (isSupportMilestone(totalWorkouts)) {
      setSupportCount(totalWorkouts);
    }
    // Open the celebration modal; navigation happens when user closes it.
    setCelebrationOpen(true);
  };

  const handleFinishWorkout = () => {
    // Detect meaningful untoggled sets (drafts with empty weight/reps are ignored).
    let hasPending = false;
    for (const we of workoutExercises) {
      const ex = allExercises.find(e => e.id === we.exerciseId);
      const sets = getSetsForWorkoutExercise(we.id);
      if (sets.some(s => isMeaningfulPendingSet(s, ex?.setType))) {
        hasPending = true;
        break;
      }
    }
    if (hasPending) {
      setIncompleteWarnOpen(true);
      return;
    }
    performFinishWorkout();
  };

  /** Intercept any in-app navigation away from this page while the timer is live. */
  const requestLeave = (target: string) => {
    if (session.isRunning || session.isPaused) {
      setPendingNav(target);
    } else {
      navigate(target);
    }
  };

  const handleLeaveAction = (action: LeaveAction) => {
    const target = pendingNav;
    if (action === 'cancel') { setPendingNav(null); return; }
    if (action === 'pause') session.pause();
    else if (action === 'end') {
      const elapsedSec = session.end();
      if (workout) {
        updateWorkout({
          ...workout,
          endTime: new Date().toISOString(),
          durationSeconds: elapsedSec ?? workout.durationSeconds ?? null,
        });
      }
    }
    // 'keep' → leave the timer running as-is
    setPendingNav(null);
    if (target) navigate(target);
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
    <div className="flex min-h-screen flex-col" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 7rem)' }}>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-2">
          <button onClick={() => requestLeave('/')} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-base font-bold leading-tight truncate">Workout</h1>
            <p className="text-[11px] text-muted-foreground leading-tight truncate">{format(new Date(date), 'EEE, MMM d')}</p>
          </div>
          {/* Live workout session timer (independent from rest timer) */}
          {(session.isRunning || session.isPaused) ? (
            <div className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-mono tabular-nums ${session.isPaused ? 'border-muted-foreground/40 text-muted-foreground' : 'border-primary/40 text-primary'}`}>
              <Timer className="h-3.5 w-3.5" />
              <span>{formatHMS(session.elapsedSec)}</span>
              <button
                onClick={() => (session.isRunning ? session.pause() : session.resume())}
                className="ml-0.5 rounded p-0.5 hover:bg-secondary"
                title={session.isRunning ? 'Pause workout timer' : 'Resume workout timer'}
                aria-label={session.isRunning ? 'Pause workout timer' : 'Resume workout timer'}
              >
                {session.isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
            </div>
          ) : (!isFreshWorkout && typeof workout.durationSeconds === 'number' && workout.durationSeconds > 0) ? (
            // Restored existing-day view: compact timer display + play to resume.
            <div className="flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs font-mono tabular-nums text-muted-foreground">
              <Timer className="h-3.5 w-3.5" />
              <span>{formatHMS(workout.durationSeconds)}</span>
              <button
                onClick={() => session.start(workout.durationSeconds ?? 0)}
                className="ml-0.5 rounded p-0.5 hover:bg-secondary"
                title="Resume workout timer"
                aria-label="Resume workout timer"
              >
                <Play className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs font-mono tabular-nums text-muted-foreground">
              <Timer className="h-3.5 w-3.5" />
              <span>00:00:00</span>
              <button
                onClick={() => session.start(0)}
                className="ml-0.5 rounded p-0.5 hover:bg-secondary"
                title="Start workout timer"
                aria-label="Start workout timer"
              >
                <Play className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <Button size="sm" variant="ghost" onClick={() => setShowTimer(!showTimer)} className="text-primary px-2" title="Rest timer">
            <Timer className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={handleFinishWorkout} className="rounded-full bg-primary text-primary-foreground">
            Finish
          </Button>
        </div>
      </header>

      <LeaveWorkoutDialog open={pendingNav !== null} onAction={handleLeaveAction} />

      <AlertDialog open={incompleteWarnOpen} onOpenChange={setIncompleteWarnOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Incomplete Sets Remaining</AlertDialogTitle>
            <AlertDialogDescription>
              Some sets are not marked as completed yet. Do you want to finish the workout anyway or return and complete them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIncompleteWarnOpen(false)}>
              Complete Exercises
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setIncompleteWarnOpen(false); performFinishWorkout(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Finish Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          className="min-h-[36px] resize-none text-sm bg-secondary/50 border-border/50 placeholder:text-muted-foreground/60 py-1.5"
          rows={1}
        />
      </div>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-4 space-y-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <SortableContext items={workoutExercises.map(w => w.id)} strategy={verticalListSortingStrategy}>
        {workoutExercises.map((we) => {
          const isTutorialTarget = expandedExercise === we.id;
          const sets = getSetsForWorkoutExercise(we.id);
          const isExpanded = expandedExercise === we.id;
          const ex = getEx(we.exerciseId);
          const exSetType = ex?.setType ?? 'WEIGHT_REPS';
          const pr = getPersonalRecord(we.exerciseId);

          return (
            <SortableExerciseCard key={we.id} id={we.id}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <button onClick={() => setExpandedExercise(isExpanded ? null : we.id)} className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-semibold truncate">{getExName(we.exerciseId)}</span>
                    <span className="text-[10px] rounded-full bg-secondary px-2 py-0.5 text-muted-foreground shrink-0">{getCatName(we.exerciseId)}</span>
                  </div>
                  {pr && (
                    <p className="text-[10px] text-gym-pr mt-0.5">PR: {toDisplayWeight(pr.weight, globalWeightUnit)}{wuLabel} × {pr.reps}</p>
                  )}
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setNoteExpanded(noteExpanded === we.id ? null : we.id)}
                    className={`h-9 w-9 inline-flex items-center justify-center rounded-md bg-secondary/60 hover:bg-secondary transition-colors ${we.notes ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    title="Exercise note"
                    data-tutorial={isTutorialTarget ? 'exercise-notes' : undefined}
                  >
                    <StickyNote className="h-[18px] w-[18px]" />
                  </button>
                  <button
                    onClick={() => setGoalsExercise({ id: we.exerciseId, name: getExName(we.exerciseId), weightUnit: ex?.weightUnit ?? 'kg' })}
                    className={`h-9 w-9 inline-flex items-center justify-center rounded-md bg-secondary/60 hover:bg-secondary transition-colors ${getGoalsForExercise(we.exerciseId).length > 0 ? 'text-purple-500' : 'text-muted-foreground hover:text-foreground'}`}
                    title="Exercise goals"
                    data-tutorial={isTutorialTarget ? 'exercise-goals' : undefined}
                  >
                    <Trophy className="h-[18px] w-[18px]" />
                  </button>
                  <button
                    onClick={() => setStatsExercise({ id: we.exerciseId, name: getExName(we.exerciseId), weightUnit: ex?.weightUnit ?? 'kg' })}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    title="Exercise stats"
                    data-tutorial={isTutorialTarget ? 'exercise-stats' : undefined}
                  >
                    <BarChart3 className="h-[18px] w-[18px]" />
                  </button>
                  <button
                    onClick={() => handleRemoveExercise(we.id)}
                    className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                    title="Remove exercise"
                  >
                    <Trash2 className="h-[18px] w-[18px]" />
                  </button>
                </div>
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
                    onRepeatLastRoutine={
                      getPreviousSessionSets(we.exerciseId)
                        ? () => handleRepeatLastRoutine(we.id, we.exerciseId)
                        : undefined
                    }
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
                  <div className="grid gap-1 text-[10px] uppercase text-muted-foreground font-medium px-1 [&>div]:text-center" style={{ gridTemplateColumns: '1.2rem 1rem 1.8rem 0.35rem minmax(0,3.1rem) minmax(0,3.1rem) minmax(0,2.4rem) 0.4rem 1.6rem 1.25rem 2rem' }}>
                    <div>Set</div>
                    <div></div>
                    <div>Type</div>
                    <div></div>
                    <SetColumnHeaders setType={exSetType} weightUnit={globalWeightUnit} />
                    <div></div>
                    <div></div>
                    <div></div>
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
                    <div key={s.id} data-set-id={s.id}>
                      <div className={`grid gap-1 items-center px-1 py-1 rounded-lg transition-colors ${s.isCompleted ? 'bg-green-500/5' : ''}`} style={{ gridTemplateColumns: '1.2rem 1rem 1.8rem 0.35rem minmax(0,3.1rem) minmax(0,3.1rem) minmax(0,2.4rem) 0.4rem 1.6rem 1.25rem 2rem' }}>
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
                            data-tutorial={isTutorialTarget && idx === 0 ? 'set-tag' : undefined}
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
                        <div></div>
                        <div className="flex justify-center">
                          <button
                            onClick={() => handleToggleSetComplete(s, exSetType)}
                            aria-pressed={s.isCompleted}
                            title={s.isCompleted ? 'Mark set incomplete' : 'Mark set complete'}
                            className={`h-6 w-6 rounded-full flex items-center justify-center border transition-colors ${
                              s.isCompleted
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-muted-foreground/40 text-transparent hover:border-foreground hover:text-muted-foreground/60'
                            }`}
                          >
                            <Check className="h-3 w-3" strokeWidth={3} />
                          </button>
                        </div>
                        <div></div>
                        <div className="flex justify-end">
                          <button
                            onClick={() => setDeleteSetTarget(s.id)}
                            className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 active:bg-destructive/20 transition-colors"
                            title="Delete set"
                            aria-label="Delete set"
                          >
                            <Trash2 className="h-4 w-4" />
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
                      <div data-tutorial={isTutorialTarget && idx === 0 ? 'set-rest' : undefined}>
                        <SetRestTimerRow
                          key={`rest-${s.id}-${restSec}`}
                          workoutExerciseId={we.id}
                          afterSetIndex={s.setIndex}
                          restSeconds={restSec}
                          onTap={() => handleRestTimerTap(we.id, s.setIndex)}
                        />
                      </div>
                    </div>
                    );
                  })}

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleAddSet(we.id)} className="flex-1 min-w-[7rem] text-xs text-primary">
                      <Plus className="h-3 w-3 mr-1" /> Add Set
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDuplicateLastSet(we.id)}
                      disabled={sets.length === 0}
                      className="flex-1 min-w-[7rem] text-xs text-muted-foreground hover:text-foreground"
                    >
                      <CopyPlus className="h-3 w-3 mr-1" /> Duplicate Last Set
                    </Button>
                  </div>
                </div>
              )}

              {!isExpanded && (
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span>{sets.length} sets</span>
                  {we.defaultRestSeconds && <span>• {Math.floor(we.defaultRestSeconds / 60)}:{(we.defaultRestSeconds % 60).toString().padStart(2, '0')} rest</span>}
                </div>
              )}
            </SortableExerciseCard>
          );
        })}
          </SortableContext>
        </DndContext>


        {/* Workout Totals */}
        {workoutExercises.length > 0 && (() => {
          let totalVolume = 0, totalReps = 0, totalDistanceKm = 0, totalDurationMin = 0;
          let hasStrength = false, hasCardio = false;
          workoutExercises.forEach(we => {
            const ex = allExercises.find(e => e.id === we.exerciseId);
            const sets = getSetsForWorkoutExercise(we.id).filter(s => !s.isWarmup && s.isCompleted === true);
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

        {/* Routines Button (secondary) */}
        <button
          onClick={() => setShowRoutinePicker(true)}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-muted-foreground border border-border/60 rounded-lg bg-secondary/30 hover:bg-secondary/50 hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" /> Routines
        </button>

        {/* Routine Picker Dialog */}
        <Dialog open={showRoutinePicker} onOpenChange={setShowRoutinePicker}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Apply a Routine</DialogTitle></DialogHeader>
            {(() => {
              const routines = getRoutines();
              if (routines.length === 0) {
                return (
                  <div className="space-y-3 py-2 text-center">
                    <p className="text-sm text-muted-foreground">No routines created yet.</p>
                    <Button
                      variant="outline"
                      onClick={() => { setShowRoutinePicker(false); navigate('/routines'); }}
                    >
                      Go to Routines
                    </Button>
                  </div>
                );
              }
              return (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  <p className="text-xs text-muted-foreground">
                    Exercises will be appended to this workout. Current exercises are kept.
                  </p>
                  {routines.map(r => (
                    <button
                      key={r.id}
                      onClick={() => {
                        const added = appendRoutineToWorkout(r, workout.id);
                        setShowRoutinePicker(false);
                        refresh();
                        toast(added > 0 ? `Added ${added} exercise${added === 1 ? '' : 's'} from ${r.name}` : `${r.name} has no exercises`);
                      }}
                      className="w-full text-left rounded-lg border border-border/60 bg-secondary/30 hover:bg-secondary/60 px-3 py-2.5 transition-colors"
                    >
                      <div className="text-sm font-medium">{r.name}</div>
                      {r.description && (
                        <div className="text-xs text-muted-foreground truncate">{r.description}</div>
                      )}
                    </button>
                  ))}
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>


        {/* Dialogs */}
        <Dialog open={showAddExercise} onOpenChange={setShowAddExercise}>
          <DialogContent className="flex flex-col p-4 sm:p-6 !max-w-none sm:!max-w-md !w-screen sm:!w-full !h-[100dvh] sm:!h-auto !max-h-[100dvh] sm:!max-h-[85vh] !left-0 !top-0 !translate-x-0 !translate-y-0 sm:!left-[50%] sm:!top-[50%] sm:!translate-x-[-50%] sm:!translate-y-[-50%] !rounded-none sm:!rounded-lg pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
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
            initialAdding={goalsExercise.initialAdding}
            initialGoalType={goalsExercise.initialGoalType}
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

      {/* Floating sticky rest timer — shared state with inline SetRestTimerRow */}
      <FloatingRestTimer
        bottomOffset={88}
        resolveLabel={(weId) => {
          const we = workoutExercises.find(x => x.id === weId);
          return we ? getExName(we.exerciseId) : undefined;
        }}
      />

      {tutorialOpen && (
        <ExerciseTutorialOverlay
          steps={TUTORIAL_STEPS}
          onFinish={() => {
            localStorage.setItem('hasSeenExerciseTutorial', 'true');
            setTutorialOpen(false);
          }}
        />
      )}

      <AlertDialog open={!!repeatTarget} onOpenChange={(open) => !open && setRepeatTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace current sets?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace the current sets for this exercise with the last routine.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (repeatTarget) performRepeatLastRoutine(repeatTarget.weId, repeatTarget.exerciseId);
                setRepeatTarget(null);
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteSetTarget} onOpenChange={(open) => !open && setDeleteSetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this set?</AlertDialogTitle>
            <AlertDialogDescription>
              This set will be removed and remaining sets will be renumbered. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteSetTarget) handleDeleteSet(deleteSetTarget);
                setDeleteSetTarget(null);
              }}
            >
              Yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {workout && (
        <WorkoutCelebrationModal
          workoutId={workout.id}
          open={celebrationOpen}
          onClose={() => {
            setCelebrationOpen(false);
            incrementWorkoutCount();
            if (shouldShowReview()) {
              requestReview();
            }
            if (supportCount > 0) {
              setSupportOpen(true);
            } else {
              navigate('/');
            }
          }}
        />
      )}
      <SupportModal
        open={supportOpen}
        workoutCount={supportCount}
        onClose={() => {
          setSupportOpen(false);
          navigate('/');
        }}
      />

      {(() => {
        const current = completedGoalQueue[0];
        if (!current) return null;
        const dismiss = () => {
          markGoalAcknowledged(current.goal.id);
          setCompletedGoalQueue(prev => prev.slice(1));
        };
        const ex = allExercises.find(e => e.id === current.exerciseId);
        return (
          <GoalCelebrationModal
            open={true}
            goal={current.goal}
            exerciseName={current.exerciseName}
            currentValue={current.currentValue}
            onMaybeLater={dismiss}
            onSetNewGoal={() => {
              markGoalAcknowledged(current.goal.id);
              setCompletedGoalQueue(prev => prev.slice(1));
              if (ex) {
                setGoalsExercise({
                  id: ex.id,
                  name: ex.name,
                  weightUnit: ex.weightUnit ?? 'kg',
                  initialAdding: true,
                  initialGoalType: current.goal.goalType,
                });
              }
            }}
          />
        );
      })()}
    </div>
  );
}
