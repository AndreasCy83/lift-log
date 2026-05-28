import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MoreVertical, Play, Trash2, Copy, CalendarPlus, Layers, ChevronRight, Star } from 'lucide-react';
import {
  getRoutines, getExercisesForRoutine, getExercises, deleteRoutine, generateId, addRoutine, addRoutineExercise,
  getPrograms, addProgram, deleteProgram, getRoutinesForProgram, getStandaloneRoutines, toggleProgramFavorite,
} from '@/lib/storage';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { Routine, Program } from '@/types/fitness';

type Tab = 'programs' | 'routines';

export default function RoutinesPage() {
  const navigate = useNavigate();
  const [, force] = useState(0);
  const refresh = () => force(n => n + 1);

  const programs = useMemo(() => getPrograms(), []);
  const standaloneRoutines = useMemo(() => getStandaloneRoutines(), []);
  const allRoutines = useMemo(() => getRoutines(), []);
  // re-read each render via deps on force
  void allRoutines;

  const [tab, setTab] = useState<Tab>('programs');

  const [showCreateRoutine, setShowCreateRoutine] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newRoutineDesc, setNewRoutineDesc] = useState('');

  const [showCreateProgram, setShowCreateProgram] = useState(false);
  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramDesc, setNewProgramDesc] = useState('');

  const [logToDateRoutine, setLogToDateRoutine] = useState<Routine | null>(null);

  const handleCreateRoutine = () => {
    if (!newRoutineName.trim()) return;
    const routine: Routine = {
      id: generateId(),
      name: newRoutineName.trim(),
      description: newRoutineDesc.trim(),
      isActive: false,
      programId: null,
    };
    addRoutine(routine);
    setNewRoutineName(''); setNewRoutineDesc(''); setShowCreateRoutine(false);
    navigate(`/routine/${routine.id}`);
  };

  const handleCreateProgram = () => {
    if (!newProgramName.trim()) return;
    const program: Program = {
      id: generateId(),
      name: newProgramName.trim(),
      description: newProgramDesc.trim(),
      createdAt: new Date().toISOString(),
    };
    addProgram(program);
    setNewProgramName(''); setNewProgramDesc(''); setShowCreateProgram(false);
    navigate(`/program/${program.id}`);
  };

  const handleDeleteRoutine = (id: string) => { deleteRoutine(id); refresh(); };
  const handleDeleteProgram = (id: string) => {
    if (!confirm('Delete this program? Its routines will become standalone routines.')) return;
    deleteProgram(id); refresh();
  };

  const handleDuplicate = (r: Routine) => {
    const newRoutine: Routine = { ...r, id: generateId(), name: `${r.name} (Copy)` };
    addRoutine(newRoutine);
    getExercisesForRoutine(r.id).forEach(re => {
      const { id: _i, routineId: _r, ...rest } = re;
      addRoutineExercise({ ...rest, id: generateId(), routineId: newRoutine.id });
    });
    refresh();
  };

  const handleLogRoutine = (r: Routine, date: Date = new Date()) => {
    const dateStr = createWorkoutFromRoutine(r, date);
    setLogToDateRoutine(null);
    navigate(`/workout/${dateStr}`);
  };

  return (
    <div className="flex min-h-screen flex-col pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
          <h1 className="font-display text-xl font-bold">Routines</h1>
          {tab === 'programs' ? (
            <Dialog open={showCreateProgram} onOpenChange={setShowCreateProgram}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 rounded-full bg-primary text-primary-foreground">
                  <Plus className="h-4 w-4" /> New program
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create program</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="Program name (e.g. PPL)" value={newProgramName} onChange={e => setNewProgramName(e.target.value)} />
                  <Textarea placeholder="Description (e.g. Beginner Push Pull Legs)" value={newProgramDesc} onChange={e => setNewProgramDesc(e.target.value)} />
                  <Button onClick={handleCreateProgram} className="w-full bg-primary text-primary-foreground">Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog open={showCreateRoutine} onOpenChange={setShowCreateRoutine}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 rounded-full bg-primary text-primary-foreground">
                  <Plus className="h-4 w-4" /> New routine
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create routine</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="Routine name" value={newRoutineName} onChange={e => setNewRoutineName(e.target.value)} />
                  <Textarea placeholder="Description (optional)" value={newRoutineDesc} onChange={e => setNewRoutineDesc(e.target.value)} />
                  <Button onClick={handleCreateRoutine} className="w-full bg-primary text-primary-foreground">Create</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="programs">Programs</TabsTrigger>
            <TabsTrigger value="routines">My Routines</TabsTrigger>
          </TabsList>

          <TabsContent value="programs" className="space-y-3 mt-0">
            {programs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Layers className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-1">No programs yet</p>
                <p className="text-sm text-muted-foreground">Group routines into training plans like PPL or Upper/Lower</p>
              </div>
            ) : (
              programs.map(p => {
                const count = getRoutinesForProgram(p.id).length;
                return (
                  <div key={p.id} className="gym-card">
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => navigate(`/program/${p.id}`)} className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4 text-primary shrink-0" />
                          <h3 className="font-display font-semibold truncate">{p.name}</h3>
                        </div>
                        {p.description && <p className="text-xs text-muted-foreground mt-1 truncate">{p.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{count} workout day{count === 1 ? '' : 's'}</p>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => navigate(`/program/${p.id}`)} className="p-2 text-muted-foreground">
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleDeleteProgram(p.id)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> Delete program
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="routines" className="space-y-3 mt-0">
            {standaloneRoutines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-muted-foreground mb-1">No standalone routines</p>
                <p className="text-sm text-muted-foreground">Create a routine to quickly start workouts</p>
              </div>
            ) : (
              standaloneRoutines.map(r => {
                const routineExercises = getExercisesForRoutine(r.id);
                return (
                  <div key={r.id} className="gym-card">
                    <div className="flex items-start justify-between">
                      <button onClick={() => navigate(`/routine/${r.id}`)} className="flex-1 text-left min-w-0">
                        <h3 className="font-display font-semibold truncate">{r.name}</h3>
                        {r.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.description}</p>}
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
                            <DropdownMenuItem onClick={() => handleDeleteRoutine(r.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>
        </Tabs>
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
                if (date && logToDateRoutine) handleLogRoutine(logToDateRoutine, date);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
