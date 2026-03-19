import { useState, useMemo } from 'react';
import { ArrowLeft, Search, Plus, Star, Pencil, ChevronRight } from 'lucide-react';
import { getExercises, getCategories, saveExercises, toggleFavorite } from '@/lib/storage';
import { getCategoryColor } from '@/lib/categoryColors';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SET_TYPE_LABELS } from '@/types/fitness';
import type { Exercise } from '@/types/fitness';
import CustomExerciseForm from '@/components/CustomExerciseForm';
import ExerciseDetailDialog from '@/components/ExerciseDetailDialog';

interface Props {
  onClose: () => void;
}

export default function ExerciseLibrary({ onClose }: Props) {
  const [exercises, setExercises] = useState(() => getExercises());
  const categories = useMemo(() => getCategories(), []);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [editExercise, setEditExercise] = useState<Exercise | null>(null);

  const filtered = useMemo(() => {
    let list = exercises;
    if (selectedCat) list = list.filter(e => e.categoryId === selectedCat);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, selectedCat, search]);

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
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedCat === cat.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
              }`}
            >
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
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{ex.name}</p>
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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-base">Edit Exercise</DialogTitle>
          </DialogHeader>
          {editExercise && (
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">Name</label>
                <Input value={editExercise.name} onChange={e => setEditExercise({ ...editExercise, name: e.target.value })} className="bg-secondary border-0" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase text-muted-foreground">Default Sets</label>
                  <Input type="number" value={editExercise.defaultSets ?? ''} onChange={e => setEditExercise({ ...editExercise, defaultSets: parseInt(e.target.value) || null })} className="bg-secondary border-0" />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-muted-foreground">Rest (sec)</label>
                  <Input type="number" value={editExercise.defaultRestSeconds ?? ''} onChange={e => setEditExercise({ ...editExercise, defaultRestSeconds: parseInt(e.target.value) || null })} className="bg-secondary border-0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase text-muted-foreground">Reps Min</label>
                  <Input type="number" value={editExercise.defaultRepsMin ?? ''} onChange={e => setEditExercise({ ...editExercise, defaultRepsMin: parseInt(e.target.value) || null })} className="bg-secondary border-0" />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-muted-foreground">Reps Max</label>
                  <Input type="number" value={editExercise.defaultRepsMax ?? ''} onChange={e => setEditExercise({ ...editExercise, defaultRepsMax: parseInt(e.target.value) || null })} className="bg-secondary border-0" />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground">Notes</label>
                <Input value={editExercise.notes} onChange={e => setEditExercise({ ...editExercise, notes: e.target.value })} className="bg-secondary border-0" />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveEdit} size="sm" className="flex-1">Save</Button>
                <Button onClick={() => setEditExercise(null)} size="sm" variant="outline" className="flex-1">Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
