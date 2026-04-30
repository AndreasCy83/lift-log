// NATIVE_REVIEW_PLACEHOLDER - replace locally
export const requestReview = async (): Promise<void> => {
  console.log('Rate app triggered');
};
// Trigger sequence: 10, 30, then every 30 after (60, 90, 120...)
export function shouldRequestReview(count: number): boolean {
  if (count === 10) return true;
  if (count === 30) return true;
  if (count > 30 && count % 30 === 0) return true;
  return false;
}
