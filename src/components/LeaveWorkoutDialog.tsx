import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onAction('cancel'); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('workout.leaveSessionDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('workout.leaveSessionDialog.description')}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={() => onAction('keep')} variant="outline" className="w-full justify-center text-foreground font-semibold">
            {t('workout.leaveSessionDialog.keepRunning')}
          </Button>
          <Button onClick={() => onAction('pause')} variant="outline" className="w-full justify-center text-foreground">
            {t('workout.leaveSessionDialog.pauseLeave')}
          </Button>
          <Button onClick={() => onAction('end')} variant="outline" className="w-full justify-center text-destructive">
            {t('workout.leaveSessionDialog.endLeave')}
          </Button>
          <Button onClick={() => onAction('cancel')} variant="outline" className="w-full justify-center text-muted-foreground">
            {t('workout.leaveSessionDialog.stay')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
