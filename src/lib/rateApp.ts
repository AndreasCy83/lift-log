// NATIVE_REVIEW_PLACEHOLDER - replace locally after publishing
import { toast } from 'sonner';

export const requestReview = async (): Promise<void> => {
  // TODO: Replace with @capacitor/rate-app after publishing to Play Store
  console.log('Rate app triggered');
  toast('⭐ Enjoying FitLog X?', {
    description: 'Tap below to rate us on Google Play!',
    action: {
      label: 'Rate Now',
      onClick: () => window.open(
        'https://play.google.com/store/apps/details?id=com.andreascy83.liftlog',
        '_blank'
      ),
    },
    duration: 8000,
  });
};

// Trigger sequence: 10, 30, then every 30 after (60, 90, 120...)
export function shouldRequestReview(count: number): boolean {
  if (count === 10) return true;
  if (count === 30) return true;
  if (count > 30 && count % 30 === 0) return true;
  return false;
}
