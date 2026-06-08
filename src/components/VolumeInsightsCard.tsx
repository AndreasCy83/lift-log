/**
 * Volume insights card for the Home page.
 *
 * Shows estimated weekly hypertrophy volume per muscle group derived from
 * the last 14 days of logged workouts. Collapsed by default — expand to
 * see all muscles. Renders a polished empty state when no qualifying
 * volume exists in the window.
 */
import { useMemo, useState } from 'react';
import { Activity, ChevronDown, BarChart3 } from 'lucide-react';
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

const COLLAPSED_ROWS = 3;
// Reference set count used to fill the progress bar (20 weekly sets = full)
const BAR_MAX = 20;

export default function VolumeInsightsCard({ refreshKey }: Props) {
  const [expanded, setExpanded] = useState(false);

  const summary = useMemo(() => computeVolumeSummary(), [refreshKey]);
  const categories = useMemo(() => getCategories(), []);
  const catName = (id: string) => categories.find(c => c.id === id)?.name ?? id;

  // Empty state
  if (!summary.hasAny) {
    return (
      <div className="gym-card mt-4">
        <Header status="none" />
        <div className="mt-4 flex flex-col items-center justify-center py-6 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <h4 className="font-display text-sm font-semibold">No recent volume yet</h4>
          <p className="mt-1 max-w-[260px] text-xs text-muted-foreground">
            Log a workout to unlock estimated weekly volume by muscle group.
          </p>
          <p className="mt-3 text-[10px] uppercase tracking-wide text-muted-foreground/70">
            Based on the last 14 days
          </p>
        </div>
      </div>
    );
  }

  const rows = expanded
    ? summary.weeklyByCategory
    : summary.weeklyByCategory.slice(0, COLLAPSED_ROWS);
  const hiddenCount = Math.max(0, summary.weeklyByCategory.length - COLLAPSED_ROWS);

  return (
    <div className="gym-card mt-4">
      <Header status={summary.totalStatus} />

      {/* Total Body block */}
      <div className="mt-3 rounded-lg border border-border/50 bg-secondary/30 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total Body
          </span>
          <StatusChip status={summary.totalStatus} />
        </div>
        <div className="mt-1.5 flex items-baseline justify-between">
          <span className="font-display text-lg font-semibold text-foreground">
            {STATUS_LABEL[summary.totalStatus]}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            ~{Math.round(summary.totalWeeklySets)} sets/wk
          </span>
        </div>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
          Based on last 14 days
        </p>
      </div>

      {/* Muscle rows */}
      <div className="mt-3 space-y-2">
        {rows.map(row => {
          const pct = Math.min(100, Math.max(4, (row.weeklySets / BAR_MAX) * 100));
          return (
            <div key={row.categoryId} className="space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: getCategoryColor(row.categoryId) }}
                />
                <span className="truncate font-medium text-foreground">
                  {catName(row.categoryId)}
                </span>
                <StatusChip status={row.status} className="ml-1" />
                <span className="ml-auto tabular-nums text-muted-foreground">
                  ~{row.weeklySets.toFixed(1)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/60">
                <div
                  className={`h-full rounded-full transition-all ${STATUS_BAR_COLOR[row.status]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-3 flex w-full items-center justify-center gap-1 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70 hover:text-foreground transition-colors"
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

function Header({ status }: { status: VolumeStatus }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
          <Activity className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="font-display text-sm font-semibold leading-tight">Volume</h3>
          <p className="text-[10px] text-muted-foreground">
            Estimated weekly hypertrophy volume
          </p>
        </div>
      </div>
      {status !== 'none' && <StatusChip status={status} />}
    </div>
  );
}

function StatusChip({ status, className = '' }: { status: VolumeStatus; className?: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_CHIP_CLASS[status]} ${className}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
