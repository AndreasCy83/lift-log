import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { registerReviewDialog } from '@/lib/rateApp';

export default function RateAppDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    registerReviewDialog(() => setOpen(true));
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <div className="text-5xl">⭐</div>
          <h2 className="text-xl font-bold">Enjoying FitLog X?</h2>
          <p className="text-sm text-muted-foreground">
            If the app has helped your training, please take a moment to rate it on Google Play. It means a lot!
          </p>
          <div className="flex flex-col gap-2 w-full mt-2">
            <Button
              onClick={() => {
                window.open(
                  'https://play.google.com/store/apps/details?id=com.andreascy83.liftlog',
                  '_blank'
                );
                setOpen(false);
              }}
            >
              ⭐ Rate on Google Play
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Maybe Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
