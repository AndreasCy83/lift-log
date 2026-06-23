/**
 * Coach Recommendations Card (Home page).
 *
 * Compact, collapsible insight card. Surfaces next-session adjustments and
 * deload suggestions from the offline coach engine. Visibility rules:
 *  - no items + no deload  → render nothing
 *  - deload present         → amber/warning emphasis, deload summary first
 *  - otherwise              → neutral/green-accent progression summary
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Brain, ChevronDown, AlertTriangle, Sparkles, TrendingUp, Info } from 'lucide-react';
import {
  computeCoachRecommendations,
  type ProgressionRecommendation,
  type DeloadRecommendation,
  type CoachState,
} from '@/lib/coachRecommendations';
import { getSettings } from '@/lib/storage';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';
import {
  applyCoachRecommendation,
  isRecommendationApplied,
  recommendationKey,
  isRecommendationDeferred,
  deferRecommendation,
} from '@/lib/coachApply';
import { toast } from '@/hooks/use-toast';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

interface Props {
  refreshKey?: number;
}

const TYPE_LABEL: Record<ProgressionRecommendation['recommendationType'], string> = {
  load_progression: 'Increase load',
  rep_progression: 'Increase reps',
  hold: 'Hold steady',
  set_reduce: 'Reduce sets',
  set_increase: 'Increase sets',
  deload_adjustment: 'Keep load steady',
};

function fmtWeight(kg: number | null, unit: 'kg' | 'lbs'): string {
  if (kg == null) return '—';
  const v = toDisplayWeight(kg, unit);
  return v == null ? '—' : `${v}${weightUnitLabel(unit)}`;
}

function ExerciseRow({
  rec,
  unit,
  onApply,
  onDefer,
}: {
  rec: ProgressionRecommendation;
  unit: 'kg' | 'lbs';
  onApply: (rec: ProgressionRecommendation) => void;
  onDefer: (rec: ProgressionRecommendation) => void;
}) {
  const changed = (a: string | number | null, b: string | number | null) =>
    String(a) !== String(b);
  const setsChanged = rec.nextSets !== rec.currentSets;
  const repsChanged = changed(rec.currentRepInfo, rec.nextRepInfo);
  const weightChanged =
    rec.nextWeightKg != null &&
    rec.currentWeightKg != null &&
    Math.abs(rec.nextWeightKg - rec.currentWeightKg) > 0.001;

  return (
    <div className="rounded-md border border-border/60 bg-background/40 p-2">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold text-foreground">
            {rec.exerciseName}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 min-w-0 flex-wrap">
            <span className="text-[10px] font-medium uppercase tracking-wide text-primary/80 truncate">
              {rec.mainAction ?? TYPE_LABEL[rec.recommendationType]}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onApply(rec); }}
              className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2 py-[1px] text-[10px] font-medium text-primary hover:bg-primary/20 active:scale-[0.97] transition"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDefer(rec); }}
              className="shrink-0 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-[1px] text-[10px] font-medium text-sky-400 hover:text-sky-300 hover:bg-sky-500/20 active:scale-[0.97] transition"
              aria-label="Review this recommendation later"
            >
              Review later
            </button>
          </div>
        </div>
      </div>


      <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-[10px]">
        <div className="rounded bg-secondary/40 px-1.5 py-1">
          <div className="text-muted-foreground">Sets</div>
          <div className="tabular-nums">
            <span className={setsChanged ? 'text-muted-foreground' : 'text-foreground'}>
              {rec.currentSets}
            </span>
            <span className="mx-1 text-muted-foreground">→</span>
            <span
              className={
                setsChanged ? 'font-semibold text-emerald-400' : 'text-foreground'
              }
            >
              {rec.nextSets}
            </span>
          </div>
        </div>
        <div className="rounded bg-secondary/40 px-1.5 py-1">
          <div className="text-muted-foreground">Reps</div>
          <div className="tabular-nums">
            <span className={repsChanged ? 'text-muted-foreground' : 'text-foreground'}>
              {rec.currentRepInfo}
            </span>
            <span className="mx-1 text-muted-foreground">→</span>
            <span
              className={
                repsChanged ? 'font-semibold text-emerald-400' : 'text-foreground'
              }
            >
              {rec.nextRepInfo}
            </span>
          </div>
        </div>
        <div className="rounded bg-secondary/40 px-1.5 py-1">
          <div className="text-muted-foreground">Load</div>
          <div className="tabular-nums">
            <span className={weightChanged ? 'text-muted-foreground' : 'text-foreground'}>
              {fmtWeight(rec.currentWeightKg, unit)}
            </span>
            <span className="mx-1 text-muted-foreground">→</span>
            <span
              className={
                weightChanged ? 'font-semibold text-emerald-400' : 'text-foreground'
              }
            >
              {fmtWeight(rec.nextWeightKg, unit)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <span
          className={`rounded-full px-1.5 py-[1px] text-[9px] font-medium uppercase tracking-wide ${
            rec.confidence === 'high'
              ? 'bg-emerald-500/15 text-emerald-300'
              : rec.confidence === 'medium'
                ? 'bg-primary/15 text-primary/90'
                : 'bg-muted/40 text-muted-foreground'
          }`}
        >
          {rec.confidence} confidence
        </span>
        {(rec.topReasons ?? rec.reasons).slice(0, 3).map((r, i) => (
          <span
            key={i}
            className={`rounded-full px-1.5 py-[1px] text-[9px] font-medium ${
              rec.guardrailBlocked
                ? 'bg-amber-500/15 text-amber-300'
                : 'bg-primary/10 text-primary/90'
            }`}
          >
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

function DeloadBlock({ deload }: { deload: DeloadRecommendation }) {
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
        <div className="text-[12px] font-semibold text-amber-200">
          Deload week recommended
        </div>
      </div>
      <p className="mt-1 text-[10.5px] text-foreground/80">{deload.explanation}</p>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[10px]">
        <div className="rounded bg-amber-500/10 px-1.5 py-1">
          <div className="text-amber-200/70">Volume cut</div>
          <div className="font-semibold text-amber-100">
            ~{deload.suggestedVolumeReductionPercent}%
          </div>
        </div>
        <div className="rounded bg-amber-500/10 px-1.5 py-1">
          <div className="text-amber-200/70">Target RPE</div>
          <div className="font-semibold text-amber-100">
            {deload.suggestedRPETarget}
          </div>
        </div>
      </div>
      {deload.triggers.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {deload.triggers.map((t, i) => (
            <span
              key={i}
              className="rounded-full bg-amber-500/15 px-1.5 py-[1px] text-[9px] font-medium text-amber-200"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {deload.affectedKeyLifts.length > 0 && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Affected lifts: {deload.affectedKeyLifts.join(', ')}
        </p>
      )}
    </div>
  );
}

export default function CoachRecommendationsCard({ refreshKey }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [applyTick, setApplyTick] = useState(0);
  const snap = useMemo(() => computeCoachRecommendations(), [refreshKey]);
  const unit = getSettings().weightUnit;

  // Reset expansion when data changes meaningfully
  useEffect(() => {
    setExpanded(false);
  }, [refreshKey]);

  // applyTick forces a re-render after apply/defer so the card drops applied
  // items from the active list immediately.
  const handleApply = useCallback((rec: ProgressionRecommendation) => {
    const outcome = applyCoachRecommendation(rec);
    if (outcome.kind === 'needs_confirm') {
      const ok = typeof window !== 'undefined'
        ? window.confirm(
            `Replace your planned values for ${outcome.exerciseName} with Coach's recommendation?`,
          )
        : true;
      if (!ok) return;
      const forced = applyCoachRecommendation(rec, { force: true });
      if (forced.kind === 'applied') {
        toast({ description: `Applied to next ${forced.exerciseName} session` });
      }
    } else if (outcome.kind === 'applied') {
      toast({ description: `Applied to next ${outcome.exerciseName} session` });
    } else if (outcome.kind === 'pending') {
      toast({
        description: `Saved for the next time you do ${outcome.exerciseName}`,
      });
    }
    setApplyTick((n) => n + 1);
  }, []);

  const handleDefer = useCallback((rec: ProgressionRecommendation) => {
    deferRecommendation(rec);
    toast({ description: `Saved to review later — back in ~12 days` });
    setApplyTick((n) => n + 1);
  }, []);

  const hasDeload = !!snap.deload;
  const DELOAD_SAFE: Set<ProgressionRecommendation['recommendationType']> = new Set([
    'set_reduce',
    'hold',
    'deload_adjustment',
  ]);
  const baseItems = hasDeload
    ? snap.items.filter((it) => DELOAD_SAFE.has(it.recommendationType))
    : snap.items;
  // Hide already-applied and actively-deferred items from the Home queue.
  // Expired deferrals are auto-purged inside isRecommendationDeferred().
  const visibleItems = baseItems.filter(
    (it) => !isRecommendationApplied(it) && !isRecommendationDeferred(it),
  );
  const itemCount = visibleItems.length;

  // V3: also render the card for behavior-only states (comeback / inactive),
  // so the user gets calm, supportive guidance even with no item-level signal.
  const hasBehaviorMessage =
    snap.comebackMode ||
    snap.adherenceStatus === 'returning' ||
    snap.adherenceStatus === 'inactive';

  if (!hasDeload && itemCount === 0 && !hasBehaviorMessage) return null;

  const isWarning = hasDeload;
  const titleIcon = isWarning ? (
    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
  ) : (
    <Brain className="h-3.5 w-3.5 text-primary shrink-0" />
  );

  // V2: top-level coach state badge derived in orchestrator.
  const STATE_LABEL: Record<CoachState, string> = {
    train: 'Train',
    adapt: 'Adapt',
    recover: 'Recover',
  };
  const STATE_CLASS: Record<CoachState, string> = {
    train: 'bg-emerald-500/15 text-emerald-300',
    adapt: 'bg-primary/15 text-primary',
    recover: 'bg-amber-500/20 text-amber-200',
  };
  const stateBadgeText = STATE_LABEL[snap.state];
  const stateBadgeClass = STATE_CLASS[snap.state];

  // Prefer the snapshot-provided summary line; fall back for safety.
  const summaryLine =
    snap.summaryLine ||
    (hasDeload
      ? 'Fatigue elevated — deload week recommended'
      : itemCount === 1
        ? `${visibleItems[0].exerciseName} • ${(
            visibleItems[0].mainAction ?? TYPE_LABEL[visibleItems[0].recommendationType]
          ).toLowerCase()}`
        : 'Tuned suggestions ready for your next session');
  const trendSummary = snap.trendSummary;

  return (
    <div
      className={`gym-card mt-4 !p-3 animate-fade-in ${
        isWarning ? 'border border-amber-500/30' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {titleIcon}
          <h3 className="font-display text-sm font-semibold truncate">Coach</h3>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="ml-0.5 inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="What is Coach?"
              >
                <Info className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" side="bottom" className="max-w-[260px] text-xs text-muted-foreground leading-relaxed">
              Coach reviews your recent training and suggests small adjustments for your next session, such as load, reps, sets, or exercise focus. Suggestions are based on your recent performance, consistency, and training trends — you stay in control and choose what to apply.
            </PopoverContent>
          </Popover>
        </div>
        <span
          className={`shrink-0 rounded-full px-1.5 py-[1px] text-[9px] font-medium uppercase tracking-wider ${stateBadgeClass}`}
        >
          {stateBadgeText}
        </span>
      </div>

      {/* Compact summary line */}
      <div className="mt-1 flex items-center gap-1.5 min-w-0">
        <Sparkles
          className={`h-3 w-3 shrink-0 ${
            isWarning ? 'text-amber-400/80' : 'text-primary/70'
          }`}
        />
        <p className="truncate text-[11.5px] text-foreground/90">{summaryLine}</p>
      </div>

      {/* V2: trend hint */}
      {trendSummary && (
        <div className="mt-0.5 flex items-center gap-1 min-w-0">
          <TrendingUp
            className={`h-2.5 w-2.5 shrink-0 ${
              isWarning ? 'text-amber-400/70' : 'text-muted-foreground'
            }`}
          />
          <p className="truncate text-[10px] text-muted-foreground">{trendSummary}</p>
        </div>
      )}

      {/* Expanded body */}
      <div
        className="overflow-hidden"
        style={{
          maxHeight: expanded ? '2000px' : '0px',
          opacity: expanded ? 1 : 0,
          transition: 'max-height 320ms ease-out, opacity 260ms ease-out',
        }}
      >
        <div className="space-y-2 pt-2">
          {hasDeload && snap.deload && <DeloadBlock deload={snap.deload} />}

          {/* V3: weekly behavior context — calm, supportive, one line. */}
          {snap.weeklyBehaviorSummary && (
            <div className="rounded-md border border-border/50 bg-background/30 px-2 py-1.5">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                This week
              </div>
              <p className="text-[11px] text-foreground/85">
                {snap.weeklyBehaviorSummary}
              </p>
              {snap.comebackMode && (
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  Ease back in — no need to chase prior numbers today.
                </p>
              )}
            </div>
          )}

          {itemCount > 0 && (
            <div className="space-y-1.5">
              {hasDeload && (
                <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Next session adjustments
                </div>
              )}
              {visibleItems.map((rec) => (
                <ExerciseRow
                  key={recommendationKey(rec)}
                  rec={rec}
                  unit={unit}
                  onApply={handleApply}
                  onDefer={handleDefer}
                />
              ))}
            </div>
          )}

          {itemCount === 0 && (
            <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5 text-[11px] text-emerald-300">
              All caught up — no pending adjustments.
            </div>
          )}

          <p className="pt-0.5 text-[9.5px] text-muted-foreground">
            Suggestions only. Nothing is auto-applied to your workouts.
          </p>
        </div>
      </div>

      <button
        onClick={() => setExpanded((e) => !e)}
        className="mt-1 flex w-full items-center justify-center gap-1 py-0 text-[10px] font-medium text-muted-foreground/70 hover:text-foreground transition-colors"
      >
        {expanded ? 'Show less' : 'Show details'}
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-300 ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>
    </div>
  );
}
