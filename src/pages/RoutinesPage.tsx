import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, MoreVertical, Play, Trash2, Copy, CalendarPlus, Layers, ChevronRight, Star } from 'lucide-react';
import {
  getRoutines, getExercisesForRoutine, getExercises, deleteRoutine, generateId, addRoutine, addRoutineExercise,
  getPrograms, addProgram, deleteProgram, getRoutinesForProgram, getStandaloneRoutines, toggleProgramFavorite,
} from '@/lib/storage';
import { createWorkoutFromRoutine } from '@/lib/routineRunner';
import { Button } from '@/components/ui/button';
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
  const { t } = useTranslation();
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(n => n + 1);

  const programs = useMemo(() => {
    const all = getPrograms();
    const favs: Program[] = [];
    const rest: Program[] = [];
    all.forEach(p => (p.isFavorite ? favs : rest).push(p));
    return [...favs, ...rest];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
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
    if (!confirm(t('programs.deleteConfirm'))) return;
    deleteProgram(id); refresh();
  };

  const handleDuplicate = (r: Routine) => {
    const newRoutine: Routine = { ...r, id: generateId(), name: `${r.name} ${t('routines.copySuffix')}` };
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
          <h1 className="font-display text-xl font-bold">{t('routines.title')}</h1>
          {tab === 'programs' ? (
            <Dialog open={showCreateProgram} onOpenChange={setShowCreateProgram}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 rounded-full bg-primary text-primary-foreground">
                  <Plus className="h-4 w-4" /> {t('routines.newProgram')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t('programs.createTitle')}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input placeholder={t('programs.namePh')} value={newProgramName} onChange={e => setNewProgramName(e.target.value)} />
                  <Textarea placeholder={t('programs.descPh')} value={newProgramDesc} onChange={e => setNewProgramDesc(e.target.value)} />
                  <Button onClick={handleCreateProgram} className="w-full bg-primary text-primary-foreground">{t('routines.create')}</Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog open={showCreateRoutine} onOpenChange={setShowCreateRoutine}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 rounded-full bg-primary text-primary-foreground">
                  <Plus className="h-4 w-4" /> {t('routines.newRoutine')}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t('routines.createRoutineTitle')}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input placeholder={t('routines.createRoutineNamePh')} value={newRoutineName} onChange={e => setNewRoutineName(e.target.value)} />
                  <Textarea placeholder={t('routines.descriptionPh')} value={newRoutineDesc} onChange={e => setNewRoutineDesc(e.target.value)} />
                  <Button onClick={handleCreateRoutine} className="w-full bg-primary text-primary-foreground">{t('routines.create')}</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="programs">{t('routines.tabs.programs')}</TabsTrigger>
            <TabsTrigger value="routines">{t('routines.tabs.routines')}</TabsTrigger>
          </TabsList>

          <TabsContent value="programs" className="space-y-3 mt-0">
            {programs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Layers className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-1">{t('programs.emptyTitle')}</p>
                <p className="text-sm text-muted-foreground">{t('programs.emptyHint')}</p>
              </div>
            ) : (
              programs.map(p => {
                const count = getRoutinesForProgram(p.id).length;
                return (
                  <div key={p.id} className="gym-card">
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => navigate(`/program/${p.id}`)} className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-1.5">
                          <Layers className="h-4 w-4 shrink-0 text-primary/80" />
                          <h3 className="font-display flex-1 min-w-0 font-semibold truncate">{p.name}</h3>
                        </div>
                        {p.description && <p className="mt-0.5 truncate text-xs text-muted-foreground/70">{p.description}</p>}
                        <p className="mt-1 text-xs text-muted-foreground/70">{t('programs.workoutDays', { count })}</p>
                      </button>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          aria-label={p.isFavorite ? t('programs.unfavorite') : t('programs.favorite')}
                          aria-pressed={!!p.isFavorite}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleProgramFavorite(p.id);
                            try { (navigator as any).vibrate?.(15); } catch {}
                            refresh();
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground active:scale-90 transition-transform"
                        >
                          <Star
                            className={`h-4 w-4 transition-colors ${p.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`}
                          />
                        </button>
                        <button onClick={() => navigate(`/program/${p.id}`)} className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground">
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => handleDeleteProgram(p.id)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> {t('programs.deleteProgram')}
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
                <p className="text-muted-foreground mb-1">{t('routines.noStandalone')}</p>
                <p className="text-sm text-muted-foreground">{t('routines.noStandaloneHint')}</p>
              </div>
            ) : (
              standaloneRoutines.map(r => {
                const routineExercises = getExercisesForRoutine(r.id);
                return (
                  <div key={r.id} className="gym-card">
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => navigate(`/routine/${r.id}`)} className="flex-1 min-w-0 text-left">
                        <h3 className="font-display min-w-0 font-semibold truncate">{r.name}</h3>
                        {r.description && <p className="mt-0.5 truncate text-xs text-muted-foreground/70">{r.description}</p>}
                        <p className="mt-1 text-xs text-muted-foreground/70">{t('routines.exercises', { count: routineExercises.length })}</p>
                      </button>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button size="sm" variant="ghost" onClick={() => handleLogRoutine(r)} className="h-8 w-8 p-0 text-primary">
                          <Play className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => setLogToDateRoutine(r)}><CalendarPlus className="h-4 w-4 mr-2" /> {t('routines.actions.logToDate')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(r)}><Copy className="h-4 w-4 mr-2" /> {t('routines.actions.duplicate')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteRoutine(r.id)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> {t('routines.actions.delete')}</DropdownMenuItem>
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
            <DialogTitle className="font-display text-base">{t('routines.logToDateTitle', { name: logToDateRoutine?.name ?? '' })}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('routines.logToDateHint')}</p>
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
