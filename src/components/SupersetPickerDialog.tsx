import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { computeGroupLabels } from '@/lib/supersets';

export interface SupersetPickerItem {
  id: string;
  name: string;
  categoryName?: string;
  supersetGroupId?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The exercise the user is grouping FROM (always included in the group). */
  currentId: string;
  /** All items available to group with (routine or workout exercises). */
  items: SupersetPickerItem[];
  /**
   * Called with the final list of member IDs (including currentId), ordered.
   * Empty array = dissolve/remove currentId from its group.
   */
  onSave: (memberIds: string[]) => void;
}

/**
 * Simple picker for building/editing a superset or circuit. The user checks
 * additional exercises to group with the current exercise. Grouping is one
 * membership per exercise: an exercise already in another group will be
 * moved into this group.
 */
export default function SupersetPickerDialog({
  open, onOpenChange, currentId, items, onSave,
}: Props) {
  const currentGroupId = items.find((x) => x.id === currentId)?.supersetGroupId ?? null;
  const initialSelected = useMemo(() => {
    if (currentGroupId) {
      return items
        .filter((x) => x.supersetGroupId === currentGroupId)
        .map((x) => x.id);
    }
    return [currentId];
  }, [items, currentGroupId, currentId]);

  const [selected, setSelected] = useState<string[]>(initialSelected);
  useEffect(() => { setSelected(initialSelected); }, [initialSelected, open]);

  const labels = useMemo(() => computeGroupLabels(items as unknown as { position: number; supersetGroupId?: string | null }[]), [items]);

  const toggle = (id: string) => {
    if (id === currentId) return; // current always in
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const size = selected.length;
  const kind = size >= 3 ? 'Circuit' : size === 2 ? 'Superset' : 'None';

  const others = items.filter((x) => x.id !== currentId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-4 !max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Superset / Circuit</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Pick at least one other exercise to group with this one. 2 = superset, 3+ = circuit. Grouped exercises run round-by-round.
        </p>
        <div className="flex-1 overflow-y-auto space-y-1 mt-2">
          {others.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Add another exercise first, then link them here.
            </p>
          )}
          {others.map((it) => {
            const checked = selected.includes(it.id);
            const groupLabel = it.supersetGroupId ? labels.get(it.supersetGroupId) : null;
            return (
              <button
                key={it.id}
                onClick={() => toggle(it.id)}
                className={`w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                  checked ? 'border-primary bg-primary/10' : 'border-border bg-secondary/40'
                }`}
              >
                <div className={`h-5 w-5 shrink-0 rounded border flex items-center justify-center ${
                  checked ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40'
                }`}>
                  {checked && <Check className="h-3.5 w-3.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{it.name}</div>
                  {(it.categoryName || groupLabel) && (
                    <div className="text-[10px] text-muted-foreground truncate">
                      {it.categoryName}
                      {groupLabel ? ` · already in ${groupLabel}` : ''}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <DialogFooter className="flex-row items-center justify-between gap-2 pt-2">
          <div className="text-xs text-muted-foreground">
            {size >= 2 ? `${kind} · ${size} exercises` : 'Select at least 1 more'}
          </div>
          <div className="flex gap-2">
            {currentGroupId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { onSave([]); onOpenChange(false); }}
              >
                Remove
              </Button>
            )}
            <Button
              size="sm"
              disabled={size < 2}
              onClick={() => { onSave(selected); onOpenChange(false); }}
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
