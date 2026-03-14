import { useState, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { getCategories, saveCategories, addExercise, generateId } from '@/lib/storage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SetType, WeightUnit, Exercise } from '@/types/fitness';
import { SET_TYPE_LABELS } from '@/types/fitness';

interface Props {
  onSave: () => void;
  onCancel: () => void;
}

const SET_TYPES: SetType[] = ['WEIGHT_REPS', 'WEIGHT_TIME', 'REPS_DISTANCE', 'REPS_TIME', 'WEIGHT_ONLY'];

export default function CustomExerciseForm({ onSave, onCancel }: Props) {
  const categories = useMemo(() => getCategories(), []);

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [setType, setSetType] = useState<SetType>('WEIGHT_REPS');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg');
  const [defaultSets, setDefaultSets] = useState(3);
  const [defaultRepsMin, setDefaultRepsMin] = useState(8);
  const [defaultRepsMax, setDefaultRepsMax] = useState(12);
  const [defaultRestSeconds, setDefaultRestSeconds] = useState(90);
  const [notes, setNotes] = useState('');

  const showReps = setType === 'WEIGHT_REPS' || setType === 'REPS_DISTANCE' || setType === 'REPS_TIME';
  const repsLabel = setType === 'REPS_TIME' ? 'Default Reps' : setType === 'REPS_DISTANCE' ? 'Default Reps' : 'Default Reps Range';

  const handleSave = () => {
    if (!name.trim()) return;

    let finalCategoryId = categoryId;
    if (showNewCategory && newCategoryName.trim()) {
      const newCat = { id: generateId(), name: newCategoryName.trim(), sortOrder: categories.length };
      const allCats = [...categories, newCat];
      saveCategories(allCats);
      finalCategoryId = newCat.id;
    }

    const exercise: Exercise = {
      id: generateId(),
      name: name.trim(),
      categoryId: finalCategoryId,
      type: (setType === 'REPS_DISTANCE' || setType === 'REPS_TIME') && !['WEIGHT_REPS', 'WEIGHT_TIME', 'WEIGHT_ONLY'].includes(setType) ? 'CARDIO' : 'RESISTANCE',
      setType,
      weightUnit,
      defaultRepsMin: showReps ? defaultRepsMin : null,
      defaultRepsMax: showReps ? defaultRepsMax : null,
      defaultSets,
      defaultRestSeconds,
      notes,
      isFavorite: false,
      isCustom: true,
    };

    addExercise(exercise);
    onSave();
  };

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onCancel} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-display text-lg font-bold">Create Exercise</h2>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {/* Name */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Exercise name" />
        </div>

        {/* Muscle Group */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Muscle Group *</Label>
          {!showNewCategory ? (
            <div className="flex gap-2">
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setShowNewCategory(true)} className="shrink-0 text-xs">
                + New
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="New category name" className="flex-1" />
              <Button variant="ghost" size="sm" onClick={() => setShowNewCategory(false)} className="text-xs">Cancel</Button>
            </div>
          )}
        </div>

        {/* Set Type */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Set Type *</Label>
          <div className="grid grid-cols-1 gap-1.5">
            {SET_TYPES.map(st => (
              <button
                key={st}
                onClick={() => setSetType(st)}
                className={`text-left px-3 py-2 rounded-lg text-sm transition-colors border ${
                  setType === st
                    ? 'bg-primary/15 border-primary/40 text-foreground'
                    : 'border-border hover:bg-secondary text-muted-foreground'
                }`}
              >
                {SET_TYPE_LABELS[st]}
              </button>
            ))}
          </div>
        </div>

        {/* Weight Unit */}
        {['WEIGHT_REPS', 'WEIGHT_TIME', 'WEIGHT_ONLY'].includes(setType) && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Weight Unit</Label>
            <div className="flex gap-2">
              {(['kg', 'lb'] as WeightUnit[]).map(u => (
                <button
                  key={u}
                  onClick={() => setWeightUnit(u)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    weightUnit === u
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
            <Button variant="outline" size="sm" onClick={() => setDefaultSets(Math.max(1, defaultSets - 1))}>-</Button>
            <span className="text-lg font-bold w-8 text-center">{defaultSets}</span>
            <Button variant="outline" size="sm" onClick={() => setDefaultSets(Math.min(10, defaultSets + 1))}>+</Button>
          </div>
        </div>

        {/* Default Reps */}
        {showReps && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{repsLabel}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number" value={defaultRepsMin}
                onChange={e => setDefaultRepsMin(parseInt(e.target.value) || 0)}
                className="w-20 text-center"
              />
              <span className="text-muted-foreground">—</span>
              <Input
                type="number" value={defaultRepsMax}
                onChange={e => setDefaultRepsMax(parseInt(e.target.value) || 0)}
                className="w-20 text-center"
              />
            </div>
          </div>
        )}

        {/* Default Rest */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Default Rest: {defaultRestSeconds}s</Label>
          <Slider
            value={[defaultRestSeconds]}
            onValueChange={v => setDefaultRestSeconds(v[0])}
            min={30} max={300} step={15}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>30s</span><span>300s</span>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Notes (form cues, tips)</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t border-border mt-3">
        <Button variant="ghost" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button className="flex-1" onClick={handleSave} disabled={!name.trim()}>Save Exercise</Button>
      </div>
    </div>
  );
}
