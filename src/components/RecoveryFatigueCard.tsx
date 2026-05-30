import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  // Labels from computeMuscleFatigue are already concise (Ready / 12h / Tomorrow / 2d).
  return label;
}

const BAND_SHORT: Record<FatigueBand, string> = {
  'Low': 'LOW',
  'Moderate': 'MOD',
  'High': 'HIGH',
  'Very High': 'V HIGH',
};

function Row({ m, i, mounted }: { m: MuscleFatigue; i: number; mounted: boolean }) {
  const style = BAND_STYLES[m.band];
  const width = mounted ? `${Math.max(0, Math.min(100, m.pct))}%` : '0%';
  const isReady = m.remainingHours <= 0;
  return (
    <div className="flex items-center gap-2 py-[3px]" style={{ transitionDelay: `${i * 25}ms` }}>
      <span className="w-14 shrink-0 text-[11px] font-semibold text-foreground truncate">{m.muscle}</span>
      <span className={`shrink-0 rounded-full px-1 py-[1px] text-[8px] font-medium uppercase tracking-wider tabular-nums opacity-70 ${style.pill}`}>
        {BAND_SHORT[m.band]}
      </span>
      <div className="flex-1 h-[3px] overflow-hidden rounded-full bg-background/70 ml-0.5">
        <div
          className={`h-full rounded-full ${isReady ? '' : `${style.bar} ${style.glow}`}`}
          style={{ width: isReady ? '0%' : width, transition: 'width 700ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </div>
      <span className={`w-10 shrink-0 text-right text-[11px] font-semibold tabular-nums ${isReady ? 'text-primary' : 'text-foreground'}`}>
        {shortRetrain(m.retrainLabel)}
      </span>
    </div>
  );
}

export default function RecoveryFatigueCard({ refreshKey }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') setTick(t => t + 1); };
    const onFocus = () => setTick(t => t + 1);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    const id = window.setInterval(() => setTick(t => t + 1), 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(id);
    };
  }, []);
  const data = useMemo<MuscleFatigue[]>(() => computeMuscleFatigue(), [refreshKey, tick]);
  const sorted = useMemo(() => [...data].sort((a, b) => b.score - a.score), [data]);

  const DEFAULT_VISIBLE = 2;
  const top = sorted.slice(0, DEFAULT_VISIBLE);
  const rest = sorted.slice(DEFAULT_VISIBLE);
  const hasAny = sorted.length > 0;
  const topNeedsRest = top.some(m => m.band !== 'Low');

  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(false);
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, [refreshKey]);

  return (
    <div className="gym-card mt-4 animate-fade-in !p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-display text-sm font-semibold">Recovery</h3>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
          {expanded ? 'By muscle' : topNeedsRest ? 'Needs rest' : 'All ready'}
        </span>
      </div>

      {!hasAny ? (
        <div className="flex items-center gap-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.7)]" />
          <p className="text-xs text-foreground">All muscle groups ready</p>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {top.map((m, i) => <Row key={m.muscle} m={m} i={i} mounted={mounted} />)}
        </div>
      )}

      <div
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: expanded ? `${rest.length * 28 + 8}px` : '0px',
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="divide-y divide-border/40 border-t border-border/40 mt-0.5 pt-0.5">
          {rest.map((m, i) => <Row key={m.muscle} m={m} i={i} mounted={mounted && expanded} />)}
        </div>
      </div>

      {rest.length > 0 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-0.5 flex w-full items-center justify-center gap-1 py-0 text-[10px] font-medium text-muted-foreground/70 hover:text-foreground transition-colors"
        >
          {expanded ? 'Show less' : `Show all (+${rest.length})`}
          <ChevronDown
            className={`h-3 w-3 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      )}
    </div>
  );
}
