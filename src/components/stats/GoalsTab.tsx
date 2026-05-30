import { useMemo, useState } from 'react';
import { Target, Plus, MoreVertical, Check, Dumbbell } from 'lucide-react';
import {
  getExercises, getExerciseHistory, getExerciseGoals,
  addExerciseGoal, deleteExerciseGoal, generateId, getSettings,
} from '@/lib/storage';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { ExerciseGoal, Exercise, WorkoutSet } from '@/types/fitness';
import { useExerciseName } from '@/i18n/exerciseNames';

const GOAL_TYPES = [
  { value: 'MAX_WEIGHT', label: 'Max Weight', needsWeight: true, needsReps: false },
  { value: 'MAX_WEIGHT_FOR_REPS', label: 'Max Weight for Reps', needsWeight: true, needsReps: true },
  { value: 'MAX_REPS', label: 'Max Reps', needsWeight: false, needsReps: true },
  { value: 'ESTIMATED_1RM', label: 'Estimated 1RM', needsWeight: true, needsReps: false },
  { value: 'MAX_WORKOUT_VOLUME', label: 'Workout Volume', needsWeight: true, needsReps: false },
  { value: 'MAX_WORKOUT_REPS', label: 'Workout Reps', needsWeight: false, needsReps: true },
] as const;

type GoalTypeValue = (typeof GOAL_TYPES)[number]['value'];

function computeCurrentBest(
  exerciseId: string,
  goalType: GoalTypeValue,
  targetReps?: number,
): { value: number; weight: number; reps: number } {
  const history = getExerciseHistory(exerciseId);
  let bestValue = 0;
  let bestWeight = 0;
  let bestReps = 0;

  for (const session of history) {
    const sets = session.sets;

    switch (goalType) {
      case 'MAX_WEIGHT':
        for (const s of sets) {
          const w = s.weightKg ?? 0;
          if (w > bestValue) { bestValue = w; bestWeight = w; bestReps = s.reps ?? 0; }
        }
        break;
      case 'MAX_WEIGHT_FOR_REPS':
        for (const s of sets) {
          if ((s.reps ?? 0) === (targetReps ?? 1) && (s.weightKg ?? 0) > bestValue) {
            bestValue = s.weightKg!;
            bestWeight = s.weightKg!;
            bestReps = s.reps ?? 0;
          }
        }
        break;
      case 'MAX_REPS':
        for (const s of sets) {
          const r = s.reps ?? 0;
          if (r > bestValue) { bestValue = r; bestWeight = s.weightKg ?? 0; bestReps = r; }
        }
        break;
      case 'ESTIMATED_1RM':
        for (const s of sets) {
          const w = s.weightKg ?? 0;
          const r = s.reps ?? 0;
          if (w > 0 && r > 0) {
            const e = w * (1 + r / 30);
            if (e > bestValue) { bestValue = Math.round(e * 10) / 10; bestWeight = w; bestReps = r; }
          }
        }
        break;
      case 'MAX_WORKOUT_VOLUME': {
        let sessionVol = 0;
        let sessionBestW = 0;
        let sessionBestR = 0;
        for (const s of sets) {
          const v = (s.weightKg ?? 0) * (s.reps ?? 0);
          sessionVol += v;
          if (v > sessionBestW * sessionBestR) { sessionBestW = s.weightKg ?? 0; sessionBestR = s.reps ?? 0; }
        }
        if (sessionVol > bestValue) { bestValue = sessionVol; bestWeight = sessionBestW; bestReps = sessionBestR; }
        break;
      }
      case 'MAX_WORKOUT_REPS': {
        let sessionReps = 0;
        for (const s of sets) sessionReps += s.reps ?? 0;
        if (sessionReps > bestValue) { bestValue = sessionReps; bestWeight = 0; bestReps = sessionReps; }
        break;
      }
    }
  }

  return { value: bestValue, weight: bestWeight, reps: bestReps };
}

function getTargetValue(goal: ExerciseGoal, gt: GoalTypeValue): number {
  switch (gt) {
    case 'MAX_WEIGHT':
    case 'ESTIMATED_1RM':
    case 'MAX_WORKOUT_VOLUME':
      return goal.targetValue;
    case 'MAX_WEIGHT_FOR_REPS':
      return goal.targetValue;
    case 'MAX_REPS':
    case 'MAX_WORKOUT_REPS':
      return goal.targetValue;
    default:
      return goal.targetValue;
  }
}

function formatValue(value: number, goalType: GoalTypeValue, unit: string): string {
  const globalWeightUnit = getSettings().weightUnit;
  const displayVal = toDisplayWeight(value, globalWeightUnit) ?? value;
  const wuLabel = weightUnitLabel(globalWeightUnit);
  switch (goalType) {
    case 'MAX_WEIGHT':
    case 'ESTIMATED_1RM':
    case 'MAX_WEIGHT_FOR_REPS':
      return `${displayVal.toLocaleString()} ${wuLabel}`;
    case 'MAX_WORKOUT_VOLUME':
      return `${displayVal.toLocaleString()} ${wuLabel}`;
    case 'MAX_REPS':
    case 'MAX_WORKOUT_REPS':
      return `${value.toLocaleString()} reps`;
    default:
      return `${value.toLocaleString()}`;
  }
}

interface GoalsTabProps {
  onAddGoal?: () => void;
}

export default function GoalsTab({ onAddGoal }: GoalsTabProps) {
  const exercises = useMemo(() => getExercises(), []);
  const [goals, setGoals] = useState<ExerciseGoal[]>(() => getExerciseGoals());
  const [filterExId, setFilterExId] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<ExerciseGoal | null>(null);

  // Form state
  const [formExId, setFormExId] = useState('');
  const [formGoalType, setFormGoalType] = useState<GoalTypeValue>('MAX_WEIGHT');
  const [formTargetWeight, setFormTargetWeight] = useState('');
  const [formTargetReps, setFormTargetReps] = useState('');
  const [formError, setFormError] = useState('');

  const refreshGoals = () => setGoals(getExerciseGoals());

  // Exercises that have goals
  const exercisesWithGoals = useMemo(() => {
    const ids = new Set(goals.map(g => g.exerciseId));
    return exercises.filter(e => ids.has(e.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, goals]);

  // Filtered goals grouped by exercise
  const groupedGoals = useMemo(() => {
    const filtered = filterExId === 'all' ? goals : goals.filter(g => g.exerciseId === filterExId);
    const map = new Map<string, { exercise: Exercise; goals: ExerciseGoal[] }>();
    for (const g of filtered) {
      const ex = exercises.find(e => e.id === g.exerciseId);
      if (!ex) continue;
      if (!map.has(g.exerciseId)) map.set(g.exerciseId, { exercise: ex, goals: [] });
      map.get(g.exerciseId)!.goals.push(g);
    }
    return Array.from(map.values()).sort((a, b) => a.exercise.name.localeCompare(b.exercise.name));
  }, [goals, filterExId, exercises]);

  const gtConfig = (gt: string) => GOAL_TYPES.find(t => t.value === gt);

  const openAddModal = () => {
    setFormExId(exercises[0]?.id ?? '');
    setFormGoalType('MAX_WEIGHT');
    setFormTargetWeight('');
    setFormTargetReps('');
    setFormError('');
    setEditingGoal(null);
    setShowAddModal(true);
  };

  const openEditModal = (goal: ExerciseGoal) => {
    setFormExId(goal.exerciseId);
    setFormGoalType(goal.goalType as GoalTypeValue);
    setFormTargetWeight(goal.targetValue?.toString() ?? '');
    setFormTargetReps(goal.targetReps?.toString() ?? '');
    setFormError('');
    setEditingGoal(goal);
    setShowAddModal(true);
  };

  const handleSave = () => {
    if (!formExId) { setFormError('Please select an exercise'); return; }
    const cfg = gtConfig(formGoalType);
    const tw = parseFloat(formTargetWeight);
    const tr = parseInt(formTargetReps);

    if (cfg?.needsWeight && (!tw || tw <= 0)) { setFormError('Target value must be greater than 0'); return; }
    if (cfg?.needsReps && (!tr || tr <= 0)) { setFormError('Target reps must be greater than 0'); return; }

    // Determine targetValue based on goal type
    let targetValue: number;
    if (cfg?.needsWeight) {
      targetValue = tw;
    } else {
      targetValue = tr;
    }

    if (editingGoal) {
      // Delete old and add new
      deleteExerciseGoal(editingGoal.id);
    }

    addExerciseGoal({
      id: editingGoal?.id ?? generateId(),
      exerciseId: formExId,
      goalType: formGoalType,
      targetValue,
      targetReps: cfg?.needsReps ? tr : undefined,
      createdAt: editingGoal?.createdAt ?? new Date().toISOString(),
    });

    refreshGoals();
    setShowAddModal(false);
  };

  const handleDelete = (id: string) => {
    deleteExerciseGoal(id);
    refreshGoals();
  };

  // Exercises with history for the add modal
  const exercisesWithHistory = useMemo(() => {
    return exercises
      .filter(e => getExerciseHistory(e.id).length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises]);

  // Empty state
  if (goals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-4">
        <Target className="h-12 w-12" />
        <p className="text-sm font-medium">No goals set yet</p>
        <p className="text-xs">Tap + to add your first exercise goal</p>
        <Button onClick={openAddModal} size="sm" className="mt-2">
          <Plus className="h-4 w-4 mr-1" /> Add Goal
        </Button>
        <AddGoalDialog
          open={showAddModal}
          onOpenChange={setShowAddModal}
          exercises={exercisesWithHistory}
          formExId={formExId}
          setFormExId={setFormExId}
          formGoalType={formGoalType}
          setFormGoalType={setFormGoalType}
          formTargetWeight={formTargetWeight}
          setFormTargetWeight={setFormTargetWeight}
          formTargetReps={formTargetReps}
          setFormTargetReps={setFormTargetReps}
          formError={formError}
          onSave={handleSave}
          isEdit={false}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Exercise:</label>
          <Select value={filterExId} onValueChange={setFilterExId}>
            <SelectTrigger className="mt-1 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Exercises</SelectItem>
              {exercisesWithGoals.map(ex => (
                <SelectItem key={ex.id} value={ex.id}>{ex.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <button
          onClick={openAddModal}
          className="mt-5 ml-2 p-2 rounded-md hover:bg-secondary transition-colors"
        >
          <Plus className="h-5 w-5 text-primary" />
        </button>
      </div>

      {/* Goal cards */}
      {groupedGoals.map(({ exercise, goals: exGoals }) => (
        <GoalCard
          key={exercise.id}
          exercise={exercise}
          goals={exGoals}
          onEdit={openEditModal}
          onDelete={handleDelete}
        />
      ))}

      <AddGoalDialog
        open={showAddModal}
        onOpenChange={setShowAddModal}
        exercises={exercisesWithHistory}
        formExId={formExId}
        setFormExId={setFormExId}
        formGoalType={formGoalType}
        setFormGoalType={setFormGoalType}
        formTargetWeight={formTargetWeight}
        setFormTargetWeight={setFormTargetWeight}
        formTargetReps={formTargetReps}
        setFormTargetReps={setFormTargetReps}
        formError={formError}
        onSave={handleSave}
        isEdit={!!editingGoal}
      />
    </div>
  );
}

/* ─── Goal Card ─── */

function GoalCard({
  exercise,
  goals,
  onEdit,
  onDelete,
}: {
  exercise: Exercise;
  goals: ExerciseGoal[];
  onEdit: (g: ExerciseGoal) => void;
  onDelete: (id: string) => void;
}) {
  const unit = weightUnitLabel(getSettings().weightUnit);
  const allAchieved = goals.every(g => {
    const gt = g.goalType as GoalTypeValue;
    const best = computeCurrentBest(exercise.id, gt, g.targetReps);
    const target = getTargetValue(g, gt);
    return target > 0 && best.value >= target;
  });

  return (
    <div className={`gym-card space-y-3 ${allAchieved ? 'ring-1 ring-primary/50' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-display text-sm font-semibold">{exercise.name}</h3>
          {allAchieved && <Check className="h-4 w-4 text-primary" />}
        </div>
      </div>

      {goals.map(goal => (
        <GoalRow key={goal.id} goal={goal} exercise={exercise} unit={unit} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}

function GoalRow({
  goal,
  exercise,
  unit,
  onEdit,
  onDelete,
}: {
  goal: ExerciseGoal;
  exercise: Exercise;
  unit: string;
  onEdit: (g: ExerciseGoal) => void;
  onDelete: (id: string) => void;
}) {
  const gt = goal.goalType as GoalTypeValue;
  const cfg = GOAL_TYPES.find(t => t.value === gt);
  const best = computeCurrentBest(exercise.id, gt, goal.targetReps);
  const target = getTargetValue(goal, gt);
  const pct = target > 0 ? Math.min(100, Math.round((best.value / target) * 100)) : 0;
  const achieved = pct >= 100;

  const globalWeightUnit = getSettings().weightUnit;
  const wuLabel = weightUnitLabel(globalWeightUnit);
  const dw = (v: number) => toDisplayWeight(v, globalWeightUnit) ?? v;

  const currentLabel = cfg?.needsWeight && cfg?.needsReps
    ? `${dw(best.weight)} ${wuLabel} × ${best.reps} (${pct}%)`
    : `${formatValue(best.value, gt, wuLabel)} (${pct}%)`;

  const targetLabel = cfg?.needsWeight && cfg?.needsReps
    ? `${dw(goal.targetValue)} ${wuLabel} × ${goal.targetReps}`
    : formatValue(target, gt, wuLabel);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">
          {cfg?.label ?? goal.goalType}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 rounded hover:bg-secondary">
              <MoreVertical className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(goal)}>Edit Goal</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(goal.id)} className="text-destructive">Delete Goal</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${achieved ? 'bg-primary' : 'bg-primary/80'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span style={{ color: '#38bdf8' }}>{currentLabel}</span>
        <span className="text-muted-foreground">{targetLabel}</span>
      </div>
    </div>
  );
}

/* ─── Add/Edit Goal Dialog ─── */

function AddGoalDialog({
  open,
  onOpenChange,
  exercises,
  formExId,
  setFormExId,
  formGoalType,
  setFormGoalType,
  formTargetWeight,
  setFormTargetWeight,
  formTargetReps,
  setFormTargetReps,
  formError,
  onSave,
  isEdit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  exercises: Exercise[];
  formExId: string;
  setFormExId: (v: string) => void;
  formGoalType: GoalTypeValue;
  setFormGoalType: (v: GoalTypeValue) => void;
  formTargetWeight: string;
  setFormTargetWeight: (v: string) => void;
  formTargetReps: string;
  setFormTargetReps: (v: string) => void;
  formError: string;
  onSave: () => void;
  isEdit: boolean;
}) {
  const cfg = GOAL_TYPES.find(t => t.value === formGoalType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-base">{isEdit ? 'Edit Goal' : 'Add Goal'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Exercise</label>
            <Select value={formExId} onValueChange={setFormExId}>
              <SelectTrigger className="mt-1 h-9 text-sm">
                <SelectValue placeholder="Select exercise" />
              </SelectTrigger>
              <SelectContent>
                {exercises.map(ex => (
                  <SelectItem key={ex.id} value={ex.id}>{ex.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Goal Type</label>
            <Select value={formGoalType} onValueChange={v => setFormGoalType(v as GoalTypeValue)}>
              <SelectTrigger className="mt-1 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOAL_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {cfg?.needsWeight && (
            <div>
              <label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">
                Target {formGoalType === 'MAX_WORKOUT_VOLUME' ? 'Volume' : 'Weight'} ({weightUnitLabel(getSettings().weightUnit)})
              </label>
              <Input
                type="number"
                min={1}
                value={formTargetWeight}
                onChange={e => setFormTargetWeight(e.target.value)}
                className="mt-1 h-9 text-sm"
                placeholder="e.g. 100"
              />
            </div>
          )}

          {cfg?.needsReps && (
            <div>
              <label className="text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">Target Reps</label>
              <Input
                type="number"
                min={1}
                value={formTargetReps}
                onChange={e => setFormTargetReps(e.target.value)}
                className="mt-1 h-9 text-sm"
                placeholder="e.g. 10"
              />
            </div>
          )}

          {formError && (
            <p className="text-xs text-destructive">{formError}</p>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button className="flex-1" onClick={onSave}>{isEdit ? 'Update Goal' : 'Save Goal'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
