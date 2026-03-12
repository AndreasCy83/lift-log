import { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, RotateCcw } from 'lucide-react';

const PRESETS = [60, 90, 120, 180];

interface Props {
  onClose: () => void;
}

export default function RestTimer({ onClose }: Props) {
  const [seconds, setSeconds] = useState(90);
  const [remaining, setRemaining] = useState(90);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) {
            setIsRunning(false);
            // Try vibrate
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, remaining]);

  const handlePreset = (s: number) => {
    setSeconds(s);
    setRemaining(s);
    setIsRunning(false);
  };

  const toggleRun = () => {
    if (remaining === 0) { setRemaining(seconds); }
    setIsRunning(!isRunning);
  };

  const reset = () => {
    setIsRunning(false);
    setRemaining(seconds);
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = seconds > 0 ? (remaining / seconds) * 100 : 0;

  return (
    <div className="gym-card relative">
      <button onClick={onClose} className="absolute right-3 top-3 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
      <h3 className="font-display text-sm font-semibold mb-3">Rest Timer</h3>

      <div className="flex items-center justify-center gap-4 mb-3">
        <span className="font-display text-3xl font-bold tabular-nums">
          {mins}:{secs.toString().padStart(2, '0')}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-secondary mb-3 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-center gap-2 mb-3">
        <button onClick={reset} className="rounded-full p-2 text-muted-foreground hover:bg-secondary">
          <RotateCcw className="h-4 w-4" />
        </button>
        <button onClick={toggleRun} className="rounded-full bg-primary p-3 text-primary-foreground">
          {isRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>
      </div>

      <div className="flex justify-center gap-2">
        {PRESETS.map(p => (
          <button
            key={p}
            onClick={() => handlePreset(p)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors
              ${seconds === p ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
          >
            {p}s
          </button>
        ))}
      </div>
    </div>
  );
}
