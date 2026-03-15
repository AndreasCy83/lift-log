import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, GripVertical } from 'lucide-react';
import { getRoutines, updateRoutine, getExercisesForRoutine, getExercises, getCategories, addRoutineExercise, removeRoutineExercise, generateId } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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

  if (!routine || !id) return <div className="p-4">Routine not found</div>;

  const handleAddExercises = (exerciseIds: string[]) => {
    exerciseIds.forEach((exerciseId, i) => {
      const re: RoutineExercise = {
        id: generateId(), routineId: id, exerciseId, position: routineExercises.length + i,
        sets: 3, repsMin: 8, repsMax: 12, restSeconds: 90, supersetGroup: null,
      };
      addRoutineExercise(re);
    });
    setRoutineExercises(getExercisesForRoutine(id));
    setShowAdd(false);
  };

  const handleRemove = (reId: string) => {
    removeRoutineExercise(reId);
    setRoutineExercises(getExercisesForRoutine(id));
  };

  const getExerciseName = (exId: string) => exercises.find(e => e.id === exId)?.name ?? 'Unknown';
  const getCategoryName = (exId: string) => {
    const ex = exercises.find(e => e.id === exId);
    return ex ? categories.find(c => c.id === ex.categoryId)?.name ?? '' : '';
  };

  return (
    <div className="flex min-h-screen flex-col pb-20">
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
                    <div className="text-xs text-muted-foreground">{categories.find(c => c.id === ex.categoryId)?.name}</div>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-4 space-y-2">
        {routineExercises.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Add exercises to your routine</p>
        ) : (
          routineExercises.map((re, idx) => (
            <div key={re.id} className="gym-card flex items-center gap-3">
              <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{getExerciseName(re.exerciseId)}</div>
                <div className="text-xs text-muted-foreground">
                  {getCategoryName(re.exerciseId)} · {re.sets} sets × {re.repsMin}–{re.repsMax} reps
                </div>
              </div>
              <button onClick={() => handleRemove(re.id)} className="p-1 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
