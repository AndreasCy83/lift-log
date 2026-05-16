import { useEffect, useMemo, useState } from 'react';
import { Activity } from 'lucide-react';
import { computeMuscleFatigue, type MuscleFatigue, type FatigueBand } from '@/lib/recoveryFatigue';

const BAND_STYLES: Record<FatigueBand, { dot: string; text: string; bar: string; glow: string }> = {
  'Low':       { dot: 'bg-primary',       text: 'text-primary',         bar: 'bg-primary',         glow: '' },
  'Moderate':  { dot: 'bg-yellow-400',    text: 'text-yellow-400',      bar: 'bg-yellow-400',      glow: '' },
  'High':      { dot: 'bg-orange-400',    text: 'text-orange-400',      bar: 'bg-orange-400',      glow: 'shadow-[0_0_12px_hsl(25_95%_55%/0.45)]' },
  'Very High': { dot: 'bg-destructive',   text: 'text-destructive',     bar: 'bg-destructive',     glow: 'shadow-[0_0_16px_hsl(0_72%_55%/0.55)] animate-pulse' },
};

interface Props {
  refreshKey?: number;
}

export default function RecoveryFatigueCard({ refreshKey }: Props) {
  const data = useMemo<MuscleFatigue[]>(() => computeMuscleFatigue(), [refreshKey]);
  const top = useMemo(() => [...data].sort((a, b) => b.score - a.score).slice(0, 4), [data]);

  // Animate bar fills on mount/update.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(false);
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, [refreshKey]);

  const anyFatigue = top.some(t => t.score > 0);

  return (
    <div className="gym-card mt-4 animate-fade-in">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-display text-sm font-semibold">Recovery</h3>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">By muscle</span>
      </div>

      {!anyFatigue ? (
        <p className="text-xs text-muted-foreground">All muscles ready. Log a workout to see recovery estimates.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {top.map((m, i) => {
            const style = BAND_STYLES[m.band];
            const width = mounted ? `${Math.max(4, m.pct)}%` : '0%';
            return (
              <div
                key={m.muscle}
                className="rounded-lg border border-border/60 bg-secondary/40 p-2 transition-all"
                style={{ transitionDelay: `${i * 40}ms` }}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-foreground truncate">{m.muscle}</span>
                  <span className={`h-1.5 w-1.5 rounded-full ${style.dot} ${style.glow}`} />
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-background/70">
                  <div
                    className={`h-full rounded-full ${style.bar} ${style.glow}`}
                    style={{ width, transition: 'width 800ms cubic-bezier(0.22,1,0.36,1)' }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px]">
                  <span className={`${style.text} font-medium`}>{m.band}</span>
                  <span className="text-muted-foreground">{m.retrainLabel}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-2 text-[10px] text-muted-foreground/80">Estimate based on recent completed sets.</p>
    </div>
  );
}
