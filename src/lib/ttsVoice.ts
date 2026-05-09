/**
 * Audio cues for rest timer countdown.
 * Uses local MP3 files instead of Web Speech API for Android Capacitor compatibility.
 */

const audioCache: Record<string, HTMLAudioElement> = {};

function getAudio(src: string): HTMLAudioElement {
  if (!audioCache[src]) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.load();
    audioCache[src] = audio;
  }
  return audioCache[src];
}

export function speakCue(text: string) {
  try {
    const map: Record<string, string> = {
      '10 seconds': '/audio/10secs.mp3',
      '10 seconds remaining': '/audio/10secs.mp3',
      '5 seconds': '/audio/5secs.mp3',
      '5 seconds remaining': '/audio/5secs.mp3',
      'Go': '/audio/GO.mp3',
      'Go!': '/audio/GO.mp3',
    };
    const src = map[text];
    if (src) {
      const audio = getAudio(src);
      audio.currentTime = 0;
      audio.play().catch(() => {
        if (navigator.vibrate) navigator.vibrate(200);
      });
    } else {
      if (navigator.vibrate) navigator.vibrate(200);
    }
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

/**
 * Immediately stop any currently playing rest-timer voice cues / beeps.
 * Used when the user finishes a workout so no callouts continue afterward.
 */
export function stopAllCues() {
  try {
    Object.values(audioCache).forEach(a => {
      try { a.pause(); a.currentTime = 0; } catch {}
    });
  } catch {}
  try {
    if (audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      audioCtxRef.current = null;
      ctx.close().catch(() => {});
    }
  } catch {}
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  } catch {}
  try { if (navigator.vibrate) navigator.vibrate(0); } catch {}
}

export function preloadAudioCues() {
  ['/audio/10secs.mp3', '/audio/5secs.mp3', '/audio/GO.mp3']
    .forEach(src => getAudio(src));
}
