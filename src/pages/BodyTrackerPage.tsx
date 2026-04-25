import { useState, useMemo, useCallback } from 'react';
import { Plus, LineChart as LineChartIcon, List, Target, Activity } from 'lucide-react';
import { getBodyEntries } from '@/lib/bodyTrackerStorage';
import { getBodyGoals } from '@/lib/bodyTrackerStorage';
import { getSettings, getProfile } from '@/lib/storage';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';
import { format, subMonths, addMonths, startOfMonth, endOfMonth, differenceInDays, addWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BodyEntry } from '@/types/bodyTracker';
import AddBodyEntryModal from '@/components/body/AddBodyEntryModal';
import BodyGraphs from '@/components/body/BodyGraphs';
import BodyGoalsPanel from '@/components/body/BodyGoalsPanel';
import BodyHistoryList from '@/components/body/BodyHistoryList';
import BodyBMITrends from '@/components/body/BodyBMITrends';
import { measurementLabel, cmToDisplay } from '@/lib/bodyMeasurements';
import type { BodyMeasurementKey, BodyMeasurementUnit } from '@/types/bodyTracker';

type SubView = 'main' | 'graphs' | 'history' | 'goals' | 'bmi';

export default function BodyTrackerPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [measurementDisplayUnit, setMeasurementDisplayUnit] = useState<BodyMeasurementUnit>('cm');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [subView, setSubView] = useState<SubView>('main');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editEntry, setEditEntry] = useState<BodyEntry | null>(null);

  const entries = useMemo(() => getBodyEntries(), [refreshKey]);
  const goals = useMemo(() => getBodyGoals(), [refreshKey]);
  const settings = getSettings();
  const profile = getProfile();
  const wu = settings.weightUnit;
  const unitLabel = weightUnitLabel(wu);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Entries for current month
  const monthEntries = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return entries.filter(e => {
      const d = new Date(e.date + 'T12:00:00');
      return d >= start && d <= end;
    });
  }, [entries, currentMonth]);

  // Month change delta
  const monthDelta = useMemo(() => {
    if (monthEntries.length < 2) return null;
    const first = monthEntries[monthEntries.length - 1];
    const last = monthEntries[0];
    const diff = last.weightKg - first.weightKg;
    return diff;
  }, [monthEntries]);

  const latest = entries[0];
  const earliestWeightEntry = useMemo(
    () => [...entries].reverse().find(entry => Number.isFinite(entry.weightKg)) ?? null,
    [entries]
  );
  const earliestBodyFatEntry = useMemo(
    () => [...entries].reverse().find(entry => typeof entry.bodyFatPercent === 'number' && Number.isFinite(entry.bodyFatPercent)) ?? null,
    [entries]
  );
  const earliestMuscleMassEntry = useMemo(
    () => [...entries].reverse().find(entry => typeof entry.muscleMassPercent === 'number' && Number.isFinite(entry.muscleMassPercent)) ?? null,
    [entries]
  );

  // Directional goal progress: accounts for whether goal is to go up or down
  const isGoalAchieved = (start: number, current: number, target: number) => {
    const goingDown = target < start;
    if (goingDown) return current <= target;
    return current >= target;
  };

  const calcGoalProgress = (start: number | null | undefined, current: number | null | undefined, target: number | null | undefined) => {
    if (![start, current, target].every(value => Number.isFinite(value))) return 0;

    const safeStart = start as number;
    const safeCurrent = current as number;
    const safeTarget = target as number;

    if (safeStart === safeTarget) {
      if (safeTarget < safeStart) return safeCurrent <= safeTarget ? 1 : 0;
      if (safeTarget > safeStart) return safeCurrent >= safeTarget ? 1 : 0;
      return safeCurrent === safeTarget ? 1 : 0;
    }

    const isDownwardGoal = safeTarget < safeStart;
    const isUpwardGoal = safeTarget > safeStart;

    if (isDownwardGoal && safeCurrent <= safeTarget) return 1;
    if (isUpwardGoal && safeCurrent >= safeTarget) return 1;

    let progress = 0;

    if (isDownwardGoal) {
      const denominator = safeStart - safeTarget;
      if (denominator <= 0) return 0;
      progress = (safeStart - safeCurrent) / denominator;
    } else {
      const denominator = safeTarget - safeStart;
      if (denominator <= 0) return 0;
      progress = (safeCurrent - safeStart) / denominator;
    }

    return Math.max(0, Math.min(1, progress));
  };

  const progressWidth = (progress: number | null | undefined) => {
    const safeProgress = Math.max(0, Math.min(1, progress ?? 0));
    return `${safeProgress * 100}%`;
  };

  const progressDebugLabel = (start: number, current: number, target: number, progress: number | null | undefined) => {
    const safeProgress = Math.max(0, Math.min(1, progress ?? 0));
    return `Start: ${start.toFixed(1)} · Current: ${current.toFixed(1)} · Target: ${target.toFixed(1)} · Progress: ${Math.round(safeProgress * 100)}%`;
  };

  // Trend estimation: rate per week from recent entries
  const estimateTrend = (getValue: (e: BodyEntry) => number | null) => {
    const valid = entries.filter(e => getValue(e) != null).slice(0, 60);
    if (valid.length < 2) return null;
    const now = new Date();
    let subset = valid.filter(e => differenceInDays(now, new Date(e.date + 'T12:00:00')) <= 30);
    if (subset.length < 2) subset = valid;
    const oldest = subset[subset.length - 1];
    const newest = subset[0];
    const days = differenceInDays(new Date(newest.date + 'T12:00:00'), new Date(oldest.date + 'T12:00:00'));
    if (days === 0) return null;
    const diff = (getValue(newest)! - getValue(oldest)!);
    return (diff / days) * 7;
  };

  const trendAndEta = (start: number, current: number, target: number, ratePerWeek: number | null, unit: string) => {
    const achieved = isGoalAchieved(start, current, target);
    const remaining = Math.abs(target - current);

    // Numeric trend line
    let trendLine = '';
    if (ratePerWeek == null) {
      trendLine = 'Not enough data';
    } else {
      const sign = ratePerWeek > 0 ? '+' : '';
      trendLine = `${sign}${ratePerWeek.toFixed(2)} ${unit}/week`;
    }

    // ETA / status line
    let etaLine = '';
    if (achieved) {
      etaLine = 'Goal reached! 🎉';
    } else if (ratePerWeek == null) {
      etaLine = '';
    } else if (Math.abs(ratePerWeek) < 0.01) {
      etaLine = 'No clear trend yet';
    } else {
      const movingToward = (target > current && ratePerWeek > 0) || (target < current && ratePerWeek < 0);
      if (!movingToward) {
        etaLine = 'Trend is moving away from goal';
      } else {
        const weeksLeft = remaining / Math.abs(ratePerWeek);
        if (weeksLeft > 200) {
          etaLine = 'No clear trend yet';
        } else {
          const estDate = addWeeks(new Date(), Math.ceil(weeksLeft));
          if (weeksLeft < 4.5) {
            etaLine = `Estimated goal in ~${Math.ceil(weeksLeft)} week${Math.ceil(weeksLeft) !== 1 ? 's' : ''}`;
          } else {
            const months = weeksLeft / 4.33;
            etaLine = `Estimated goal in ~${months.toFixed(1)} months`;
          }
          etaLine += ` (${format(estDate, 'dd MMM yyyy')})`;
        }
      }
    }

    return { trendLine, etaLine };
  };

  const remainingText = (start: number, current: number, target: number, unit: string) => {
    if (isGoalAchieved(start, current, target)) {
      const over = Math.abs(current - target);
      if (over < 0.05) return 'Goal achieved! 🎉';
      return `Goal exceeded by ${over.toFixed(1)} ${unit} 🎉`;
    }
    return `${Math.abs(target - current).toFixed(1)} ${unit} remaining`;
  };

  if (subView === 'graphs') return <BodyGraphs entries={entries} onBack={() => setSubView('main')} />;
  if (subView === 'history') return <BodyHistoryList entries={entries} onBack={() => setSubView('main')} onEdit={(e) => { setEditEntry(e); setShowAddModal(true); setSubView('main'); }} onRefresh={refresh} />;
  if (subView === 'goals') return <BodyGoalsPanel onBack={() => setSubView('main')} onSaved={refresh} />;
  if (subView === 'bmi') return <BodyBMITrends entries={entries} onBack={() => setSubView('main')} />;

  return (
    <div className="flex flex-col min-h-screen bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-display font-bold">Body Tracker</h1>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-2">
        <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-1"><ChevronLeft className="h-5 w-5 text-muted-foreground" /></button>
        <div className="text-center">
          <span className="text-sm font-semibold">{format(currentMonth, 'MMMM yyyy')}</span>
          {monthDelta != null && (
            <span className={`ml-2 text-xs font-medium ${monthDelta <= 0 ? 'text-primary' : 'text-destructive'}`}>
              {monthDelta > 0 ? '+' : ''}{(toDisplayWeight(monthDelta, wu) ?? 0).toFixed(1)} {unitLabel}
            </span>
          )}
        </div>
        <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-1"><ChevronRight className="h-5 w-5 text-muted-foreground" /></button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 pb-36">
        {/* Latest summary */}
        {latest && (
          <div className="gym-card mb-4">
            <p className="text-xs text-muted-foreground mb-1">Latest</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-primary font-display">{(toDisplayWeight(latest.weightKg, wu) ?? 0).toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">{unitLabel}</span>
            </div>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              {latest.bodyFatPercent != null && <span>BF: {latest.bodyFatPercent.toFixed(1)}%</span>}
              {latest.muscleMassPercent != null && <span>MM: {latest.muscleMassPercent.toFixed(1)}%</span>}
              <span>{format(new Date(latest.date + 'T12:00:00'), 'MMM d')} · {latest.time}</span>
            </div>
          </div>
        )}

        {/* Goal progress */}
        {(goals.targetWeightKg || goals.targetBodyFatPercent || goals.targetMuscleMassPercent) && (
          <div className="gym-card mb-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Goals Progress</p>
            {goals.targetWeightKg != null && latest && (() => {
              const currentW = toDisplayWeight(latest.weightKg, wu) ?? 0;
              const targetW = toDisplayWeight(goals.targetWeightKg, wu) ?? 0;
              const startW = goals.startWeightKg != null
                ? (toDisplayWeight(goals.startWeightKg, wu) ?? currentW)
                : (earliestWeightEntry ? (toDisplayWeight(earliestWeightEntry.weightKg, wu) ?? currentW) : currentW);
              const pct = calcGoalProgress(startW, currentW, targetW) ?? 0;
              const weightTrend = estimateTrend(e => toDisplayWeight(e.weightKg, wu));
              const { trendLine, etaLine } = trendAndEta(startW, currentW, targetW, weightTrend, unitLabel);
              return (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Weight</span>
                    <span className="text-muted-foreground">{currentW.toFixed(1)} / {targetW.toFixed(1)} {unitLabel}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/50">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: progressWidth(pct) }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{progressDebugLabel(startW, currentW, targetW, pct)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{remainingText(startW, currentW, targetW, unitLabel)}</p>
                  <p className="text-[10px] text-muted-foreground">{trendLine}</p>
                  {etaLine && <p className="text-[10px] text-muted-foreground">{etaLine}</p>}
                </div>
              );
            })()}
            {goals.targetBodyFatPercent != null && latest?.bodyFatPercent != null && (() => {
              const currentBf = latest.bodyFatPercent;
              const targetBf = goals.targetBodyFatPercent;
              const startBf = goals.startBodyFatPercent ?? earliestBodyFatEntry?.bodyFatPercent ?? currentBf;
              const pct = calcGoalProgress(startBf, currentBf, targetBf) ?? 0;
              const bfTrend = estimateTrend(e => e.bodyFatPercent);
              const { trendLine, etaLine } = trendAndEta(startBf, currentBf, targetBf, bfTrend, '%');
              return (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Body Fat</span>
                    <span className="text-muted-foreground">{currentBf.toFixed(1)} / {targetBf}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/50">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: progressWidth(pct) }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{progressDebugLabel(startBf, currentBf, targetBf, pct)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{remainingText(startBf, currentBf, targetBf, '%')}</p>
                  <p className="text-[10px] text-muted-foreground">{trendLine}</p>
                  {etaLine && <p className="text-[10px] text-muted-foreground">{etaLine}</p>}
                </div>
              );
            })()}
            {goals.targetMuscleMassPercent != null && latest?.muscleMassPercent != null && (() => {
              const currentMm = latest.muscleMassPercent;
              const targetMm = goals.targetMuscleMassPercent;
              const startMm = goals.startMuscleMassPercent ?? earliestMuscleMassEntry?.muscleMassPercent ?? currentMm;
              const pct = calcGoalProgress(startMm, currentMm, targetMm) ?? 0;
              const mmTrend = estimateTrend(e => e.muscleMassPercent);
              const { trendLine, etaLine } = trendAndEta(startMm, currentMm, targetMm, mmTrend, '%');
              return (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Muscle Mass</span>
                    <span className="text-muted-foreground">{currentMm.toFixed(1)} / {targetMm}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/50">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: progressWidth(pct) }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{progressDebugLabel(startMm, currentMm, targetMm, pct)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{remainingText(startMm, currentMm, targetMm, '%')}</p>
                  <p className="text-[10px] text-muted-foreground">{trendLine}</p>
                  {etaLine && <p className="text-[10px] text-muted-foreground">{etaLine}</p>}
                </div>
              );
            })()}
          </div>
        )}

        {/* Month entries list */}
        {monthEntries.length > 0 ? (
          <div className="space-y-2">
            {monthEntries.map(entry => (
              <div
                key={entry.id}
                className="flex items-center gap-3 gym-card py-3 cursor-pointer active:scale-[0.99] transition-transform"
                onClick={() => { setEditEntry(entry); setShowAddModal(true); }}
              >
                <div className="flex flex-col items-center justify-center w-10 h-10 rounded-full bg-primary/15 flex-shrink-0">
                  <span className="text-xs font-bold leading-none">{format(new Date(entry.date + 'T12:00:00'), 'd')}</span>
                  <span className="text-[8px] uppercase text-muted-foreground leading-none mt-0.5">{format(new Date(entry.date + 'T12:00:00'), 'EEE')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-lg font-bold text-primary">{(toDisplayWeight(entry.weightKg, wu) ?? 0).toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground ml-1">{unitLabel}</span>
                </div>
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  {entry.bodyFatPercent != null && <span className="px-1.5 py-0.5 rounded bg-muted">BF {entry.bodyFatPercent.toFixed(1)}%</span>}
                  {entry.muscleMassPercent != null && <span className="px-1.5 py-0.5 rounded bg-muted">MM {entry.muscleMassPercent.toFixed(1)}%</span>}
                </div>
                <span className="text-xs text-muted-foreground">{entry.time}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No entries for {format(currentMonth, 'MMMM yyyy')}</p>
        )}
      </div>

      {/* Floating action buttons */}
      <div className="fixed bottom-20 left-0 right-0 z-40 flex items-end justify-center" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="relative flex items-center gap-4">
          {/* Left actions */}
          <button
            onClick={() => setSubView('graphs')}
            className="w-11 h-11 rounded-full bg-card border border-border flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            title="Graphs"
          >
            <LineChartIcon className="h-5 w-5 text-primary" />
          </button>
          <button
            onClick={() => setSubView('history')}
            className="w-11 h-11 rounded-full bg-card border border-border flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            title="History"
          >
            <List className="h-5 w-5 text-primary" />
          </button>

          {/* Center + */}
          <button
            onClick={() => { setEditEntry(null); setShowAddModal(true); }}
            className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-xl active:scale-95 transition-transform -mt-2"
          >
            <Plus className="h-7 w-7 text-primary-foreground" />
          </button>

          {/* Right actions */}
          <button
            onClick={() => setSubView('goals')}
            className="w-11 h-11 rounded-full bg-card border border-border flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            title="Goals"
          >
            <Target className="h-5 w-5 text-primary" />
          </button>
          <button
            onClick={() => setSubView('bmi')}
            className="w-11 h-11 rounded-full bg-card border border-border flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            title="BMI & Trends"
          >
            <Activity className="h-5 w-5 text-primary" />
          </button>
        </div>
      </div>

      {/* Add/Edit modal */}
      <AddBodyEntryModal
        open={showAddModal}
        onClose={() => { setShowAddModal(false); setEditEntry(null); }}
        onSaved={refresh}
        editEntry={editEntry}
      />
    </div>
  );
}
