import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { handlePurchase } from '@/lib/billing';
import { Trans, useTranslation } from 'react-i18next';

interface SupportModalProps {
  open: boolean;
  workoutCount: number;
  onClose: () => void;
}

export default function SupportModal({ open, workoutCount, onClose }: SupportModalProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm bg-card border-border">
        <div className="flex flex-col items-center text-center space-y-4 py-2">
          <div className="text-5xl">🏆</div>
          <h2 className="font-display text-xl font-bold">{t('support.title')}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            <Trans
              i18nKey="support.desc"
              values={{ count: workoutCount }}
              components={[<span className="font-bold text-foreground" />]}
            />
          </p>

          <div className="grid grid-cols-2 gap-3 w-full pt-2">
            <button
              onClick={() => handlePurchase('espresso_tip')}
              className="flex flex-col items-center gap-1 rounded-xl border border-border bg-secondary p-3 hover:bg-secondary/80 transition-colors"
            >
              <span className="text-2xl">☕</span>
              <span className="text-xs font-medium">{t('support.espresso')}</span>
              <span className="text-sm font-bold text-primary">€2.99</span>
            </button>
            <button
              onClick={() => handlePurchase('protein_shake_tip')}
              className="flex flex-col items-center gap-1 rounded-xl border border-border bg-secondary p-3 hover:bg-secondary/80 transition-colors"
            >
              <span className="text-2xl">🥤</span>
              <span className="text-xs font-medium">{t('support.shake')}</span>
              <span className="text-sm font-bold text-primary">€5.99</span>
            </button>
          </div>

          <Button variant="ghost" size="sm" onClick={onClose} className="w-full mt-2">
            {t('support.later')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
