import { useState, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, GripVertical, Pencil } from 'lucide-react';
import {
  getRoutines, getExercisesForRoutine, getExercises, getCategories,
  addRoutineExercise, removeRoutineExercise, updateRoutineExercise,
  reorderRoutineExercises, generateId,
} from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { RoutineExercise } from '@/types/fitness';
import ExerciseSelectionScreen from '@/components/ExerciseSelectionScreen';

export default function RoutineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const routine = getRoutines().find(r => r.id === id);
  const [routineExercises, setRoutineExercises] = useState(() => id ? getExercisesForRoutine(id) : []);
  const exercises = useMemo(() => getExercises(), []);
  const categories = useMemo(() => getCategories(), []);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<RoutineExercise | null>(null);
  const [editSets, setEditSets] = useState('');
  const [editRepsMin, setEditRepsMin] = useState('');
  const [editRepsMax, setEditRepsMax] = useState('');
  const [editRest, setEditRest] = useState('');
  const dragId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  if (!routine || !id) return <div className="p-4">Routine not found</div>;

  const refresh = () => setRoutineExercises(getExercisesForRoutine(id));

  const handleAddExercises = (exerciseIds: string[]) => {
    exerciseIds.forEach((exerciseId, i) => {
      const master = exercises.find(e => e.id === exerciseId);
      const re: RoutineExercise = {
        id: generateId(),
        routineId: id,
        exerciseId,
        position: routineExercises.length + i,
        sets: master?.defaultSets ?? 3,
        repsMin: master?.defaultRepsMin ?? 8,
        repsMax: master?.defaultRepsMax ?? 12,
        restSeconds: master?.defaultRestSeconds ?? 90,
        supersetGroup: null,
      };
      addRoutineExercise(re);
    });
    refresh();
    setShowAdd(false);
  };

  const handleRemove = (reId: string) => {
    removeRoutineExercise(reId);
    refresh();
  };

  const openEdit = (re: RoutineExercise) => {
    setEditing(re);
    setEditSets(String(re.sets));
    setEditRepsMin(re.repsMin != null ? String(re.repsMin) : '');
    setEditRepsMax(re.repsMax != null ? String(re.repsMax) : '');
    setEditRest(re.restSeconds != null ? String(re.restSeconds) : '');
  };

  const handleSaveEdit = () => {
    if (!editing) return;
    const updated: RoutineExercise = {
      ...editing,
      sets: Math.max(1, parseInt(editSets) || 1),
      repsMin: editRepsMin.trim() === '' ? null : Math.max(0, parseInt(editRepsMin) || 0),
      repsMax: editRepsMax.trim() === '' ? null : Math.max(0, parseInt(editRepsMax) || 0),
      restSeconds: editRest.trim() === '' ? null : Math.max(0, parseInt(editRest) || 0),
    };
    updateRoutineExercise(updated);
    setEditing(null);
    refresh();
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
            <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
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
              <button onClick={() => openEdit(re)} className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium truncate">{getExerciseName(re.exerciseId)}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {getCategoryName(re.exerciseId)} · {re.sets} sets × {repsLabel(re)}
                  {re.restSeconds != null ? ` · ${re.restSeconds}s rest` : ''}
                </div>
              </button>
              <button onClick={() => openEdit(re)} className="p-1 text-muted-foreground hover:text-primary" aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => handleRemove(re.id)} className="p-1 text-muted-foreground hover:text-destructive" aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>

      <Sheet open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-left">
              {editing ? getExerciseName(editing.exerciseId) : ''}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="re-sets">Sets</Label>
              <Input id="re-sets" type="number" inputMode="numeric" min={1}
                value={editSets} onChange={e => setEditSets(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="re-reps-min">Reps min</Label>
                <Input id="re-reps-min" type="number" inputMode="numeric" min={0}
                  value={editRepsMin} onChange={e => setEditRepsMin(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="re-reps-max">Reps max</Label>
                <Input id="re-reps-max" type="number" inputMode="numeric" min={0}
                  value={editRepsMax} onChange={e => setEditRepsMax(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="re-rest">Rest (seconds)</Label>
              <Input id="re-rest" type="number" inputMode="numeric" min={0}
                value={editRest} onChange={e => setEditRest(e.target.value)} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
              <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleSaveEdit}>Save</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
