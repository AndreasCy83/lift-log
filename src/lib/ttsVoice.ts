/**
 * Text-to-speech voice cues for rest timer countdown.
 * Uses browser SpeechSynthesis with fallback to beep.
 */

let ttsSupported: boolean | null = null;

function isTTSAvailable(): boolean {
  if (ttsSupported !== null) return ttsSupported;
  ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  return ttsSupported;
}

export function speakCue(text: string) {
  if (!isTTSAvailable()) {
    // Fallback: vibrate
    if (navigator.vibrate) navigator.vibrate(200);
    return;
  }
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;
    utterance.lang = 'en-US';
    window.speechSynthesis.cancel(); // Cancel any pending
    window.speechSynthesis.speak(utterance);
  } catch {
    if (navigator.vibrate) navigator.vibrate(200);
  }
}

const audioCtxRef = { current: null as AudioContext | null };

export function playFinishBeep() {
  try {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    const now = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.3, now + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.2 + 0.15);
      osc.start(now + i * 0.2);
      osc.stop(now + i * 0.2 + 0.15);
    }
  } catch {}
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}
