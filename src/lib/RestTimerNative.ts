/**
 * Capacitor bridge to the native Android RestTimerService.
 * Falls back to no-op on web/iOS.
 */
import { registerPlugin } from '@capacitor/core';

export interface RestTimerNativePlugin {
  startTimer(options: { seconds: number }): Promise<{ started: boolean }>;
  stopTimer(): Promise<{ stopped: boolean }>;
  addListener(event: 'timerFinished', callback: () => void): Promise<{ remove: () => void }>;
}

const RestTimerNative = registerPlugin<RestTimerNativePlugin>('RestTimerNative', {
  web: () => ({
    startTimer: async () => ({ started: false }),
    stopTimer: async () => ({ stopped: false }),
    addListener: async () => ({ remove: () => {} }),
  }),
});

export default RestTimerNative;
