import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export type LeaveAction = 'pause' | 'end' | 'keep' | 'cancel';

interface Props {
  open: boolean;
  onAction: (action: LeaveAction) => void;
}

/**
 * Confirmation dialog shown when the user tries to navigate away from the
 * workout screen while the session timer is live.
 */
export default function LeaveWorkoutDialog({ open, onAction }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onAction('cancel'); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Workout in progress</DialogTitle>
          <DialogDescription>
            Your workout session timer is still running. What would you like to do?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={() => onAction('keep')} variant="outline" className="w-full justify-center text-foreground font-semibold">
            Keep timer running &amp; leave
          </Button>
          <Button onClick={() => onAction('pause')} variant="outline" className="w-full justify-center text-foreground">
            Pause timer &amp; leave
          </Button>
          <Button onClick={() => onAction('end')} variant="outline" className="w-full justify-center text-destructive">
            End timer &amp; leave
          </Button>
          <Button onClick={() => onAction('cancel')} variant="outline" className="w-full justify-center text-muted-foreground">
            Stay on this page
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
