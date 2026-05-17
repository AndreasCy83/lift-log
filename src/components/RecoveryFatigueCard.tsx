import { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronDown } from 'lucide-react';
import { computeMuscleFatigue, type MuscleFatigue, type FatigueBand } from '@/lib/recoveryFatigue';

const BAND_STYLES: Record<FatigueBand, { pill: string; bar: string; glow: string }> = {
  'Low':       { pill: 'bg-primary/15 text-primary',          bar: 'bg-primary',       glow: '' },
  'Moderate':  { pill: 'bg-amber-400/15 text-amber-300',      bar: 'bg-amber-400',     glow: '' },
  'High':      { pill: 'bg-orange-500/15 text-orange-300',    bar: 'bg-orange-400',    glow: 'shadow-[0_0_6px_hsl(25_95%_55%/0.5)]' },
  'Very High': { pill: 'bg-destructive/20 text-destructive',  bar: 'bg-destructive',   glow: 'shadow-[0_0_8px_hsl(0_72%_55%/0.6)] animate-pulse' },
};

interface Props {
  refreshKey?: number;
}

function shortRetrain(label: string): string {
  if (/ready/i.test(label)) return 'Ready';
  if (/tomorrow/i.test(label)) return 'Tomorrow';
  // "In ~12h" -> "12h", "In ~48h" -> "48h", "In ~3d" -> "3d", "In 4+ days" -> "4d+"
  const m = label.match(/(\d+)\s*([hd])/i);
  if (m) return `${m[1]}${m[2].toLowerCase()}${/4\+/.test(label) ? '+' : ''}`;
  return label.replace(/^In\s+~?/i, '');
}

const BAND_SHORT: Record<FatigueBand, string> = {
  'Low': 'LOW',
  'Moderate': 'MOD',
  'High': 'HIGH',
  'Very High': 'V HIGH',
};

function Row({ m, i, mounted }: { m: MuscleFatigue; i: number; mounted: boolean }) {
  const style = BAND_STYLES[m.band];
  const width = mounted ? `${Math.max(4, m.pct)}%` : '0%';
  return (
    <div className="flex items-center gap-2 py-[3px]" style={{ transitionDelay: `${i * 25}ms` }}>
      <span className="w-14 shrink-0 text-[11px] font-semibold text-foreground truncate">{m.muscle}</span>
      <span className={`shrink-0 rounded-full px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide tabular-nums ${style.pill}`}>
        {BAND_SHORT[m.band]}
      </span>
      <div className="flex-1 h-[2px] overflow-hidden rounded-full bg-background/70 ml-0.5">
        <div
          className={`h-full rounded-full ${style.bar} ${style.glow}`}
          style={{ width, transition: 'width 700ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground/80">
        {shortRetrain(m.retrainLabel)}
      </span>
    </div>
  );
}

export default function RecoveryFatigueCard({ refreshKey }: Props) {
  const data = useMemo<MuscleFatigue[]>(() => computeMuscleFatigue(), [refreshKey]);
  const sorted = useMemo(() => [...data].sort((a, b) => b.score - a.score), [data]);
  const needsRest = sorted.filter(m => m.band !== 'Low');
  const ready = sorted.filter(m => m.band === 'Low');

  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(false);
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, [refreshKey]);

  const hasNeedsRest = needsRest.length > 0;

  return (
    <div className="gym-card mt-4 animate-fade-in !p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-display text-sm font-semibold">Recovery</h3>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {expanded ? 'By muscle' : hasNeedsRest ? 'Needs rest' : 'All ready'}
        </span>
      </div>

      {!hasNeedsRest && !expanded ? (
        <div className="flex items-center gap-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.7)]" />
          <p className="text-xs text-foreground">All muscle groups ready</p>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {needsRest.map((m, i) => <Row key={m.muscle} m={m} i={i} mounted={mounted} />)}
        </div>
      )}

      <div
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: expanded ? `${ready.length * 32 + 8}px` : '0px',
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className={`divide-y divide-border/40 ${hasNeedsRest ? 'border-t border-border/40' : ''}`}>
          {ready.map((m, i) => <Row key={m.muscle} m={m} i={i} mounted={mounted && expanded} />)}
        </div>
      </div>

      {ready.length > 0 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-1 flex w-full items-center justify-center gap-1 rounded-md py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? 'Show less' : 'Show all'}
          <ChevronDown
            className={`h-3 w-3 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      )}
    </div>
  );
}
