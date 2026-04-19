import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MoreVertical, Play, Trash2, Copy, CalendarPlus } from 'lucide-react';
import { getRoutines, getExercisesForRoutine, getExercises, deleteRoutine, generateId, addRoutine, addRoutineExercise, addWorkout, addWorkoutExercise, addWorkoutSet } from '@/lib/storage';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import type { Routine } from '@/types/fitness';

export default function RoutinesPage() {
  const navigate = useNavigate();
  const [routines, setRoutines] = useState(() => getRoutines());
  const exercises = useMemo(() => getExercises(), []);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [logToDateRoutine, setLogToDateRoutine] = useState<Routine | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const routine: Routine = {
      id: generateId(),
      name: newName.trim(),
      description: newDesc.trim(),
      isActive: false,
    };
    addRoutine(routine);
    setRoutines(getRoutines());
    setNewName('');
    setNewDesc('');
    setShowCreate(false);
    navigate(`/routine/${routine.id}`);
  };

  const handleDelete = (id: string) => {
    deleteRoutine(id);
    setRoutines(getRoutines());
  };

  const handleDuplicate = (r: Routine) => {
    const newRoutine: Routine = { ...r, id: generateId(), name: `${r.name} (Copy)` };
    addRoutine(newRoutine);
    const res = getExercisesForRoutine(r.id);
    res.forEach(re => {
      const { id: _, routineId: __, ...rest } = re;
      addRoutineExercise({ ...rest, id: generateId(), routineId: newRoutine.id });
    });
    setRoutines(getRoutines());
  };

  const handleLogRoutineToDate = (r: Routine, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const workoutId = generateId();
    addWorkout({ id: workoutId, date: dateStr, startTime: date.toISOString(), endTime: null, notes: `From: ${r.name}` });
    const res = getExercisesForRoutine(r.id);
    res.forEach((re, idx) => {
      const weId = generateId();
      addWorkoutExercise({ id: weId, workoutId, exerciseId: re.exerciseId, position: idx, notes: '', defaultRestSeconds: re.restSeconds ?? null });
      for (let i = 0; i < re.sets; i++) {
        addWorkoutSet({
          id: generateId(), workoutExerciseId: weId, setIndex: i,
          weightKg: null, reps: re.repsMin, distanceKm: null, durationMinutes: null,
          rpe: null, setTag: 'N', isWarmup: false, isCompleted: false, notes: '',
          restSeconds: re.restSeconds ?? null,
        });
      }
    });
    setLogToDateRoutine(null);
    navigate(`/workout/${dateStr}`);
  };

  const handleLogRoutine = (r: Routine) => {
    handleLogRoutineToDate(r, new Date());
  };

  return (
    <div className="flex min-h-screen flex-col pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <h1 className="font-display text-xl font-bold">Routines</h1>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 rounded-full bg-primary text-primary-foreground">
                <Plus className="h-4 w-4" /> New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Routine</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Routine name" value={newName} onChange={e => setNewName(e.target.value)} />
                <Textarea placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                <Button onClick={handleCreate} className="w-full bg-primary text-primary-foreground">Create</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-4 space-y-3">
        {routines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-muted-foreground mb-2">No routines yet</p>
            <p className="text-sm text-muted-foreground">Create a routine to quickly start workouts</p>
          </div>
        ) : (
          routines.map(r => {
            const routineExercises = getExercisesForRoutine(r.id);
            return (
              <div key={r.id} className="gym-card">
                <div className="flex items-start justify-between">
                  <button onClick={() => navigate(`/routine/${r.id}`)} className="flex-1 text-left">
                    <h3 className="font-display font-semibold">{r.name}</h3>
                    {r.description && <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{routineExercises.length} exercises</p>
                  </button>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handleLogRoutine(r)} className="text-primary">
                      <Play className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setLogToDateRoutine(r)}><CalendarPlus className="h-4 w-4 mr-2" /> Log to Date</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(r)}><Copy className="h-4 w-4 mr-2" /> Duplicate</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(r.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Log to Date dialog */}
      <Dialog open={!!logToDateRoutine} onOpenChange={open => { if (!open) setLogToDateRoutine(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-base">Log "{logToDateRoutine?.name}" to Date</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Pick a date to copy this routine as a workout:</p>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={undefined}
              onSelect={(date) => {
                if (date && logToDateRoutine) handleLogRoutineToDate(logToDateRoutine, date);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}