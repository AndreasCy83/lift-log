import { useState, useMemo } from 'react';
import { ArrowLeft, Search, Plus, Star, Pencil, MoreVertical, History, BarChart3, Target, Trash2 } from 'lucide-react';
import { getExercises, getCategories, saveExercises, toggleFavorite, getExerciseUsageFrequency } from '@/lib/storage';
import { getCategoryColor } from '@/lib/categoryColors';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SET_TYPE_LABELS } from '@/types/fitness';
import type { Exercise, SetType, WeightUnit } from '@/types/fitness';
import CustomExerciseForm from '@/components/CustomExerciseForm';
import ExerciseDetailDialog from '@/components/ExerciseDetailDialog';
import ExerciseThumbnail from '@/components/ExerciseThumbnail';
import { useExerciseName } from '@/i18n/exerciseNames';
import { toast } from '@/hooks/use-toast';

interface Props {
  onClose: () => void;
}

export default function ExerciseLibrary({ onClose }: Props) {
  const [exercises, setExercises] = useState(() => getExercises());
  const tExName = useExerciseName();
  const categories = useMemo(() => getCategories(), []);
  const usageFrequency = useMemo(() => getExerciseUsageFrequency(), []);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [detailTab, setDetailTab] = useState<'history' | 'stats' | 'goals'>('history');
  const [editExercise, setEditExercise] = useState<Exercise | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Exercise | null>(null);

  const openDetail = (ex: Exercise, tab: 'history' | 'stats' | 'goals') => {
    setDetailTab(tab);
    setSelectedExercise(ex);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const all = getExercises().filter(e => e.id !== deleteTarget.id);
    saveExercises(all);
    setExercises(all);
    toast({ title: 'Exercise deleted', description: deleteTarget.name });
    setDeleteTarget(null);
  };

  const filtered = useMemo(() => {
    let list = exercises;
    if (selectedCat) list = list.filter(e => e.categoryId === selectedCat);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      const freqA = usageFrequency[a.id] || 0;
      const freqB = usageFrequency[b.id] || 0;
      if (freqB !== freqA) return freqB - freqA;
      return a.name.localeCompare(b.name);
    });
  }, [exercises, selectedCat, search, usageFrequency]);

  const getCatName = (catId: string) => categories.find(c => c.id === catId)?.name ?? catId;
  const getCatCount = (catId: string) => exercises.filter(e => e.categoryId === catId).length;

  const handleCustomCreated = () => {
    setShowCustomForm(false);
    setExercises(getExercises());
  };

  const handleToggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(id);
    setExercises(getExercises());
  };

  const handleSaveEdit = () => {
    if (!editExercise) return;
    const all = getExercises().map(ex => ex.id === editExercise.id ? editExercise : ex);
    saveExercises(all);
    setExercises(all);
    setEditExercise(null);
  };

  if (showCustomForm) {
    return <CustomExerciseForm onSave={handleCustomCreated} onCancel={() => setShowCustomForm(false)} />;
  }

  return (
    <div className="flex min-h-screen flex-col pb-20">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg font-bold flex-1">Exercise Library</h1>
          <Button size="sm" variant="outline" onClick={() => setShowCustomForm(true)} className="h-8 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" /> New
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg flex-1 px-4 pt-3 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search exercises..."
            className="pl-9 bg-secondary border-0 h-9"
          />
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedCat(null)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !selectedCat ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >
            All ({exercises.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id === selectedCat ? null : cat.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors border ${
                selectedCat === cat.id ? 'text-white' : 'bg-secondary text-secondary-foreground'
              }`}
              style={selectedCat === cat.id ? { backgroundColor: getCategoryColor(cat.id), borderColor: getCategoryColor(cat.id) } : { borderColor: getCategoryColor(cat.id) }}
            >
              <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: getCategoryColor(cat.id) }} />
              {cat.name} ({getCatCount(cat.id)})
            </button>
          ))}
        </div>

        {/* Exercise list */}
        <div className="space-y-1">
          {filtered.map(ex => (
            <button
              key={ex.id}
              onClick={() => setSelectedExercise(ex)}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary group"
            >
              <div
                className="h-8 w-1 rounded-full shrink-0"
                style={{ backgroundColor: getCategoryColor(ex.categoryId) }}
              />
              <ExerciseThumbnail exerciseName={ex.name} className="h-9 w-9" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{tExName(ex)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {getCatName(ex.categoryId)} · {SET_TYPE_LABELS[ex.setType]}
                </p>
              </div>
              <button
                onClick={(e) => handleToggleFavorite(ex.id, e)}
                className="p-1 text-muted-foreground hover:text-yellow-500"
              >
                <Star className={`h-4 w-4 ${ex.isFavorite ? 'fill-yellow-500 text-yellow-500' : ''}`} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setEditExercise({ ...ex }); }}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No exercises found</p>
          )}
        </div>
      </div>

      {/* Detail dialog */}
      <ExerciseDetailDialog
        open={!!selectedExercise}
        onOpenChange={(o) => { if (!o) setSelectedExercise(null); }}
        exercise={selectedExercise}
      />

      {/* Edit dialog */}
      <Dialog open={!!editExercise} onOpenChange={(o) => { if (!o) setEditExercise(null); }}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-display text-base">Edit Exercise</DialogTitle>
          </DialogHeader>
          {editExercise && (() => {
            const st = editExercise.setType;
            const showWeight = st === 'WEIGHT_REPS' || st === 'WEIGHT_TIME' || st === 'WEIGHT_ONLY';
            const showReps = st === 'WEIGHT_REPS' || st === 'REPS_DISTANCE' || st === 'REPS_TIME';
            const sets = editExercise.defaultSets ?? 3;
            const rest = editExercise.defaultRestSeconds ?? 90;
            const setTypes: SetType[] = ['WEIGHT_REPS', 'WEIGHT_TIME', 'REPS_DISTANCE', 'REPS_TIME', 'WEIGHT_ONLY'];
            return (
              <>
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Name *</Label>
                    <Input value={editExercise.name} onChange={e => setEditExercise({ ...editExercise, name: e.target.value })} placeholder="Exercise name" />
                  </div>

                  {/* Muscle Group */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Muscle Group *</Label>
                    <Select value={editExercise.categoryId} onValueChange={v => setEditExercise({ ...editExercise, categoryId: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {categories.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Set Type */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Set Type *</Label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {setTypes.map(t => (
                        <button
                          key={t}
                          onClick={() => {
                            const nextType: Exercise['type'] = (t === 'REPS_DISTANCE' || t === 'REPS_TIME') ? 'CARDIO' : 'RESISTANCE';
                            setEditExercise({ ...editExercise, setType: t, type: nextType });
                          }}
                          className={`text-left px-3 py-2 rounded-lg text-sm transition-colors border ${
                            st === t
                              ? 'bg-primary/15 border-primary/40 text-foreground'
                              : 'border-border hover:bg-secondary text-muted-foreground'
                          }`}
                        >
                          {SET_TYPE_LABELS[t]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Weight Unit */}
                  {showWeight && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Weight Unit</Label>
                      <div className="flex gap-2">
                        {(['kg', 'lb'] as WeightUnit[]).map(u => (
                          <button
                            key={u}
                            onClick={() => setEditExercise({ ...editExercise, weightUnit: u })}
                            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                              editExercise.weightUnit === u
                                ? 'bg-primary/15 border-primary/40 text-foreground'
                                : 'border-border hover:bg-secondary text-muted-foreground'
                            }`}
                          >
                            {u.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Default Sets */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Default Sets</Label>
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="sm" onClick={() => setEditExercise({ ...editExercise, defaultSets: Math.max(1, sets - 1) })}>-</Button>
                      <span className="text-lg font-bold w-8 text-center">{sets}</span>
                      <Button variant="outline" size="sm" onClick={() => setEditExercise({ ...editExercise, defaultSets: Math.min(10, sets + 1) })}>+</Button>
                    </div>
                  </div>

                  {/* Default Reps */}
                  {showReps && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Default Reps Range</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={editExercise.defaultRepsMin ?? ''}
                          onChange={e => setEditExercise({ ...editExercise, defaultRepsMin: parseInt(e.target.value) || 0 })}
                          className="w-20 text-center"
                        />
                        <span className="text-muted-foreground">—</span>
                        <Input
                          type="number"
                          value={editExercise.defaultRepsMax ?? ''}
                          onChange={e => setEditExercise({ ...editExercise, defaultRepsMax: parseInt(e.target.value) || 0 })}
                          className="w-20 text-center"
                        />
                      </div>
                    </div>
                  )}

                  {/* Default Rest */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Default Rest: {rest}s</Label>
                    <Slider
                      value={[rest]}
                      onValueChange={v => setEditExercise({ ...editExercise, defaultRestSeconds: v[0] })}
                      min={30} max={300} step={15}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>30s</span><span>300s</span>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Notes (form cues, tips)</Label>
                    <Textarea value={editExercise.notes} onChange={e => setEditExercise({ ...editExercise, notes: e.target.value })} placeholder="Optional notes..." rows={2} />
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t border-border mt-3">
                  <Button variant="ghost" className="flex-1" onClick={() => setEditExercise(null)}>Cancel</Button>
                  <Button className="flex-1" onClick={handleSaveEdit} disabled={!editExercise.name.trim()}>Save</Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
