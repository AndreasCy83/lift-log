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
import { BarChart3, ChevronDown, Info, PersonStanding } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  computeVolumeSummary,
  STATUS_LABEL,
  STATUS_CHIP_CLASS,
  STATUS_BAR_COLOR,
  type VolumeStatus,
} from '@/lib/volumeInsights';
import { getCategories } from '@/lib/storage';
import { getCategoryColor } from '@/lib/categoryColors';
import MuscleMap from '@/components/MuscleMap';


interface Props {
  refreshKey?: number;
}

const COLLAPSED_ROWS = 1;
const BAR_MAX = 20;
/** Vertical budget reserved for the front/back anatomical map when expanded. */
const MAP_HEIGHT = 400;



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
  const [infoOpen, setInfoOpen] = useState(false);

  const InfoButton = (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setInfoOpen(true); }}
      aria-label="How Estimated Stimulus works"
      className="-m-1 p-1 text-muted-foreground/70 hover:text-foreground transition-colors"
    >
      <Info className="h-3 w-3" />
    </button>
  );

  const InfoModal = (
    <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-base">How Estimated Stimulus works</DialogTitle>
          <DialogDescription className="sr-only">
            Explanation of how the Estimated Stimulus metric is calculated.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2.5 text-xs leading-relaxed text-muted-foreground">
          <p>
            <span className="text-foreground font-medium">Estimated Stimulus</span> is a weekly estimate of training stimulus by muscle group, based on your last 14 days of logged workouts.
          </p>
          <p>Completed working sets count; warmups are excluded, and deload sets count partially.</p>
          <p>Compound exercises can give partial credit to assisting muscles, so one set may contribute to more than one muscle group.</p>
          <p className="text-[11px] italic">This helps track training balance and recovery trends, but it is not a direct count of sets performed or a direct measure of muscle growth.</p>
        </div>
      </DialogContent>
    </Dialog>
  );


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
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
            <h3 className="font-display text-sm font-semibold">Estimated Stimulus</h3>
            {InfoButton}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mb-1">Based on last 14 days</p>
        <div className="flex items-center gap-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.7)]" />
          <p className="text-xs text-foreground">No recent volume yet</p>
        </div>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          Log a workout to unlock volume insights.
        </p>
        {InfoModal}
      </div>
    );
  }


  const collapsedRows = summary.weeklyByCategory.slice(0, COLLAPSED_ROWS);
  const hiddenRows = summary.weeklyByCategory.slice(COLLAPSED_ROWS);
  const hiddenCount = hiddenRows.length;

  // categoryId -> Estimated Stimulus status for the anatomical map
  const mapStatuses: Record<string, VolumeStatus> = {};
  for (const row of summary.weeklyByCategory) {
    mapStatuses[row.categoryId] = row.status;
  }


  return (
    <div className="gym-card mt-4 !p-3 animate-fade-in">
      {/* Header: title */}
      <div className="mb-1 flex items-center justify-between min-w-0 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <BarChart3 className="h-3.5 w-3.5 text-primary shrink-0" />
          <h3 className="font-display text-sm font-semibold truncate">Estimated Stimulus</h3>
          {InfoButton}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            aria-label="Open muscle map"
            className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border/60 bg-secondary/80 text-muted-foreground shadow-sm shadow-black/10 backdrop-blur-sm transition-all hover:bg-secondary hover:text-foreground active:scale-95 active:bg-muted"
          >
            <PersonStanding className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground/60 mb-1">Based on last 14 days</p>


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

      {/* Collapsed state: only top muscle row */}
      {!expanded && (
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
      )}

      {/* Expandable: anatomical map above all muscle rows */}
      {hiddenCount > 0 && (
        <div
          className="overflow-hidden"
          style={{
            maxHeight: expanded ? `${summary.weeklyByCategory.length * 36 + 8 + MAP_HEIGHT}px` : '0px',
            opacity: expanded ? 1 : 0,
            transition: reduced
              ? 'none'
              : 'max-height 320ms ease-out, opacity 220ms ease-out',
          }}
        >
          <div className="py-1">
            <MuscleMap statuses={mapStatuses} scale={0.85} />
          </div>

          <div className="space-y-0.5 pt-1">
            {summary.weeklyByCategory.map((row, i) => (
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
      {InfoModal}
    </div>
  );
}
