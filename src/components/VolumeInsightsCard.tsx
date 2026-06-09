/**
 * Volume insights card for the Home page.
 *
 * Shows estimated weekly hypertrophy volume per muscle group derived from
 * the last 14 days of logged workouts. Collapsed by default — expand to
 * see all muscles. Renders a polished empty state when no qualifying
 * volume exists in the window.
 */
import { useMemo, useState } from 'react';
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

export default function VolumeInsightsCard({ refreshKey }: Props) {
  const [expanded, setExpanded] = useState(false);

  const summary = useMemo(() => computeVolumeSummary(), [refreshKey]);
  const categories = useMemo(() => getCategories(), []);
  const catName = (id: string) => categories.find(c => c.id === id)?.name ?? id;

  if (!summary.hasAny) {
    return (
      <div className="gym-card mt-4 !p-3">
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

  const rows = expanded
    ? summary.weeklyByCategory
    : summary.weeklyByCategory.slice(0, COLLAPSED_ROWS);
  const hiddenCount = Math.max(0, summary.weeklyByCategory.length - COLLAPSED_ROWS);

  return (
    <div className="gym-card mt-4 !p-3">
      {/* Header */}
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <h3 className="font-display text-sm font-semibold">Volume</h3>
        </div>
      </div>

      {/* Total Body compact row */}
      <div className="flex items-center gap-2 py-[3px]">
        <span className="w-14 shrink-0 text-[11px] font-semibold text-foreground truncate">
          Total Body
        </span>
        <span
          className={`shrink-0 rounded-full px-1 py-[1px] text-[8px] font-medium uppercase tracking-wider tabular-nums opacity-70 ${STATUS_CHIP_CLASS[summary.totalStatus]}`}
        >
          {STATUS_LABEL[summary.totalStatus]}
        </span>
        <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
          ~{Math.round(summary.totalWeeklySets)} sets/wk
        </span>
      </div>

      {/* Muscle rows */}
      <div className="mt-0.5 space-y-1">
        {rows.map(row => {
          const pct = Math.min(100, Math.max(4, (row.weeklySets / BAR_MAX) * 100));
          return (
            <div key={row.categoryId} className="space-y-0.5">
              <div className="flex items-center gap-2 py-[2px]">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: getCategoryColor(row.categoryId) }}
                />
                <span className="w-14 shrink-0 text-[11px] font-semibold text-foreground truncate">
                  {catName(row.categoryId)}
                </span>
                {expanded && (
                  <span
                    className={`shrink-0 rounded-full px-1 py-[1px] text-[8px] font-medium uppercase tracking-wider tabular-nums opacity-70 ${STATUS_CHIP_CLASS[row.status]}`}
                  >
                    {STATUS_LABEL[row.status]}
                  </span>
                )}
                <div className="flex-1 h-[3px] overflow-hidden rounded-full bg-background/70 ml-0.5">
                  <div
                    className={`h-full rounded-full ${STATUS_BAR_COLOR[row.status]}`}
                    style={{
                      width: `${pct}%`,
                      transition: 'width 700ms cubic-bezier(0.22,1,0.36,1)',
                    }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                  ~{row.weeklySets.toFixed(1)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

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
