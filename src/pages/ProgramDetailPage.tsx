import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Play, MoreVertical, Trash2, Pencil, CalendarPlus, Copy } from 'lucide-react';
import {
  getPrograms, updateProgram, deleteProgram, getRoutinesForProgram, getStandaloneRoutines,
  getRoutines, saveRoutines, addRoutine, deleteRoutine, getExercisesForRoutine, generateId,
  addRoutineExercise,
} from '@/lib/storage';
import { createWorkoutFromRoutine } from '@/lib/routineRunner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Routine } from '@/types/fitness';

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [, force] = useState(0);
  const refresh = () => force(n => n + 1);

  const program = useMemo(() => getPrograms().find(p => p.id === id), [id]);
  const routines = useMemo(() => (id ? getRoutinesForProgram(id) : []), [id]);
  const standalone = useMemo(() => getStandaloneRoutines(), []);

  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState(program?.name ?? '');
  const [editDesc, setEditDesc] = useState(program?.description ?? '');

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const [showAddExisting, setShowAddExisting] = useState(false);
  const [logToDateRoutine, setLogToDateRoutine] = useState<Routine | null>(null);

  if (!program || !id) return <div className="p-4">{t('programs.notFound')}</div>;

  const handleSaveProgram = () => {
    updateProgram({ ...program, name: editName.trim() || program.name, description: editDesc.trim() });
    setShowEdit(false);
    refresh();
  };

  const handleDeleteProgram = () => {
    if (!confirm(t('programs.deleteConfirm'))) return;
    deleteProgram(program.id);
    navigate('/routines');
  };

  const handleCreateRoutine = () => {
    if (!newName.trim()) return;
    const r: Routine = {
      id: generateId(),
      name: newName.trim(),
      description: newDesc.trim(),
      isActive: false,
      programId: program.id,
    };
    addRoutine(r);
    setNewName(''); setNewDesc(''); setShowCreate(false);
    navigate(`/routine/${r.id}`);
  };

  const handleAttachExisting = (rid: string) => {
    const all = getRoutines();
    const next = all.map(r => r.id === rid ? { ...r, programId: program.id } : r);
    saveRoutines(next);
    setShowAddExisting(false);
    refresh();
  };

  const handleDuplicateRoutine = (r: Routine) => {
    const newRoutine: Routine = { ...r, id: generateId(), name: `${r.name} ${t('routines.copySuffix')}`, programId: program.id };
    addRoutine(newRoutine);
    const res = getExercisesForRoutine(r.id);
    res.forEach(re => {
      const { id: _i, routineId: _r, ...rest } = re;
      addRoutineExercise({ ...rest, id: generateId(), routineId: newRoutine.id });
    });
    refresh();
  };

  const handleDetachRoutine = (rid: string) => {
    const next = getRoutines().map(r => r.id === rid ? { ...r, programId: null } : r);
    saveRoutines(next);
    refresh();
  };

  const handleDeleteRoutine = (rid: string) => {
    if (!confirm(t('programs.deleteRoutineConfirm'))) return;
    deleteRoutine(rid);
    refresh();
  };

  const handleStart = (r: Routine, date: Date = new Date()) => {
    const dateStr = createWorkoutFromRoutine(r, date);
    navigate(`/workout/${dateStr}`);
  };

  return (
    <div className="flex min-h-screen flex-col pb-24">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button onClick={() => navigate('/routines')} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-lg font-bold truncate">{program.name}</h1>
            {program.description && (
              <p className="text-xs text-muted-foreground truncate">{program.description}</p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => { setEditName(program.name); setEditDesc(program.description); setShowEdit(true); }}>
                <Pencil className="h-4 w-4 mr-2" /> {t('programs.editProgram')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDeleteProgram} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> {t('programs.deleteProgram')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t('programs.workoutDaysHeader', { count: routines.length })}
          </h2>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setShowAddExisting(true)} className="h-8 text-xs">
              {t('programs.attach')}
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)} className="h-8 gap-1 rounded-full bg-primary text-primary-foreground text-xs">
              <Plus className="h-3.5 w-3.5" /> {t('programs.new')}
            </Button>
          </div>
        </div>

        {routines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground mb-1">{t('programs.noWorkoutDays')}</p>
            <p className="text-xs text-muted-foreground">{t('programs.noWorkoutDaysHint')}</p>
          </div>
        ) : (
          routines.map(r => {
            const exCount = getExercisesForRoutine(r.id).length;
            return (
              <div key={r.id} className="gym-card">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => navigate(`/routine/${r.id}`)} className="flex-1 text-left min-w-0">
                    <h3 className="font-display font-semibold truncate">{r.name}</h3>
                    {r.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{t('routines.exercises', { count: exCount })}</p>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => handleStart(r)} className="text-primary">
                      <Play className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => setLogToDateRoutine(r)}>
                          <CalendarPlus className="h-4 w-4 mr-2" /> {t('routines.actions.logToDate')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicateRoutine(r)}>
                          <Copy className="h-4 w-4 mr-2" /> {t('routines.actions.duplicate')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDetachRoutine(r.id)}>
                          {t('routines.actions.removeFromProgram')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteRoutine(r.id)} className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> {t('routines.actions.delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit program */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('programs.editTitle')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder={t('programs.namePh')} value={editName} onChange={e => setEditName(e.target.value)} />
            <Textarea placeholder={t('routines.descriptionPh')} value={editDesc} onChange={e => setEditDesc(e.target.value)} />
            <Button onClick={handleSaveProgram} className="w-full bg-primary text-primary-foreground">{t('routines.save')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New routine in program */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('programs.newWorkoutDay')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder={t('programs.workoutDayNamePh')} value={newName} onChange={e => setNewName(e.target.value)} />
            <Textarea placeholder={t('routines.descriptionPh')} value={newDesc} onChange={e => setNewDesc(e.target.value)} />
            <Button onClick={handleCreateRoutine} className="w-full bg-primary text-primary-foreground">{t('routines.create')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Attach existing standalone routine */}
      <Dialog open={showAddExisting} onOpenChange={setShowAddExisting}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('programs.attachExisting')}</DialogTitle></DialogHeader>
          {standalone.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('programs.noStandaloneToAttach')}</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {standalone.map(r => (
                <button
                  key={r.id}
                  onClick={() => handleAttachExisting(r.id)}
                  className="w-full text-left rounded-lg border border-border/60 bg-secondary/30 hover:bg-secondary/60 px-3 py-2.5 transition-colors"
                >
                  <div className="text-sm font-medium">{r.name}</div>
                  {r.description && <div className="text-xs text-muted-foreground truncate">{r.description}</div>}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Log to date */}
      <Dialog open={!!logToDateRoutine} onOpenChange={o => { if (!o) setLogToDateRoutine(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-base">{t('programs.logToDateTitle', { name: logToDateRoutine?.name ?? '' })}</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={undefined}
              onSelect={(date) => {
                if (date && logToDateRoutine) {
                  handleStart(logToDateRoutine, date);
                  setLogToDateRoutine(null);
                }
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
