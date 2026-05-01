import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { handlePurchase } from '@/lib/billing';

interface SupportModalProps {
  open: boolean;
  workoutCount: number;
  onClose: () => void;
}

export default function SupportModal({ open, workoutCount, onClose }: SupportModalProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm bg-card border-border">
        <div className="flex flex-col items-center text-center space-y-4 py-2">
          <div className="text-5xl">🏆</div>
          <h2 className="font-display text-xl font-bold">You're crushing it! 💪</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You've completed <span className="font-bold text-foreground">{workoutCount}</span> workouts.
            FitLog X is free — if it's helped your training, a small tip keeps it alive.
          </p>

          <div className="grid grid-cols-2 gap-3 w-full pt-2">
            <button
              onClick={() => handlePurchase('espresso_tip')}
              className="flex flex-col items-center gap-1 rounded-xl border border-border bg-secondary p-3 hover:bg-secondary/80 transition-colors"
            >
              <span className="text-2xl">☕</span>
              <span className="text-xs font-medium">Quick Espresso</span>
              <span className="text-sm font-bold text-primary">€2.99</span>
            </button>
            <button
              onClick={() => handlePurchase('protein_shake_tip')}
              className="flex flex-col items-center gap-1 rounded-xl border border-border bg-secondary p-3 hover:bg-secondary/80 transition-colors"
            >
              <span className="text-2xl">🥤</span>
              <span className="text-xs font-medium">Protein Shake</span>
              <span className="text-sm font-bold text-primary">€5.99</span>
            </button>
          </div>

          <Button variant="ghost" size="sm" onClick={onClose} className="w-full mt-2">
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
