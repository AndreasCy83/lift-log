/**
 * Audio cues for rest timer countdown.
 * Uses local MP3 files instead of Web Speech API for Android Capacitor compatibility.
 *
 * Playback adds a 400ms silent lead-in before each cue to reduce clipping on
 * Android (where the audio output can take a moment to wake up when no music
 * is playing). Tiny edge fades (~30ms in / ~40ms out) avoid pops/clicks.
 */

const SILENT_PAD_MS = 400;
const FADE_IN_MS = 30;
const FADE_OUT_MS = 40;

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

const audioCtxRef = { current: null as AudioContext | null };

function getAudioCtx(): AudioContext | null {
  try {
    if (!audioCtxRef.current) {
      const Ctor: typeof AudioContext | undefined =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      audioCtxRef.current = new Ctor();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  } catch {
    return null;
  }
}

/**
 * Schedule a short silent buffer through the AudioContext to "warm up" the
 * output device. On Android this reduces the first-syllable clipping that
 * happens when the audio hardware was idle.
 */
function primeOutputWithSilence(ms: number) {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const seconds = ms / 1000;
    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate);
    // buffer is already zero-filled (silence)
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start();
    src.stop(ctx.currentTime + seconds);
  } catch {}
}

function fadeIn(audio: HTMLAudioElement, ms: number) {
  try {
    const steps = 6;
    const stepMs = Math.max(1, Math.floor(ms / steps));
    audio.volume = 0;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      audio.volume = Math.min(1, i / steps);
      if (i >= steps) clearInterval(id);
    }, stepMs);
  } catch {}
}

function scheduleFadeOut(audio: HTMLAudioElement, ms: number) {
  const onTime = () => {
    try {
      if (!isFinite(audio.duration)) return;
      const remaining = (audio.duration - audio.currentTime) * 1000;
      if (remaining <= ms) {
        audio.volume = Math.max(0, remaining / ms);
      }
    } catch {}
  };
  const cleanup = () => {
    audio.removeEventListener('timeupdate', onTime);
    audio.removeEventListener('ended', cleanup);
    audio.removeEventListener('pause', cleanup);
    try { audio.volume = 1; } catch {}
  };
  audio.addEventListener('timeupdate', onTime);
  audio.addEventListener('ended', cleanup);
  audio.addEventListener('pause', cleanup);
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
    if (!src) {
      if (navigator.vibrate) navigator.vibrate(200);
      return;
    }

    const audio = getAudio(src);

    // Warm the output device with 400ms of silence so the first syllable
    // isn't clipped when audio hardware was idle.
    primeOutputWithSilence(SILENT_PAD_MS);

    // After the silent pad, start the cue and apply tiny edge fades.
    window.setTimeout(() => {
      try {
        audio.currentTime = 0;
        fadeIn(audio, FADE_IN_MS);
        scheduleFadeOut(audio, FADE_OUT_MS);
        audio.play().catch(() => {
          if (navigator.vibrate) navigator.vibrate(200);
        });
      } catch {
        if (navigator.vibrate) navigator.vibrate(200);
      }
    }, SILENT_PAD_MS);
  } catch {
    if (navigator.vibrate) navigator.vibrate(200);
  }
}

export function playFinishBeep() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
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
      try { a.pause(); a.currentTime = 0; a.volume = 1; } catch {}
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
