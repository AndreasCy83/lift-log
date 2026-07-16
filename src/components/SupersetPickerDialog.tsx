import { useState, useEffect, useMemo, useRef } from 'react';
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
 * Superset / circuit picker. Local draft selection is initialized ONCE per
 * dialog open (on the false→true transition of `open`). After that the
 * draft is the source of truth until the user presses Save, Remove, or
 * closes the dialog — parent re-renders (workout timer ticks, prop
 * identity changes, etc.) never overwrite in-progress selection.
 */
export default function SupersetPickerDialog({
  open, onOpenChange, currentId, items, onSave,
}: Props) {
  const currentGroupId = items.find((x) => x.id === currentId)?.supersetGroupId ?? null;

  const [selected, setSelected] = useState<string[]>([currentId]);
  // Snapshot items at open time so labels/UI don't churn while user edits.
  const [snapshot, setSnapshot] = useState<SupersetPickerItem[]>(items);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      // Dialog just opened — seed from current membership exactly once.
      const seed = currentGroupId
        ? items.filter((x) => x.supersetGroupId === currentGroupId).map((x) => x.id)
        : [currentId];
      setSelected(seed);
      setSnapshot(items);
    }
    wasOpen.current = open;
  }, [open, currentGroupId, currentId, items]);


  const labels = useMemo(() => {
    const fake = items.map((it, i) => ({
      id: it.id,
      position: i,
      supersetGroupId: it.supersetGroupId ?? null,
    })) as unknown as import('@/lib/supersets').GroupableItem[];
    return computeGroupLabels(fake);
  }, [items]);

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
