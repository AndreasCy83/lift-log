import { useState } from 'react';
import { BodyEntry } from '@/types/bodyTracker';
import { deleteBodyEntry } from '@/lib/bodyTrackerStorage';
import { getSettings } from '@/lib/storage';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';
import { format } from 'date-fns';
import { ChevronLeft, Trash2, Edit2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface Props {
  entries: BodyEntry[];
  onBack: () => void;
  onEdit: (entry: BodyEntry) => void;
  onRefresh: () => void;
}

export default function BodyHistoryList({ entries, onBack, onEdit, onRefresh }: Props) {
  const settings = getSettings();
  const wu = settings.weightUnit;
  const unitLabel = weightUnitLabel(wu);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Group by month
  const grouped = entries.reduce<Record<string, BodyEntry[]>>((acc, e) => {
    const key = e.date.slice(0, 7); // YYYY-MM
    (acc[key] = acc[key] || []).push(e);
    return acc;
  }, {});

  const handleDelete = () => {
    if (deleteId) {
      deleteBodyEntry(deleteId);
      setDeleteId(null);
      onRefresh();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
        <button onClick={onBack} className="p-1"><ChevronLeft className="h-5 w-5" /></button>
        <h2 className="font-display text-lg font-semibold">History</h2>
        <span className="text-xs text-muted-foreground ml-auto">{entries.length} entries</span>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
        {Object.entries(grouped).map(([month, items]) => (
          <div key={month}>
            <div className="sticky top-0 z-10 px-4 py-2 bg-background/95 backdrop-blur-sm border-b border-border">
              <span className="text-sm font-semibold text-primary">
                {format(new Date(month + '-01T12:00:00'), 'MMMM yyyy')}
              </span>
            </div>
            {items.map(entry => (
              <div
                key={entry.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-border/50 active:bg-muted/30 transition-colors"
              >
                {/* Date circle */}
                <div className="flex flex-col items-center justify-center w-11 h-11 rounded-full bg-primary/15 flex-shrink-0">
                  <span className="text-sm font-bold leading-none">{format(new Date(entry.date + 'T12:00:00'), 'd')}</span>
                  <span className="text-[9px] uppercase text-muted-foreground leading-none mt-0.5">{format(new Date(entry.date + 'T12:00:00'), 'EEE')}</span>
                </div>

                {/* Weight */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-primary">{(toDisplayWeight(entry.weightKg, wu) ?? 0).toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">{unitLabel}</span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                    {entry.bodyFatPercent != null && <span>BF {entry.bodyFatPercent.toFixed(1)}%</span>}
                    {entry.muscleMassPercent != null && <span>MM {entry.muscleMassPercent.toFixed(1)}%</span>}
                    {entry.note && <span className="truncate max-w-[100px]">📝 {entry.note}</span>}
                  </div>
                </div>

                {/* Time */}
                <span className="text-xs text-muted-foreground">{entry.time}</span>

                {/* Actions */}
                <button onClick={() => onEdit(entry)} className="p-1.5 text-muted-foreground hover:text-foreground"><Edit2 className="h-4 w-4" /></button>
                <button onClick={() => setDeleteId(entry.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        ))}
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-12">No entries yet. Tap + to add your first one.</p>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
