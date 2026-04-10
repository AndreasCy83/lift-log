import { useState } from 'react';
import { Timer, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const PRESETS = [
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '1m 30s', seconds: 90 },
  { label: '2m', seconds: 120 },
  { label: '3m', seconds: 180 },
  { label: '5m', seconds: 300 },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSeconds: number | null;
  onSave: (seconds: number) => void;
  title?: string;
}

export default function RestTimerEditorSheet({ open, onOpenChange, initialSeconds, onSave, title }: Props) {
  const initSec = initialSeconds ?? 90;
  const [minutes, setMinutes] = useState(Math.floor(initSec / 60));
  const [secs, setSecs] = useState(initSec % 60);

  const totalSeconds = minutes * 60 + secs;

  const handlePreset = (s: number) => {
    setMinutes(Math.floor(s / 60));
    setSecs(s % 60);
  };

  const handleSave = () => {
    if (totalSeconds > 0) {
      onSave(totalSeconds);
      onOpenChange(false);
    }
  };

  const adjustMin = (delta: number) => {
    setMinutes(Math.max(0, Math.min(59, minutes + delta)));
  };

  const adjustSec = (delta: number) => {
    const newSec = secs + delta;
    if (newSec >= 60) {
      setSecs(newSec - 60);
      setMinutes(m => Math.min(59, m + 1));
    } else if (newSec < 0) {
      if (minutes > 0) {
        setSecs(60 + newSec);
        setMinutes(m => m - 1);
      }
    } else {
      setSecs(newSec);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8">
        <SheetHeader className="mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Timer className="h-5 w-5 text-primary" />
            </div>
            <SheetTitle className="font-display text-lg">{title || 'Rest Timer'}</SheetTitle>
          </div>
        </SheetHeader>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mb-6">
          {PRESETS.map(p => (
            <button
              key={p.seconds}
              onClick={() => handlePreset(p.seconds)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors
                ${totalSeconds === p.seconds
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Min / Sec picker */}
        <div className="rounded-xl border border-border/50 bg-secondary/30 p-4 mb-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Minutes */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">MIN</span>
              <button onClick={() => adjustMin(1)} className="w-12 h-12 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
                <span className="text-xl">+</span>
              </button>
              <span className="font-display text-5xl font-bold tabular-nums">
                {String(minutes).padStart(2, '0')}
              </span>
              <button onClick={() => adjustMin(-1)} className="w-12 h-12 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
                <span className="text-xl">−</span>
              </button>
            </div>

            {/* Seconds */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">SEC</span>
              <button onClick={() => adjustSec(5)} className="w-12 h-12 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
                <span className="text-xl">+</span>
              </button>
              <span className="font-display text-5xl font-bold tabular-nums">
                {String(secs).padStart(2, '0')}
              </span>
              <button onClick={() => adjustSec(-5)} className="w-12 h-12 rounded-full border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors">
                <span className="text-xl">−</span>
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 gap-1.5"
            onClick={handleSave}
            disabled={totalSeconds === 0}
          >
            <Check className="h-4 w-4" /> Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
