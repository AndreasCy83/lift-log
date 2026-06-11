/**
 * Volume insights card for the Home page.
 *
 * Compact Recovery-style card showing estimated weekly hypertrophy volume
 * per muscle group derived from the last 14 days of logged workouts.
 *
 * Row layout (per muscle):
 *   [ name              ]  [ thin bar ]  [ ~sets/wk ]
 *   [ status subtitle   ]
 *
 * The per-row status is rendered as a compact color-coded subtitle BELOW
 * the muscle name, not as a pill chip. Subtle motion: bars fill from 0 on
 * first mount and when new rows are revealed via expand. Respects
 * prefers-reduced-motion.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ChevronDown } from 'lucide-react';
import {
  computeVolumeSummary,
  STATUS_LABEL,
  STATUS_CHIP_CLASS,
  STATUS_BAR_COLOR,
  type VolumeStatus,
} from '@/lib/volumeInsights';
import { getCategories } from '@/lib/storage';
import { getCategoryColor } from '@/lib/categoryColors';

interface Props {
  refreshKey?: number;
}

const COLLAPSED_ROWS = 1;
const BAR_MAX = 20;

/** Subtitle (under-name) text color per status. Lighter than chip styles. */
const STATUS_SUBTITLE_CLASS: Record<VolumeStatus, string> = {
  none:        'text-muted-foreground',
  below:       'text-emerald-400/90',
  maintenance: 'text-emerald-400/90',
  productive:  'text-yellow-400/90',
  progressive: 'text-orange-400/90',
  high:        'text-orange-300/90',
  very_high:   'text-red-400/90',
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

interface RowProps {
  categoryId: string;
  name: string;
  weeklySets: number;
  status: VolumeStatus;
  filled: boolean;
  reduced: boolean;
  delayMs: number;
}

function MuscleRow({ categoryId, name, weeklySets, status, filled, reduced, delayMs }: RowProps) {
  const pct = Math.min(100, Math.max(4, (weeklySets / BAR_MAX) * 100));
  const width = filled || reduced ? `${pct}%` : '0%';
  return (
    <div className="flex items-center gap-2 py-[3px] min-w-0">
      {/* Left: name + status subtitle (two-line block) */}
      <div className="flex min-w-0 flex-1 items-start gap-1.5">
        <span
          className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: getCategoryColor(categoryId) }}
        />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[11px] font-semibold text-foreground truncate">
            {name}
          </div>
          <div
            className={`text-[9.5px] font-medium tracking-wide ${STATUS_SUBTITLE_CLASS[status]}`}
          >
            {STATUS_LABEL[status]}
          </div>
        </div>
      </div>

      {/* Middle: thin progress bar */}
      <div className="h-[3px] w-[34%] min-w-[40px] max-w-[120px] overflow-hidden rounded-full bg-background/70">
        <div
          className={`h-full rounded-full ${STATUS_BAR_COLOR[status]}`}
          style={{
            width,
            transition: reduced
              ? 'none'
              : `width 550ms cubic-bezier(0.22,1,0.36,1) ${delayMs}ms`,
          }}
        />
      </div>

      {/* Right: weekly sets value */}
      <span className="w-[42px] shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
        ~{weeklySets.toFixed(1)}
      </span>
    </div>
  );
}

export default function VolumeInsightsCard({ refreshKey }: Props) {
  const reduced = usePrefersReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [revealedExpand, setRevealedExpand] = useState(false);

  const summary = useMemo(() => computeVolumeSummary(), [refreshKey]);
  const categories = useMemo(() => getCategories(), []);
  const catName = (id: string) => categories.find(c => c.id === id)?.name ?? id;

  // First-mount bar fill animation trigger
  useEffect(() => {
    setMounted(false);
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [refreshKey]);

  // Trigger reveal animation for newly shown rows after expand
  const expandTimer = useRef<number | null>(null);
  useEffect(() => {
    if (expanded) {
      setRevealedExpand(false);
      expandTimer.current = window.setTimeout(() => setRevealedExpand(true), 20);
    } else {
      setRevealedExpand(false);
    }
    return () => {
      if (expandTimer.current) window.clearTimeout(expandTimer.current);
    };
  }, [expanded]);

  if (!summary.hasAny) {
    return (
      <div className="gym-card mt-4 !p-3 animate-fade-in">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <h3 className="font-display text-sm font-semibold">Volume</h3>
          </div>
        </div>
        <div className="flex items-center gap-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.7)]" />
          <p className="text-xs text-foreground">No recent volume yet</p>
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Log a workout to unlock volume insights.
        </p>
      </div>
    );
  }

  const collapsedRows = summary.weeklyByCategory.slice(0, COLLAPSED_ROWS);
  const hiddenRows = summary.weeklyByCategory.slice(COLLAPSED_ROWS);
  const hiddenCount = hiddenRows.length;

  return (
    <div className="gym-card mt-4 !p-3 animate-fade-in">
      {/* Header: title + weekly total */}
      <div className="mb-1 flex items-center justify-between min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Activity className="h-3.5 w-3.5 text-primary shrink-0" />
          <h3 className="font-display text-sm font-semibold truncate">Volume</h3>
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground whitespace-nowrap">
          ~{Math.round(summary.totalWeeklySets)} sets/wk
        </span>
      </div>

      {/* Total Body + status chip (summary line stays as chip to differentiate from per-row subtitles) */}
      <div className="flex items-center gap-2 py-[2px] min-w-0">
        <span className="text-[11px] font-semibold text-foreground whitespace-nowrap">
          Total Body
        </span>
        <span
          className={`inline-flex rounded-full px-1.5 py-[1px] text-[8px] font-medium uppercase tracking-wider tabular-nums opacity-80 ${STATUS_CHIP_CLASS[summary.totalStatus]}`}
        >
          {STATUS_LABEL[summary.totalStatus]}
        </span>
      </div>

      {/* Top muscle row (collapsed always visible) */}
      <div className="mt-1 space-y-0.5">
        {collapsedRows.map((row, i) => (
          <MuscleRow
            key={row.categoryId}
            categoryId={row.categoryId}
            name={catName(row.categoryId)}
            weeklySets={row.weeklySets}
            status={row.status}
            filled={mounted}
            reduced={reduced}
            delayMs={i * 50}
          />
        ))}
      </div>

      {/* Expandable hidden rows */}
      {hiddenCount > 0 && (
        <div
          className="overflow-hidden"
          style={{
            maxHeight: expanded ? `${hiddenRows.length * 36 + 8}px` : '0px',
            opacity: expanded ? 1 : 0,
            transition: reduced
              ? 'none'
              : 'max-height 260ms ease-out, opacity 220ms ease-out',
          }}
        >
          <div className="space-y-0.5 pt-1">
            {hiddenRows.map((row, i) => (
              <MuscleRow
                key={row.categoryId}
                categoryId={row.categoryId}
                name={catName(row.categoryId)}
                weeklySets={row.weeklySets}
                status={row.status}
                filled={revealedExpand}
                reduced={reduced}
                delayMs={i * 55}
              />
            ))}
          </div>
        </div>
      )}

      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-1 flex w-full items-center justify-center gap-1 py-0 text-[10px] font-medium text-muted-foreground/70 hover:text-foreground transition-colors"
        >
          {expanded ? 'Show less' : `Show all (+${hiddenCount})`}
          <ChevronDown
            className={`h-3 w-3 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      )}
    </div>
  );
}
