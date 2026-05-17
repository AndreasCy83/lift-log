import { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronDown } from 'lucide-react';
import { computeMuscleFatigue, type MuscleFatigue, type FatigueBand } from '@/lib/recoveryFatigue';

const BAND_STYLES: Record<FatigueBand, { pill: string; bar: string; glow: string }> = {
  'Low':       { pill: 'bg-primary/15 text-primary',          bar: 'bg-primary',       glow: '' },
  'Moderate':  { pill: 'bg-amber-400/15 text-amber-300',      bar: 'bg-amber-400',     glow: '' },
  'High':      { pill: 'bg-orange-500/15 text-orange-300',    bar: 'bg-orange-400',    glow: 'shadow-[0_0_8px_hsl(25_95%_55%/0.5)]' },
  'Very High': { pill: 'bg-destructive/20 text-destructive',  bar: 'bg-destructive',   glow: 'shadow-[0_0_10px_hsl(0_72%_55%/0.6)] animate-pulse' },
};

interface Props {
  refreshKey?: number;
}

function shortRetrain(label: string): string {
  // "Ready now" -> "Ready"; "In ~12h" -> "~12h"; "In ~2d" -> "~2d"; "Tomorrow" stays.
  if (/ready/i.test(label)) return 'Ready';
  return label.replace(/^In\s+/i, '');
}

function Row({ m, i, mounted }: { m: MuscleFatigue; i: number; mounted: boolean }) {
  const style = BAND_STYLES[m.band];
  const width = mounted ? `${Math.max(4, m.pct)}%` : '0%';
  return (
    <div className="flex items-center gap-2 py-1.5" style={{ transitionDelay: `${i * 30}ms` }}>
      <span className="w-16 shrink-0 text-xs font-semibold text-foreground truncate">{m.muscle}</span>
      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${style.pill}`}>
        {m.band}
      </span>
      <div className="flex-1 h-[3px] overflow-hidden rounded-full bg-background/70">
        <div
          className={`h-full rounded-full ${style.bar} ${style.glow}`}
          style={{ width, transition: 'width 800ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </div>
      <span className="w-12 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
        {shortRetrain(m.retrainLabel)}
      </span>
    </div>
  );
}

export default function RecoveryFatigueCard({ refreshKey }: Props) {
  const data = useMemo<MuscleFatigue[]>(() => computeMuscleFatigue(), [refreshKey]);
  const sorted = useMemo(() => [...data].sort((a, b) => b.score - a.score), [data]);
  const top = sorted.slice(0, 4);
  const rest = sorted.slice(4);

  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(false);
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, [refreshKey]);

  const anyFatigue = sorted.some(t => t.score > 0);

  return (
    <div className="gym-card mt-4 animate-fade-in">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-display text-sm font-semibold">Recovery</h3>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {expanded ? 'By muscle' : 'Top 4 muscles'}
        </span>
      </div>

      {!anyFatigue ? (
        <p className="py-1 text-xs text-muted-foreground">All muscles ready. Log a workout to see recovery estimates.</p>
      ) : (
        <>
          <div className="divide-y divide-border/40">
            {top.map((m, i) => <Row key={m.muscle} m={m} i={i} mounted={mounted} />)}
          </div>

          <div
            className="overflow-hidden transition-all duration-300 ease-out"
            style={{
              maxHeight: expanded ? `${rest.length * 40}px` : '0px',
              opacity: expanded ? 1 : 0,
            }}
          >
            <div className="divide-y divide-border/40 border-t border-border/40">
              {rest.map((m, i) => <Row key={m.muscle} m={m} i={i} mounted={mounted && expanded} />)}
            </div>
          </div>

          {rest.length > 0 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? 'Show less' : 'Show all'}
              <ChevronDown
                className={`h-3 w-3 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </>
      )}

      <p className="mt-1.5 text-[10px] text-muted-foreground/70">Estimate based on recent completed sets.</p>
    </div>
  );
}
