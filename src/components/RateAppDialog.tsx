import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { registerReviewDialog } from '@/lib/rateApp';
import { toast } from 'sonner';

type Step = 'sentiment' | 'positive' | 'negative' | null;

export default function RateAppDialog() {
  const [step, setStep] = useState<Step>(null);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    registerReviewDialog(() => setStep('sentiment'));
  }, []);

  const handleClose = () => {
    localStorage.setItem('lastPromptedDate', Date.now().toString());
    setStep(null);
    setFeedback('');
  };

  const handlePermanentClose = () => {
    localStorage.setItem('hasGivenFeedback', 'true');
    setStep(null);
    setFeedback('');
  };

  const handleSendFeedback = () => {
    console.log('User feedback:', feedback);
    toast.success('Thank you for your feedback! 🙏');
    handlePermanentClose();
  };

  return (
    <Dialog open={step !== null} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="sr-only">Rate FitLog X</DialogTitle>
        <DialogDescription className="sr-only">Help us improve by sharing your feedback.</DialogDescription>
        {step === 'sentiment' && (
          <div className="flex flex-col items-center text-center gap-3 py-2">
            <div className="text-5xl">💪</div>
            <h2 className="text-xl font-bold">Smashing your goals with FitLog X?</h2>
            <p className="text-sm text-muted-foreground">We'd love to know how you're getting on!</p>
            <div className="flex flex-col gap-2 w-full mt-2">
              <Button onClick={() => setStep('positive')}>Yes, I love it! ❤️</Button>
              <Button variant="outline" onClick={() => setStep('negative')}>I have some feedback</Button>
              <Button variant="ghost" onClick={handleClose}>Maybe Later</Button>
            </div>
          </div>
        )}
        {step === 'positive' && (
          <div className="flex flex-col items-center text-center gap-3 py-2">
            <div className="text-5xl">⭐</div>
            <h2 className="text-xl font-bold">That's awesome!</h2>
            <p className="text-sm text-muted-foreground">
              Would you mind supporting us with a review on Google Play? It helps us a lot!
            </p>
            <div className="flex flex-col gap-2 w-full mt-2">
              <Button onClick={() => {
                window.open('https://play.google.com/store/apps/details?id=com.andreascy83.liftlog', '_blank');
                handlePermanentClose();
              }}>
                ⭐ Sure, let's go!
              </Button>
              <Button variant="ghost" onClick={handleClose}>Maybe Later</Button>
            </div>
          </div>
        )}
        {step === 'negative' && (
          <div className="flex flex-col items-center text-center gap-3 py-2">
            <div className="text-5xl">🙏</div>
            <h2 className="text-xl font-bold">We're sorry to hear that</h2>
            <p className="text-sm text-muted-foreground">How can we make FitLog X better for you?</p>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us what could be better..."
              className="min-h-[100px] resize-none"
            />
            <div className="flex flex-col gap-2 w-full">
              <Button className="w-full" disabled={!feedback.trim()} onClick={handleSendFeedback}>
                Send Feedback
              </Button>
              <Button variant="ghost" className="w-full text-muted-foreground text-sm" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
