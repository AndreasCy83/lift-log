import { useState, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, GripVertical, Pencil } from 'lucide-react';
import {
  getRoutines, getExercisesForRoutine, getExercises, getCategories,
  addRoutineExercise, removeRoutineExercise, updateRoutineExercise,
  reorderRoutineExercises, generateId,
} from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { RoutineExercise, RoutinePopulationMode } from '@/types/fitness';
import ExerciseSelectionScreen from '@/components/ExerciseSelectionScreen';
import RoutineExerciseSetupSheet from '@/components/RoutineExerciseSetupSheet';
import { useExerciseName } from '@/i18n/exerciseNames';

const MODE_SHORT: Record<RoutinePopulationMode, string> = {
  copy_previous: 'Copy previous',
  predefined: 'Predefined',
  blank: 'Blank',
};

export default function RoutineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const routine = getRoutines().find(r => r.id === id);
  const [routineExercises, setRoutineExercises] = useState(() => id ? getExercisesForRoutine(id) : []);
  const exercises = useMemo(() => getExercises(), []);
  const categories = useMemo(() => getCategories(), []);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<RoutineExercise | null>(null);
  const [setupQueue, setSetupQueue] = useState<RoutineExercise[]>([]);
  const [setupIndex, setSetupIndex] = useState(0);
  const [setupTotal, setSetupTotal] = useState(0);
  const dragId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  if (!routine || !id) return <div className="p-4">Routine not found</div>;

  const refresh = () => setRoutineExercises(getExercisesForRoutine(id));

  const handleAddExercises = (exerciseIds: string[]) => {
    const created: RoutineExercise[] = [];
    exerciseIds.forEach((exerciseId, i) => {
      const master = exercises.find(e => e.id === exerciseId);
      const sets = master?.defaultSets ?? 3;
      const reps = master?.defaultRepsMin ?? null;
      const rest = master?.defaultRestSeconds ?? 90;
      const re: RoutineExercise = {
        id: generateId(),
        routineId: id,
        exerciseId,
        position: routineExercises.length + i,
        populationMode: 'predefined',
        sets,
        repsMin: master?.defaultRepsMin ?? 8,
        repsMax: master?.defaultRepsMax ?? 12,
        restSeconds: rest,
        predefinedSetType: master?.setType ?? null,
        predefinedRows: Array.from({ length: Math.max(1, sets) }, () => ({
          weightKg: null,
          reps,
          distanceKm: null,
          durationMinutes: null,
          restSeconds: rest,
        })),
        supersetGroup: null,
      };
      addRoutineExercise(re);
      created.push(re);
    });
    refresh();
    setShowAdd(false);
    if (created.length > 0) {
      setSetupQueue(created);
      setSetupIndex(0);
      setSetupTotal(created.length);
      setTimeout(() => setEditing(created[0]), 50);
    }
  };

  const handleRemove = (reId: string) => {
    removeRoutineExercise(reId);
    refresh();
  };

  const handleSaveEdit = (updated: RoutineExercise) => {
    updateRoutineExercise(updated);
    refresh();
    // Advance queue if we're in multi-add flow
    if (setupQueue.length > 0 && setupIndex < setupQueue.length - 1) {
      const nextIndex = setupIndex + 1;
      const next = setupQueue[nextIndex];
      setSetupIndex(nextIndex);
      setEditing(null);
      setTimeout(() => setEditing(next), 50);
    } else {
      setEditing(null);
      setSetupQueue([]);
      setSetupIndex(0);
      setSetupTotal(0);
    }
  };

  const handleSetupOpenChange = (o: boolean) => {
    if (!o) {
      // User dismissed — advance queue if multi-add
      if (setupQueue.length > 0 && setupIndex < setupQueue.length - 1) {
        const nextIndex = setupIndex + 1;
        const next = setupQueue[nextIndex];
        setSetupIndex(nextIndex);
        setEditing(null);
        setTimeout(() => setEditing(next), 50);
      } else {
        setEditing(null);
        setSetupQueue([]);
        setSetupIndex(0);
        setSetupTotal(0);
      }
    }
  };

  const handleDragStart = (reId: string) => { dragId.current = reId; };
  const handleDragOver = (e: React.DragEvent, reId: string) => {
    e.preventDefault();
    if (dragId.current && dragId.current !== reId) setDragOverId(reId);
  };
  const handleDrop = (targetId: string) => {
    const sourceId = dragId.current;
    dragId.current = null;
    setDragOverId(null);
    if (!sourceId || sourceId === targetId) return;
    const ids = routineExercises.map(re => re.id);
    const from = ids.indexOf(sourceId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    reorderRoutineExercises(id, ids);
    refresh();
  };

  const move = (reId: string, dir: -1 | 1) => {
    const ids = routineExercises.map(re => re.id);
    const idx = ids.indexOf(reId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= ids.length) return;
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    reorderRoutineExercises(id, ids);
    refresh();
  };

  const getExerciseName = (exId: string) => exercises.find(e => e.id === exId)?.name ?? 'Unknown';
  const getCategoryName = (exId: string) => {
    const ex = exercises.find(e => e.id === exId);
    return ex ? categories.find(c => c.id === ex.categoryId)?.name ?? '' : '';
  };

  const repsLabel = (re: RoutineExercise) => {
    if (re.repsMin != null && re.repsMax != null && re.repsMin !== re.repsMax) return `${re.repsMin}–${re.repsMax} reps`;
    const r = re.repsMin ?? re.repsMax;
    return r != null ? `${r} reps` : '— reps';
  };

  const summary = (re: RoutineExercise) => {
    const mode = re.populationMode ?? 'predefined';
    const cat = getCategoryName(re.exerciseId);
    const prefix = cat ? `${cat} · ` : '';
    if (mode === 'copy_previous') return `${prefix}${MODE_SHORT.copy_previous} from last session`;
    if (mode === 'blank') return `${prefix}${MODE_SHORT.blank} — fill in workout`;
    return `${prefix}${re.sets} sets × ${repsLabel(re)}${re.restSeconds != null ? ` · ${re.restSeconds}s rest` : ''}`;
  };

  return (
    <div className="flex min-h-screen flex-col pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button onClick={() => navigate('/routines')} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg font-bold flex-1">{routine.name}</h1>
          <Dialog open={showAdd} onOpenChange={setShowAdd}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1 rounded-full bg-primary text-primary-foreground">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </DialogTrigger>
            <DialogContent className="flex flex-col p-4 sm:p-6 !max-w-none sm:!max-w-md !w-screen sm:!w-full !h-[100dvh] sm:!h-auto !max-h-[100dvh] sm:!max-h-[85vh] !left-0 !top-0 !translate-x-0 !translate-y-0 sm:!left-[50%] sm:!top-[50%] sm:!translate-x-[-50%] sm:!translate-y-[-50%] !rounded-none sm:!rounded-lg pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              <DialogHeader><DialogTitle>Add Exercise</DialogTitle></DialogHeader>
              <ExerciseSelectionScreen onSelect={handleAddExercises} onClose={() => setShowAdd(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-4 space-y-2">
        {routineExercises.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Add exercises to your routine</p>
        ) : (
          routineExercises.map((re, idx) => (
            <div
              key={re.id}
              draggable
              onDragStart={() => handleDragStart(re.id)}
              onDragOver={(e) => handleDragOver(e, re.id)}
              onDrop={() => handleDrop(re.id)}
              onDragEnd={() => { dragId.current = null; setDragOverId(null); }}
              className={`gym-card flex items-center gap-2 ${dragOverId === re.id ? 'ring-2 ring-primary' : ''}`}
            >
              <button
                onClick={() => move(re.id, -1)}
                disabled={idx === 0}
                className="p-1 text-muted-foreground disabled:opacity-30 cursor-grab active:cursor-grabbing"
                aria-label="Drag to reorder"
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <button onClick={() => setEditing(re)} className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium truncate">{getExerciseName(re.exerciseId)}</div>
                <div className="text-xs text-muted-foreground truncate">{summary(re)}</div>
              </button>
              <button onClick={() => setEditing(re)} className="p-1 text-muted-foreground hover:text-primary" aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => handleRemove(re.id)} className="p-1 text-muted-foreground hover:text-destructive" aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {editing && (
        <RoutineExerciseSetupSheet
          open={!!editing}
          onOpenChange={handleSetupOpenChange}
          exerciseName={`${getExerciseName(editing.exerciseId)}${setupTotal > 1 ? ` (${setupIndex + 1} of ${setupTotal})` : ''}`}
          initial={editing}
          setType={exercises.find(e => e.id === editing.exerciseId)?.setType}
          onSave={handleSaveEdit}
        />
      )}
    </div>
  );
}
