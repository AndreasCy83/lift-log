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
import { Progress } from '@/components/ui/progress';

type SubView = 'main' | 'graphs' | 'history' | 'goals' | 'bmi';

export default function BodyTrackerPage() {
  const [refreshKey, setRefreshKey] = useState(0);
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

  // Goal progress helpers
  const goalProgress = (current: number | null | undefined, target: number | null, inverted = false) => {
    if (current == null || target == null || target === 0) return null;
    const pct = inverted
      ? Math.min(100, Math.max(0, ((target - current) / target) * 100 + 100))
      : Math.min(100, (current / target) * 100);
    return Math.round(pct);
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
              const diff = currentW - targetW;
              return (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Weight</span>
                    <span className="text-muted-foreground">{currentW.toFixed(1)} / {targetW.toFixed(1)} {unitLabel}</span>
                  </div>
                  <Progress value={Math.min(100, (currentW / targetW) * 100)} className="h-2" />
                  <p className="text-[10px] text-muted-foreground mt-0.5">{Math.abs(diff).toFixed(1)} {unitLabel} {diff > 0 ? 'to lose' : diff < 0 ? 'to gain' : '— on target!'}</p>
                </div>
              );
            })()}
            {goals.targetBodyFatPercent != null && latest?.bodyFatPercent != null && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Body Fat</span>
                  <span className="text-muted-foreground">{latest.bodyFatPercent.toFixed(1)} / {goals.targetBodyFatPercent}%</span>
                </div>
                <Progress value={goalProgress(latest.bodyFatPercent, goals.targetBodyFatPercent, true) ?? 0} className="h-2" />
              </div>
            )}
            {goals.targetMuscleMassPercent != null && latest?.muscleMassPercent != null && (
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Muscle Mass</span>
                  <span className="text-muted-foreground">{latest.muscleMassPercent.toFixed(1)} / {goals.targetMuscleMassPercent}%</span>
                </div>
                <Progress value={goalProgress(latest.muscleMassPercent, goals.targetMuscleMassPercent) ?? 0} className="h-2" />
              </div>
            )}
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
