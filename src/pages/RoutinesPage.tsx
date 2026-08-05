import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, MoreVertical, Play, Trash2, Copy, CalendarPlus, Layers, ChevronRight, Star, Pencil, GripVertical, ArrowUp, ArrowDown, ArrowUpDown, Check } from 'lucide-react';
import {
  DndContext, MouseSensor, TouchSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  getRoutines, getExercisesForRoutine, getExercises, deleteRoutine, generateId, addRoutine, addRoutineExercise,
  getPrograms, addProgram, deleteProgram, getRoutinesForProgram, getStandaloneRoutines, toggleProgramFavorite,
  toggleRoutineFavorite, updateRoutine, updateProgram,
  getWorkoutByDate, reorderPrograms, reorderStandaloneRoutines,
} from '@/lib/storage';
import { createWorkoutFromRoutine } from '@/lib/routineRunner';
import { startSession } from '@/lib/workoutSession';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { Routine, Program } from '@/types/fitness';

type Tab = 'programs' | 'routines';

/** Sorts favorites first while preserving stored order within each group. */
function favoritesFirst<T extends { isFavorite?: boolean }>(items: T[]): T[] {
  const favs: T[] = [], rest: T[] = [];
  items.forEach(i => (i.isFavorite ? favs : rest).push(i));
  return [...favs, ...rest];
}

function SortableRow({ id, children }: { id: string; children: (handleProps: { attributes: any; listeners: any }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: 'relative',
    boxShadow: isDragging ? '0 12px 30px hsl(var(--background) / 0.6)' : undefined,
    opacity: isDragging ? 0.9 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="gym-card">
      {children({ attributes, listeners })}
    </div>
  );
}

export default function RoutinesPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(n => n + 1);

  const programs = useMemo(() => favoritesFirst(getPrograms()), [tick]);
  const standaloneRoutines = useMemo(() => favoritesFirst(getStandaloneRoutines()), [tick]);

  const [tab, setTab] = useState<Tab>('programs');
  const [reorderMode, setReorderMode] = useState(false);

  const [showCreateRoutine, setShowCreateRoutine] = useState(false);
  const [newRoutineName, setNewRoutineName] = useState('');
  const [newRoutineDesc, setNewRoutineDesc] = useState('');

  const [showCreateProgram, setShowCreateProgram] = useState(false);
  const [newProgramName, setNewProgramName] = useState('');
  const [newProgramDesc, setNewProgramDesc] = useState('');

  const [logToDateRoutine, setLogToDateRoutine] = useState<Routine | null>(null);
  const [renameRoutine, setRenameRoutine] = useState<Routine | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteRoutineTarget, setDeleteRoutineTarget] = useState<Routine | null>(null);

  const [logToDateProgram, setLogToDateProgram] = useState<Program | null>(null);
  const [renameProgram, setRenameProgram] = useState<Program | null>(null);
  const [renameProgramValue, setRenameProgramValue] = useState('');

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
  );

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

  const duplicateRoutineInto = (r: Routine, overrides: Partial<Routine> = {}): Routine => {
    const newRoutine: Routine = { ...r, id: generateId(), name: overrides.name ?? `${r.name} ${t('routines.copySuffix')}`, ...overrides };
    addRoutine(newRoutine);
    getExercisesForRoutine(r.id).forEach(re => {
      const { id: _i, routineId: _r, ...rest } = re;
      addRoutineExercise({ ...rest, id: generateId(), routineId: newRoutine.id });
    });
    return newRoutine;
  };

  const handleDuplicate = (r: Routine) => { duplicateRoutineInto(r); refresh(); };

  const handleDuplicateProgram = (p: Program) => {
    const newProgram: Program = {
      ...p,
      id: generateId(),
      name: `${p.name} ${t('programs.copySuffix')}`,
      createdAt: new Date().toISOString(),
      isFavorite: false,
    };
    addProgram(newProgram);
    getRoutinesForProgram(p.id).forEach(r => {
      duplicateRoutineInto(r, { name: r.name, programId: newProgram.id, isFavorite: false });
    });
    refresh();
  };

  const handleLogRoutine = (r: Routine, date: Date = new Date()) => {
    const dateStr = createWorkoutFromRoutine(r, date);
    setLogToDateRoutine(null);
    setLogToDateProgram(null);
    const w = getWorkoutByDate(dateStr);
    if (w) startSession(w.id);
    navigate(`/workout/${dateStr}`);
  };

  const openLogToDateProgram = (p: Program) => {
    const routines = getRoutinesForProgram(p.id);
    if (routines.length === 1) setLogToDateRoutine(routines[0]);
    else setLogToDateProgram(p);
  };

  // Reorder helpers — operate on the currently displayed order (favorites first).
  const persistProgramOrder = (ordered: Program[]) => {
    reorderPrograms(ordered.map(p => p.id));
    refresh();
  };
  const persistRoutineOrder = (ordered: Routine[]) => {
    reorderStandaloneRoutines(ordered.map(r => r.id));
    refresh();
  };

  const moveProgram = (id: string, dir: -1 | 1) => {
    const idx = programs.findIndex(p => p.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= programs.length) return;
    // Constrain within the same favorite/non-favorite group.
    if (programs[idx].isFavorite !== programs[target].isFavorite) return;
    persistProgramOrder(arrayMove(programs, idx, target));
  };
  const moveRoutine = (id: string, dir: -1 | 1) => {
    const idx = standaloneRoutines.findIndex(r => r.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= standaloneRoutines.length) return;
    if (standaloneRoutines[idx].isFavorite !== standaloneRoutines[target].isFavorite) return;
    persistRoutineOrder(arrayMove(standaloneRoutines, idx, target));
  };

  const onDragEndPrograms = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = programs.findIndex(p => p.id === active.id);
    const newIdx = programs.findIndex(p => p.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    // Only reorder within the same group; otherwise ignore to keep favorites precedence.
    if (programs[oldIdx].isFavorite !== programs[newIdx].isFavorite) return;
    persistProgramOrder(arrayMove(programs, oldIdx, newIdx));
  };
  const onDragEndRoutines = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = standaloneRoutines.findIndex(r => r.id === active.id);
    const newIdx = standaloneRoutines.findIndex(r => r.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    if (standaloneRoutines[oldIdx].isFavorite !== standaloneRoutines[newIdx].isFavorite) return;
    persistRoutineOrder(arrayMove(standaloneRoutines, oldIdx, newIdx));
  };

  const tabHasItems = tab === 'programs' ? programs.length > 0 : standaloneRoutines.length > 0;

  return (
    <div
      className="flex min-h-[100dvh] flex-col"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6rem)' }}
    >
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
          <h1 className="font-display text-xl font-bold">{t('routines.title')}</h1>
          <div className="flex items-center gap-2">
            {reorderMode ? (
              <Button size="sm" onClick={() => setReorderMode(false)} className="gap-1.5 rounded-full bg-primary text-primary-foreground">
                <Check className="h-4 w-4" /> {t('routines.done')}
              </Button>
            ) : (
              <>
                {tabHasItems && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setReorderMode(true)}
                    className="h-9 w-9 shrink-0 rounded-full"
                    aria-label={t('routines.reorder')}
                    title={t('routines.reorder')}
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                )}
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
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-4">
        <Tabs value={tab} onValueChange={(v) => { setTab(v as Tab); setReorderMode(false); }} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="programs">{t('routines.tabs.programs')}</TabsTrigger>
            <TabsTrigger value="routines">{t('routines.tabs.routines')}</TabsTrigger>
          </TabsList>

          {reorderMode && (
            <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
              {t('routines.reorderHint')}
            </div>
          )}

          <TabsContent value="programs" className="space-y-3 mt-0">
            {programs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Layers className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-1">{t('programs.emptyTitle')}</p>
                <p className="text-sm text-muted-foreground">{t('programs.emptyHint')}</p>
              </div>
            ) : reorderMode ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndPrograms}>
                <SortableContext items={programs.map(p => p.id)} strategy={verticalListSortingStrategy}>
                  {programs.map((p, i) => (
                    <SortableRow key={p.id} id={p.id}>
                      {({ attributes, listeners }) => (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={t('routines.dragHandle')}
                            {...attributes}
                            {...listeners}
                            className="touch-none inline-flex h-10 w-8 items-center justify-center text-muted-foreground cursor-grab active:cursor-grabbing"
                            style={{ touchAction: 'none' }}
                          >
                            <GripVertical className="h-5 w-5" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-1.5">
                              <Layers className="h-4 w-4 shrink-0 mt-0.5 text-primary/80" />
                              <h3 className="font-display min-w-0 flex-1 font-semibold text-[15px] leading-snug line-clamp-2 break-words">{p.name}</h3>
                              {p.isFavorite && <Star className="h-3.5 w-3.5 shrink-0 mt-0.5 fill-yellow-400 text-yellow-400" />}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col">
                            <button
                              type="button"
                              aria-label={t('routines.moveUp')}
                              onClick={() => moveProgram(p.id, -1)}
                              disabled={i === 0 || programs[i - 1]?.isFavorite !== p.isFavorite}
                              className="inline-flex h-6 w-8 items-center justify-center text-muted-foreground disabled:opacity-30"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={t('routines.moveDown')}
                              onClick={() => moveProgram(p.id, 1)}
                              disabled={i === programs.length - 1 || programs[i + 1]?.isFavorite !== p.isFavorite}
                              className="inline-flex h-6 w-8 items-center justify-center text-muted-foreground disabled:opacity-30"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </SortableRow>
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              programs.map(p => {
                const count = getRoutinesForProgram(p.id).length;
                return (
                  <div key={p.id} className="gym-card">
                    <div className="flex items-start justify-between gap-1.5">
                      <button onClick={() => navigate(`/program/${p.id}`)} className="min-w-0 flex-1 text-left">
                        <div className="flex items-start gap-1.5">
                          <Layers className="h-4 w-4 shrink-0 mt-0.5 text-primary/80" />
                          <h3 className="font-display min-w-0 flex-1 font-semibold text-[15px] leading-snug line-clamp-2 break-words">{p.name}</h3>
                        </div>
                        {p.description && <p className="mt-0.5 text-xs text-muted-foreground/70 line-clamp-2 break-words">{p.description}</p>}
                        <p className="mt-1 text-xs text-muted-foreground/70 truncate">{t('programs.workoutDays', { count })}</p>
                      </button>
                      <div className="flex shrink-0 items-center gap-0">
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
                          <Star className={`h-4 w-4 transition-colors ${p.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                        </button>
                        <button onClick={() => navigate(`/program/${p.id}`)} className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground">
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => openLogToDateProgram(p)}><CalendarPlus className="h-4 w-4 mr-2" /> {t('programs.actions.logToDate')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicateProgram(p)}><Copy className="h-4 w-4 mr-2" /> {t('programs.actions.duplicate')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setRenameProgramValue(p.name); setRenameProgram(p); }}><Pencil className="h-4 w-4 mr-2" /> {t('programs.actions.rename')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteProgram(p.id)} className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" /> {t('programs.actions.delete')}
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
            ) : reorderMode ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndRoutines}>
                <SortableContext items={standaloneRoutines.map(r => r.id)} strategy={verticalListSortingStrategy}>
                  {standaloneRoutines.map((r, i) => (
                    <SortableRow key={r.id} id={r.id}>
                      {({ attributes, listeners }) => (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={t('routines.dragHandle')}
                            {...attributes}
                            {...listeners}
                            className="touch-none inline-flex h-10 w-8 items-center justify-center text-muted-foreground cursor-grab active:cursor-grabbing"
                            style={{ touchAction: 'none' }}
                          >
                            <GripVertical className="h-5 w-5" />
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-1.5">
                              <h3 className="font-display min-w-0 flex-1 font-semibold text-[15px] leading-snug line-clamp-2 break-words">{r.name}</h3>
                              {r.isFavorite && <Star className="h-3.5 w-3.5 shrink-0 mt-0.5 fill-yellow-400 text-yellow-400" />}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col">
                            <button
                              type="button"
                              aria-label={t('routines.moveUp')}
                              onClick={() => moveRoutine(r.id, -1)}
                              disabled={i === 0 || standaloneRoutines[i - 1]?.isFavorite !== r.isFavorite}
                              className="inline-flex h-6 w-8 items-center justify-center text-muted-foreground disabled:opacity-30"
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              aria-label={t('routines.moveDown')}
                              onClick={() => moveRoutine(r.id, 1)}
                              disabled={i === standaloneRoutines.length - 1 || standaloneRoutines[i + 1]?.isFavorite !== r.isFavorite}
                              className="inline-flex h-6 w-8 items-center justify-center text-muted-foreground disabled:opacity-30"
                            >
                              <ArrowDown className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </SortableRow>
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              standaloneRoutines.map(r => {
                const routineExercises = getExercisesForRoutine(r.id);
                return (
                  <div key={r.id} className="gym-card">
                    <div className="flex items-start justify-between gap-1.5">
                      <button onClick={() => navigate(`/routine/${r.id}`)} className="min-w-0 flex-1 text-left">
                        <h3 className="font-display font-semibold text-[15px] leading-snug line-clamp-2 break-words">{r.name}</h3>
                        {r.description && <p className="mt-0.5 text-xs text-muted-foreground/70 line-clamp-2 break-words">{r.description}</p>}
                        <p className="mt-1 text-xs text-muted-foreground/70 truncate">{t('routines.exercises', { count: routineExercises.length })}</p>
                      </button>
                      <div className="flex shrink-0 items-center gap-0">
                        <button
                          type="button"
                          aria-label={r.isFavorite ? t('routines.unfavorite') : t('routines.favorite')}
                          aria-pressed={!!r.isFavorite}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRoutineFavorite(r.id);
                            try { (navigator as any).vibrate?.(15); } catch {}
                            refresh();
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground active:scale-90 transition-transform"
                        >
                          <Star className={`h-4 w-4 transition-colors ${r.isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                        </button>
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
                            <DropdownMenuItem onClick={() => { setRenameValue(r.name); setRenameRoutine(r); }}><Pencil className="h-4 w-4 mr-2" /> {t('routines.actions.rename')}</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setDeleteRoutineTarget(r)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> {t('routines.actions.delete')}</DropdownMenuItem>
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

      {/* Rename routine dialog */}
      <Dialog open={!!renameRoutine} onOpenChange={open => { if (!open) setRenameRoutine(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-base">{t('routines.renameTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              placeholder={t('routines.createRoutineNamePh')}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRenameRoutine(null)}>{t('routines.cancel')}</Button>
              <Button
                disabled={!renameValue.trim() || (renameRoutine ? renameValue.trim() === renameRoutine.name : true)}
                onClick={() => {
                  if (!renameRoutine) return;
                  const name = renameValue.trim();
                  if (!name || name === renameRoutine.name) { setRenameRoutine(null); return; }
                  updateRoutine({ ...renameRoutine, name });
                  setRenameRoutine(null);
                  refresh();
                }}
                className="bg-primary text-primary-foreground"
              >
                {t('routines.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pick routine from program dialog */}
      <Dialog open={!!logToDateProgram} onOpenChange={open => { if (!open) setLogToDateProgram(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-base">{t('programs.pickRoutineTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('programs.pickRoutineHint', { name: logToDateProgram?.name ?? '' })}</p>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {logToDateProgram && getRoutinesForProgram(logToDateProgram.id).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t('programs.noRoutinesToLog')}</p>
            ) : (
              logToDateProgram && getRoutinesForProgram(logToDateProgram.id).map(r => (
                <button
                  key={r.id}
                  onClick={() => { setLogToDateProgram(null); setLogToDateRoutine(r); }}
                  className="w-full rounded-lg border border-border bg-card/50 p-3 text-left text-sm font-medium hover:bg-card active:scale-[0.99] transition"
                >
                  {r.name}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename program dialog */}
      <Dialog open={!!renameProgram} onOpenChange={open => { if (!open) setRenameProgram(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-base">{t('programs.renameTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              autoFocus
              value={renameProgramValue}
              onChange={e => setRenameProgramValue(e.target.value)}
              placeholder={t('programs.namePlaceholder')}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRenameProgram(null)}>{t('programs.cancel')}</Button>
              <Button
                disabled={!renameProgramValue.trim() || (renameProgram ? renameProgramValue.trim() === renameProgram.name : true)}
                onClick={() => {
                  if (!renameProgram) return;
                  const name = renameProgramValue.trim();
                  if (!name || name === renameProgram.name) { setRenameProgram(null); return; }
                  updateProgram({ ...renameProgram, name });
                  setRenameProgram(null);
                  refresh();
                }}
                className="bg-primary text-primary-foreground"
              >
                {t('programs.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete routine confirmation */}
      <AlertDialog open={!!deleteRoutineTarget} onOpenChange={open => { if (!open) setDeleteRoutineTarget(null); }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-base">
              {t('routines.deleteDialog.title', 'Delete routine?')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('routines.deleteDialog.message', {
                name: deleteRoutineTarget?.name ?? '',
                defaultValue: 'Are you sure you want to delete "{{name}}"? This cannot be undone.',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteRoutineTarget(null)}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteRoutineTarget) return;
                handleDeleteRoutine(deleteRoutineTarget.id);
                setDeleteRoutineTarget(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
