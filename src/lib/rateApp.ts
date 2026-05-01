let showReviewDialogFn: (() => void) | null = null;
export function registerReviewDialog(fn: () => void) {
  showReviewDialogFn = fn;
}
export const requestReview = async (): Promise<void> => {
  console.log('Rate app triggered');
  if (showReviewDialogFn) {
    showReviewDialogFn();
    localStorage.setItem('lastPromptedDate', Date.now().toString());
  }
};
export function shouldShowReview(): boolean {
  if (localStorage.getItem('hasGivenFeedback') === 'true') return false;
  const storedWorkouts = localStorage.getItem('completedWorkouts');
  const workouts = storedWorkouts ? parseInt(storedWorkouts) : 0;
  if (isNaN(workouts) || workouts < 5) return false;
  const last = localStorage.getItem('lastPromptedDate');
  if (last) {
    const daysSince = (Date.now() - parseInt(last)) / (1000 * 60 * 60 * 24);
    if (daysSince < 14) return false;
  }
  return true;
}
export function incrementWorkoutCount(): void {
  const storedWorkouts = localStorage.getItem('completedWorkouts');
  const current = storedWorkouts ? parseInt(storedWorkouts) : 0;
  const safe = isNaN(current) ? 0 : current;
  localStorage.setItem('completedWorkouts', (safe + 1).toString());
  console.log('Completed workouts:', safe + 1);
}
