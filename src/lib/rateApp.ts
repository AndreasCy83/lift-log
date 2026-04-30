// NATIVE_REVIEW_PLACEHOLDER - replace locally after publishing
import { toast } from 'sonner';
let showReviewDialogFn: (() => void) | null = null;
export function registerReviewDialog(fn: () => void) {
  showReviewDialogFn = fn;
}
export const requestReview = async (): Promise<void> => {
  console.log('Rate app triggered');
  if (showReviewDialogFn) showReviewDialogFn();
};
// Sequence: every 5 opens up to 30, then every 30 (60, 90, 120...)
export function shouldRequestReview(openCount: number): boolean {
  if (openCount <= 30 && openCount % 5 === 0) return true;
  if (openCount > 30 && openCount % 30 === 0) return true;
  return false;
}
export function trackAppOpen(): void {
  const current = parseInt(localStorage.getItem('appOpenCount') || '0');
  const next = current + 1;
  localStorage.setItem('appOpenCount', next.toString());
  console.log('App open count:', next);
  if (shouldRequestReview(next)) {
    requestReview();
  }
}
