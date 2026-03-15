import { useState, useMemo } from 'react';
import { Search, Plus, Dumbbell, Timer, Route, Clock, Weight } from 'lucide-react';
import { getExercises, getCategories } from '@/lib/storage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Exercise, SetType } from '@/types/fitness';
import CustomExerciseForm from './CustomExerciseForm';
import { getCategoryColor } from '@/lib/categoryColors';

const SET_TYPE_ICONS: Record<SetType, React.ReactNode> = {
  WEIGHT_REPS: <Dumbbell className="h-3.5 w-3.5" />,
  WEIGHT_TIME: <Timer className="h-3.5 w-3.5" />,
  REPS_DISTANCE: <Route className="h-3.5 w-3.5" />,
  REPS_TIME: <Clock className="h-3.5 w-3.5" />,
  WEIGHT_ONLY: <Weight className="h-3.5 w-3.5" />,
};

interface Props {
  onSelect: (exerciseIds: string[]) => void;
  onClose: () => void;
}

export default function ExerciseSelectionScreen({ onSelect, onClose }: Props) {
  const [exercises, setExercises] = useState(() => getExercises());
  const categories = useMemo(() => getCategories(), []);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCustomForm, setShowCustomForm] = useState(false);

  const filtered = useMemo(() => {
    let list = exercises;
    if (selectedCategory) list = list.filter(e => e.categoryId === selectedCategory);
    if (search) list = list.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
    // Seeded first, then custom
    return list.sort((a, b) => (a.isCustom === b.isCustom ? 0 : a.isCustom ? 1 : -1));
  }, [exercises, selectedCategory, search]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    if (selected.size > 0) onSelect(Array.from(selected));
  };

  const handleCustomCreated = () => {
    setExercises(getExercises());
    setShowCustomForm(false);
  };

  const getCategoryCount = (catId: string) => {
    const count = Array.from(selected).filter(id => exercises.find(e => e.id === id)?.categoryId === catId).length;
    return count;
  };

  const formatDefaults = (ex: Exercise) => {
    const parts: string[] = [];
    if (ex.defaultSets) parts.push(`${ex.defaultSets}S`);
    if (ex.defaultRepsMin && ex.defaultRepsMax) parts.push(`${ex.defaultRepsMin}-${ex.defaultRepsMax}R`);
    else if (ex.defaultRepsMin) parts.push(`${ex.defaultRepsMin}R`);
    return parts.join(' × ') || '';
  };

  if (showCustomForm) {
    return <CustomExerciseForm onSave={handleCustomCreated} onCancel={() => setShowCustomForm(false)} />;
  }

  return (
    <div className="flex flex-col h-full min-h-0 -mx-2">
      {/* Search */}
      <div className="relative mb-3 px-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search exercises..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Muscle Group Chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 px-2 flex-nowrap" style={{ WebkitOverflowScrolling: 'touch' }}>
        <button
          onClick={() => setSelectedCategory(null)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            !selectedCategory ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          All
        </button>
        {categories.map(cat => {
          const count = getCategoryCount(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                selectedCategory === cat.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: getCategoryColor(cat.id) }}
              />
              {cat.name}
              {count > 0 && (
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary-foreground/20 text-[10px]">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Exercise List */}
      <div className="flex-1 min-h-0 max-h-[50vh] overflow-y-auto">
        <div className="space-y-1 px-2">
          {filtered.map(ex => {
            const isSelected = selected.has(ex.id);
            return (
              <button
                key={ex.id}
                onClick={() => toggleSelect(ex.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-center gap-3 ${
                  isSelected ? 'bg-primary/15 border border-primary/30' : 'hover:bg-secondary border border-transparent'
                }`}
              >
                {/* Checkbox */}
                <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                  isSelected ? 'bg-primary border-primary' : 'border-border'
                }`}>
                  {isSelected && <span className="text-primary-foreground text-xs font-bold">✓</span>}
                </div>

                {/* Icon */}
                <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
                  {SET_TYPE_ICONS[ex.setType]}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{ex.name}</span>
                    {ex.isCustom && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">Custom</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: getCategoryColor(ex.categoryId) }}
                    />
                    <span>{categories.find(c => c.id === ex.categoryId)?.name}</span>
                    {formatDefaults(ex) && (
                      <>
                        <span>·</span>
                        <span>{formatDefaults(ex)}</span>
                      </>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">No exercises found</div>
          )}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-border mt-3 px-2">
        <Button variant="outline" size="sm" onClick={() => setShowCustomForm(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Custom Exercise
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button size="sm" onClick={handleConfirm} disabled={selected.size === 0} className="gap-1.5">
          Add{selected.size > 0 && ` (${selected.size})`}
        </Button>
      </div>
    </div>
  );
}
