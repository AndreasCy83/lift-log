/**
 * Volume insights card for the Home page.
 *
 * Compact Recovery-style card showing estimated weekly hypertrophy volume
 * per muscle group derived from the last 14 days of logged workouts.
 * Subtle motion: bars fill from 0 on first mount and when new rows are
 * revealed via expand. Respects prefers-reduced-motion.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ChevronDown } from 'lucide-react';
import {
  computeVolumeSummary,
  STATUS_LABEL,
  STATUS_CHIP_CLASS,
  STATUS_BAR_COLOR,
} from '@/lib/volumeInsights';
import { getCategories } from '@/lib/storage';
import { getCategoryColor } from '@/lib/categoryColors';

interface Props {
  refreshKey?: number;
}

const COLLAPSED_ROWS = 1;
const BAR_MAX = 20;

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
  status: keyof typeof STATUS_LABEL;
  showChip: boolean;
  filled: boolean;
  reduced: boolean;
  delayMs: number;
}

function MuscleRow({ categoryId, name, weeklySets, status, showChip, filled, reduced, delayMs }: RowProps) {
  const pct = Math.min(100, Math.max(4, (weeklySets / BAR_MAX) * 100));
  const width = filled || reduced ? `${pct}%` : '0%';
  return (
    <div className="flex items-center gap-2 py-[2px] min-w-0">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: getCategoryColor(categoryId) }}
      />
      <span className="shrink-0 text-[11px] font-semibold text-foreground truncate max-w-[64px]">
        {name}
      </span>
      {showChip && (
        <span
          className={`hidden xs:inline-flex shrink-0 rounded-full px-1 py-[1px] text-[8px] font-medium uppercase tracking-wider tabular-nums opacity-70 ${STATUS_CHIP_CLASS[status]}`}
        >
          {STATUS_LABEL[status]}
        </span>
      )}
      <div className="flex-1 min-w-[24px] h-[3px] overflow-hidden rounded-full bg-background/70 ml-0.5">
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
      <span className="shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
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
        <div className="mb-1.5 flex items-center justify-between">
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
        <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
          Based on the last 14 days
        </p>
      </div>
    );
  }

  const collapsedRows = summary.weeklyByCategory.slice(0, COLLAPSED_ROWS);
  const hiddenRows = summary.weeklyByCategory.slice(COLLAPSED_ROWS);
  const hiddenCount = hiddenRows.length;

  return (
    <div className="gym-card mt-4 !p-3 animate-fade-in">
      {/* Header */}
      <div className="mb-1.5 flex items-center justify-between min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Activity className="h-3.5 w-3.5 text-primary shrink-0" />
          <h3 className="font-display text-sm font-semibold truncate">Volume</h3>
        </div>
      </div>

      {/* Total Body summary: label + value on row 1, chip on row 2 */}
      <div className="py-[3px] min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-semibold text-foreground whitespace-nowrap">
            Total Body
          </span>
          <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground whitespace-nowrap">
            ~{Math.round(summary.totalWeeklySets)} sets/wk
          </span>
        </div>
        <div className="mt-0.5">
          <span
            className={`inline-flex rounded-full px-1.5 py-[1px] text-[8px] font-medium uppercase tracking-wider tabular-nums opacity-80 ${STATUS_CHIP_CLASS[summary.totalStatus]}`}
          >
            {STATUS_LABEL[summary.totalStatus]}
          </span>
        </div>
      </div>

      {/* Top muscle row (collapsed always visible) */}
      <div className="mt-1 space-y-1">
        {collapsedRows.map((row, i) => (
          <MuscleRow
            key={row.categoryId}
            categoryId={row.categoryId}
            name={catName(row.categoryId)}
            weeklySets={row.weeklySets}
            status={row.status}
            showChip={false}
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
            maxHeight: expanded ? `${hiddenRows.length * 26 + 8}px` : '0px',
            opacity: expanded ? 1 : 0,
            transition: reduced
              ? 'none'
              : 'max-height 260ms ease-out, opacity 220ms ease-out',
          }}
        >
          <div className="space-y-1 pt-1">
            {hiddenRows.map((row, i) => (
              <MuscleRow
                key={row.categoryId}
                categoryId={row.categoryId}
                name={catName(row.categoryId)}
                weeklySets={row.weeklySets}
                status={row.status}
                showChip={true}
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

      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
        Based on the last 14 days
      </p>
    </div>
  );
}
