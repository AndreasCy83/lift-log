import { useState, useMemo, useEffect } from 'react';
import { Search, Plus, Dumbbell, Timer, Route, Clock, Weight } from 'lucide-react';
import { getExercises, getCategories, getExerciseUsageFrequency } from '@/lib/storage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  const usageFrequency = useMemo(() => getExerciseUsageFrequency(), []);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCustomForm, setShowCustomForm] = useState(false);
  const listScrollRef = React.useRef<HTMLDivElement>(null);

  // Always derive the visible list from the latest state in a single pass.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = exercises.filter(e => {
      if (selectedCategory && e.categoryId !== selectedCategory) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
    return base.sort((a, b) => {
      const freqA = usageFrequency[a.id] || 0;
      const freqB = usageFrequency[b.id] || 0;
      if (freqB !== freqA) return freqB - freqA;
      return a.name.localeCompare(b.name);
    });
  }, [exercises, selectedCategory, search, usageFrequency]);

  // Reset scroll position whenever the filter inputs change so the user sees the new list from the top.
  useEffect(() => {
    if (listScrollRef.current) listScrollRef.current.scrollTop = 0;
  }, [selectedCategory, search]);

  const handleSelectCategory = (catId: string | null) => {
    setSelectedCategory(prev => (catId !== null && prev === catId ? null : catId));
  };


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




  useEffect(() => {
    const pills = document.getElementById('category-pills-container');
    if (!pills) return;

    const lockHeight = () => {
      pills.style.minHeight = '40px';
      pills.style.height = '40px';
    };

    window.visualViewport?.addEventListener('resize', lockHeight);
    window.addEventListener('resize', lockHeight);

    return () => {
      window.visualViewport?.removeEventListener('resize', lockHeight);
      window.removeEventListener('resize', lockHeight);
    };
  }, []);

  if (showCustomForm) {
    return <CustomExerciseForm onSave={handleCustomCreated} onCancel={() => setShowCustomForm(false)} />;
  }

  return (
    <div className="flex flex-col h-full min-h-0 px-1">
      {/* Sticky top section — search + category pills */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, flexShrink: 0, minHeight: 'fit-content' }} className="bg-background">
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search exercises..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Muscle Group Chips */}
        <div
          id="category-pills-container"
          className="flex gap-2 overflow-x-auto pb-3 flex-nowrap"
          style={{ WebkitOverflowScrolling: 'touch', minHeight: 40, height: 40, flexShrink: 0 }}
        >
        <button
          onClick={() => setSelectedCategory(null)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
            !selectedCategory ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
          style={{ flexShrink: 0, minWidth: 40 }}
        >
          All
        </button>
        {categories.map(cat => {
          const count = getCategoryCount(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                selectedCategory === cat.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
              style={{ flexShrink: 0, minWidth: 40 }}
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
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-1">
          {filtered.map(ex => {
            const isSelected = selected.has(ex.id);
            const sessionCount = usageFrequency[ex.id] || 0;
            return (
              <button
                key={ex.id}
                onClick={() => toggleSelect(ex.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-start gap-2 ${
                  isSelected ? 'bg-primary/15 border border-primary/30' : 'hover:bg-secondary border border-transparent'
                }`}
              >
                <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                  isSelected ? 'bg-primary border-primary' : 'border-border'
                }`}>
                  {isSelected && <span className="text-primary-foreground text-xs font-bold">✓</span>}
                </div>

                <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
                  {SET_TYPE_ICONS[ex.setType]}
                </div>

                <div className="flex-1">
                  <span className="text-sm font-medium">{ex.name}</span>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: getCategoryColor(ex.categoryId) }}
                    />
                    <span>{categories.find(c => c.id === ex.categoryId)?.name}</span>
                    {ex.isCustom && (
                      <>
                        <span>·</span>
                        <span>Custom</span>
                      </>
                    )}
                    {sessionCount > 0 && (
                      <>
                        <span>·</span>
                        <span>{sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}</span>
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
      <div className="flex items-center gap-2 pt-3 border-t border-border mt-3 pb-[env(safe-area-inset-bottom,0px)] pr-4 w-full overflow-visible">
        <Button variant="outline" size="sm" onClick={() => setShowCustomForm(true)} className="gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" /> Custom
        </Button>
        <div className="flex-1 min-w-0" />
        <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">Cancel</Button>
        <Button size="sm" onClick={handleConfirm} disabled={selected.size === 0} className="gap-1.5 shrink-0 mr-2">
          Add{selected.size > 0 && ` (${selected.size})`}
        </Button>
      </div>
    </div>
  );
}
