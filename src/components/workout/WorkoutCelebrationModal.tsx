import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  X, Share2, Instagram, Trophy, Flame, Dumbbell, TrendingUp,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { toPng } from 'html-to-image';
import useEmblaCarousel from 'embla-carousel-react';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { computeCelebrationData, formatDurationShort, type WorkoutCelebrationData, type MuscleFocus } from '@/lib/workoutSummary';
import { toDisplayWeight, weightUnitLabel } from '@/lib/units';
import { getSettings } from '@/lib/storage';
import { cn } from '@/lib/utils';

interface Props {
  workoutId: string;
  open: boolean;
  onClose: () => void;
}

type CardKey = 'overview' | 'milestone' | 'muscles' | 'highlights' | 'lifetime';

interface CardDef {
  key: CardKey;
  /** Render the visual content of the card. */
  render: (d: WorkoutCelebrationData, unitLabel: string, displayWeight: (kg: number) => number) => JSX.Element;
}

// --- Helpers --------------------------------------------------------------

function fmtNum(n: number): string {
  if (!isFinite(n)) return '—';
  return Math.round(n).toLocaleString();
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// --- Card visuals ---------------------------------------------------------

function StatRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-white/60">{label}</span>
      <span className={cn('text-base font-semibold tabular-nums', accent ? 'text-primary' : 'text-white')}>
        {value}
      </span>
    </div>
  );
}

function CardShell({
  children,
  innerRef,
  accent,
}: {
  children: React.ReactNode;
  innerRef?: React.Ref<HTMLDivElement>;
  accent?: string;
}) {
  return (
    <div
      ref={innerRef}
      className="relative w-full aspect-[9/14] max-h-[72vh] mx-auto rounded-3xl overflow-hidden border border-white/10 shadow-2xl"
      style={{
        background: `radial-gradient(120% 80% at 50% 0%, ${accent ?? 'hsl(145 80% 45% / 0.18)'} 0%, hsl(220 25% 8%) 55%, hsl(220 30% 4%) 100%)`,
      }}
    >
      <div className="absolute inset-0 p-6 flex flex-col">
        {children}
      </div>
      <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center">
        <span className="text-[10px] tracking-[0.3em] font-semibold text-white/40">FITLOG X</span>
      </div>
    </div>
  );
}

// --- Card definitions -----------------------------------------------------

const overviewCard: CardDef = {
  key: 'overview',
  render: (d, unit, dw) => {
    const title = d.routineName || 'Workout Complete';
    const dateStr = (() => {
      try {
        const [y, m, day] = d.workout.date.split('-').map(Number);
        return format(new Date(y, m - 1, day), 'EEE, MMM d');
      } catch { return d.workout.date; }
    })();
    return (
      <CardShell>
        <div className="flex flex-col h-full">
          <div className="text-xs font-medium text-white/50 uppercase tracking-wider">{dateStr}</div>
          <h2 className="mt-1 text-2xl font-bold text-white leading-tight line-clamp-2 break-words">
            {title}
          </h2>
          <div className="mt-6 flex-1 flex flex-col justify-center">
            <div className="text-center mb-6">
              <div className="text-[11px] uppercase tracking-widest text-white/50">Total Volume</div>
              <div className="text-5xl font-extrabold text-white mt-1">
                {fmtNum(dw(d.totalVolumeKg))}
                <span className="text-xl font-semibold text-white/60 ml-1.5">{unit}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-white/5 p-3 border border-white/5">
                <div className="text-xl font-bold text-white">{formatDurationShort(d.durationSec)}</div>
                <div className="text-[10px] uppercase text-white/50 mt-0.5">Duration</div>
              </div>
              <div className="rounded-2xl bg-white/5 p-3 border border-white/5">
                <div className="text-xl font-bold text-white">{d.totalSets}</div>
                <div className="text-[10px] uppercase text-white/50 mt-0.5">Sets</div>
              </div>
              <div className="rounded-2xl bg-white/5 p-3 border border-white/5">
                <div className="text-xl font-bold text-white">{d.exerciseCount}</div>
                <div className="text-[10px] uppercase text-white/50 mt-0.5">Exercises</div>
              </div>
            </div>
            <div className="mt-3 rounded-2xl bg-white/5 p-3 border border-white/5 text-center">
              <div className="text-sm text-white/70">
                <span className="font-bold text-white">{fmtNum(d.totalReps)}</span> total reps
              </div>
            </div>
          </div>
        </div>
      </CardShell>
    );
  },
};

const milestoneCard: CardDef = {
  key: 'milestone',
  render: (d) => {
    const lines: string[] = [];
    if (d.workoutsThisWeek > 0) lines.push(`${d.workoutsThisWeek} workout${d.workoutsThisWeek === 1 ? '' : 's'} this week`);
    if (d.workoutsThisMonth > 0) lines.push(`${d.workoutsThisMonth} this month`);
    return (
      <CardShell accent="hsl(38 92% 55% / 0.22)">
        <div className="flex flex-col h-full items-center justify-center text-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full blur-3xl bg-orange-500/30" />
            <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-[0_0_60px_rgba(251,146,60,0.5)]">
              <Flame className="w-16 h-16 text-white" strokeWidth={2.2} fill="white" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-white">Nice work!</h2>
          <p className="mt-2 text-base text-white/70">
            That's your <span className="font-bold text-white">{ordinal(d.workoutNumberAllTime)}</span> workout
          </p>
          {d.weekStreak > 1 && (
            <div className="mt-6 px-5 py-3 rounded-full bg-orange-500/15 border border-orange-500/30">
              <span className="text-orange-300 font-bold text-lg">
                🔥 {d.weekStreak}-week streak
              </span>
            </div>
          )}
          <div className="mt-4 space-y-1">
            {lines.map(l => (
              <div key={l} className="text-sm text-white/60">{l}</div>
            ))}
          </div>
        </div>
      </CardShell>
    );
  },
};

function MuscleBars({ muscles }: { muscles: MuscleFocus[] }) {
  const top = muscles.slice(0, 6);
  return (
    <div className="space-y-2.5 w-full">
      {top.map(m => (
        <div key={m.categoryId}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-white/90">{m.name}</span>
            <span className="text-xs text-white/50 tabular-nums">{Math.round(m.share * 100)}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.max(4, m.share * 100)}%`, background: m.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const musclesCard: CardDef = {
  key: 'muscles',
  render: (d) => (
    <CardShell accent="hsl(217 91% 60% / 0.2)">
      <div className="flex flex-col h-full">
        <div className="text-xs font-medium text-white/50 uppercase tracking-wider">Muscle Focus</div>
        <h2 className="mt-1 text-2xl font-bold text-white">Today's Targets</h2>
        <div className="mt-6 flex-1 flex flex-col justify-center">
          <MuscleBars muscles={d.muscleFocus} />
        </div>
        <div className="mt-2 text-center text-xs text-white/40">
          Distribution by training volume
        </div>
      </div>
    </CardShell>
  ),
};

const highlightsCard: CardDef = {
  key: 'highlights',
  render: (d, unit, dw) => (
    <CardShell accent="hsl(280 80% 55% / 0.22)">
      <div className="flex flex-col h-full">
        <div className="text-xs font-medium text-white/50 uppercase tracking-wider">Session Highlights</div>
        <h2 className="mt-1 text-2xl font-bold text-white">
          {d.personalRecords.length > 0 ? 'New Records!' : 'Top Performances'}
        </h2>
        <div className="mt-6 flex-1 flex flex-col gap-3 justify-center">
          {d.personalRecords.slice(0, 3).map((pr, i) => (
            <div key={i} className="rounded-2xl border border-purple-400/30 bg-purple-500/10 p-4">
              <div className="flex items-center gap-2 text-purple-300 text-xs font-bold uppercase tracking-wider">
                <Trophy className="w-4 h-4" /> Personal Record
              </div>
              <div className="mt-1 text-lg font-bold text-white truncate">{pr.exerciseName}</div>
              <div className="text-2xl font-extrabold text-white mt-0.5 tabular-nums">
                {dw(pr.weightKg)} {unit} <span className="text-white/60 text-base font-semibold">× {pr.reps}</span>
              </div>
            </div>
          ))}
          {d.heaviestSet && d.personalRecords.length < 3 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-white/60 text-xs font-bold uppercase tracking-wider">
                <Dumbbell className="w-4 h-4" /> Heaviest Set
              </div>
              <div className="mt-1 text-lg font-bold text-white truncate">{d.heaviestSet.exerciseName}</div>
              <div className="text-2xl font-extrabold text-white mt-0.5 tabular-nums">
                {dw(d.heaviestSet.weightKg)} {unit} <span className="text-white/60 text-base font-semibold">× {d.heaviestSet.reps}</span>
              </div>
            </div>
          )}
          {d.topVolumeExercise && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-2 text-white/60 text-xs font-bold uppercase tracking-wider">
                <TrendingUp className="w-4 h-4" /> Top Volume
              </div>
              <div className="mt-1 text-lg font-bold text-white truncate">{d.topVolumeExercise.name}</div>
              <div className="text-2xl font-extrabold text-white mt-0.5 tabular-nums">
                {fmtNum(dw(d.topVolumeExercise.volumeKg))} {unit}
              </div>
            </div>
          )}
        </div>
      </div>
    </CardShell>
  ),
};

const lifetimeCard: CardDef = {
  key: 'lifetime',
  render: (d, unit, dw) => {
    const hours = Math.floor(d.lifetimeDurationSec / 3600);
    return (
      <CardShell accent="hsl(145 80% 45% / 0.22)">
        <div className="flex flex-col h-full">
          <div className="text-xs font-medium text-white/50 uppercase tracking-wider">All-Time</div>
          <h2 className="mt-1 text-2xl font-bold text-white">My FitLog Stats</h2>
          <div className="mt-6 flex-1 flex flex-col justify-center gap-4">
            <div className="text-center">
              <div className="text-[11px] uppercase tracking-widest text-white/50">Total Workouts</div>
              <div className="text-5xl font-extrabold text-white mt-1 tabular-nums">{d.lifetimeWorkouts}</div>
            </div>
            <div className="text-center">
              <div className="text-[11px] uppercase tracking-widest text-white/50">Weight Lifted</div>
              <div className="text-4xl font-extrabold text-white mt-1 tabular-nums">
                {fmtNum(dw(d.lifetimeVolumeKg))}
                <span className="text-lg font-semibold text-white/60 ml-1.5">{unit}</span>
              </div>
            </div>
            {hours > 0 && (
              <div className="text-center">
                <div className="text-[11px] uppercase tracking-widest text-white/50">Hours Trained</div>
                <div className="text-4xl font-extrabold text-white mt-1 tabular-nums">
                  {hours}<span className="text-lg font-semibold text-white/60 ml-1">h</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardShell>
    );
  },
};

// --- Selection: which cards to show ---------------------------------------

function pickCards(d: WorkoutCelebrationData): CardDef[] {
  const out: CardDef[] = [];
  // Always show overview if we have anything
  if (d.totalSets > 0) out.push(overviewCard);
  // Milestone if we have a workout count or streak
  if (d.workoutNumberAllTime > 0) out.push(milestoneCard);
  // Muscles if at least one category has data
  if (d.muscleFocus.length > 0) out.push(musclesCard);
  // Highlights only if we have something meaningful
  if (d.personalRecords.length > 0 || d.heaviestSet || d.topVolumeExercise) out.push(highlightsCard);
  // Lifetime if more than 1 workout
  if (d.lifetimeWorkouts > 1 || d.lifetimeVolumeKg > 0) out.push(lifetimeCard);
  return out;
}

// --- Main component -------------------------------------------------------

export default function WorkoutCelebrationModal({ workoutId, open, onClose }: Props) {
  const [data, setData] = useState<WorkoutCelebrationData | null>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: 'center', duration: 22 });
  const [activeIndex, setActiveIndex] = useState(0);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);
  const confettiFired = useRef(false);
  const [sharing, setSharing] = useState(false);

  const settings = useMemo(() => getSettings(), []);
  const unitSetting = settings.weightUnit;
  const unitLabel = weightUnitLabel(unitSetting);
  const dw = useCallback(
    (kg: number) => toDisplayWeight(kg, unitSetting) ?? 0,
    [unitSetting]
  );

  // Compute data when opened
  useEffect(() => {
    if (open && workoutId) {
      setData(computeCelebrationData(workoutId));
    }
    if (!open) {
      confettiFired.current = false;
      setActiveIndex(0);
    }
  }, [open, workoutId]);

  // Embla active slide tracking
  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setActiveIndex(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    onSelect();
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi]);

  // Confetti, once per open
  useEffect(() => {
    if (!open || !data || confettiFired.current) return;
    confettiFired.current = true;
    const duration = 3000;
    const end = Date.now() + duration;
    const colors = ['#22c55e', '#fbbf24', '#3b82f6', '#a855f7', '#ec4899', '#ffffff'];

    const tick = () => {
      const left = end - Date.now();
      if (left <= 0) return;
      confetti({
        particleCount: 4,
        startVelocity: 35,
        spread: 70,
        ticks: 200,
        origin: { x: Math.random() * 0.3, y: Math.random() * 0.2 },
        colors,
        zIndex: 100,
        gravity: 0.9,
        scalar: 0.9,
      });
      confetti({
        particleCount: 4,
        startVelocity: 35,
        spread: 70,
        ticks: 200,
        origin: { x: 0.7 + Math.random() * 0.3, y: Math.random() * 0.2 },
        colors,
        zIndex: 100,
        gravity: 0.9,
        scalar: 0.9,
      });
      requestAnimationFrame(tick);
    };
    tick();
  }, [open, data]);

  const cards = useMemo(() => (data ? pickCards(data) : []), [data]);

  // Capture currently visible card → PNG data URL
  const captureCurrentCard = useCallback(async (): Promise<string | null> => {
    const node = cardRefs.current[activeIndex];
    if (!node) return null;
    try {
      const dataUrl = await toPng(node, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#0a0e14',
      });
      return dataUrl;
    } catch (e) {
      console.error('Failed to capture card', e);
      return null;
    }
  }, [activeIndex]);

  const dataUrlToBase64 = (url: string) => url.split(',')[1] ?? '';

  const writeTempImage = useCallback(async (dataUrl: string): Promise<string | null> => {
    if (!Capacitor.isNativePlatform()) return null;
    const filename = `fitlog-share-${Date.now()}.png`;
    try {
      const res = await Filesystem.writeFile({
        path: filename,
        data: dataUrlToBase64(dataUrl),
        directory: Directory.Cache,
      });
      return res.uri;
    } catch (e) {
      console.error('writeTempImage failed', e);
      return null;
    }
  }, []);

  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleShareSheet = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const dataUrl = await captureCurrentCard();
      if (!dataUrl) { toast.error('Could not capture card'); return; }

      if (Capacitor.isNativePlatform()) {
        const fileUri = await writeTempImage(dataUrl);
        if (!fileUri) { toast.error('Could not prepare image'); return; }
        await Share.share({
          title: 'My FitLog workout',
          text: 'Crushed it 💪 #FitLogX',
          url: fileUri,
          dialogTitle: 'Share workout',
        });
      } else if (navigator.canShare) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `fitlog-workout.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'My FitLog workout', text: 'Crushed it 💪 #FitLogX' });
        } else {
          downloadDataUrl(dataUrl, 'fitlog-workout.png');
          toast.success('Image downloaded');
        }
      } else {
        downloadDataUrl(dataUrl, 'fitlog-workout.png');
        toast.success('Image downloaded');
      }
    } catch (e: any) {
      if (e?.message && !/cancel/i.test(e.message)) {
        console.error(e);
        toast.error('Share failed');
      }
    } finally {
      setSharing(false);
    }
  }, [captureCurrentCard, sharing, writeTempImage]);

  const handleInstagramShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const dataUrl = await captureCurrentCard();
      if (!dataUrl) { toast.error('Could not capture card'); return; }

      if (Capacitor.isNativePlatform()) {
        const fileUri = await writeTempImage(dataUrl);
        if (!fileUri) { toast.error('Could not prepare image'); return; }
        try {
          // Try targeted Instagram share via the system sheet (Capacitor Share has no app-target).
          // Most Android share sheets surface Instagram Stories when image/png is shared.
          await Share.share({
            title: 'Share to Instagram Stories',
            url: fileUri,
            dialogTitle: 'Share to Instagram',
          });
        } catch (err: any) {
          if (!/cancel/i.test(err?.message ?? '')) {
            toast.error('Instagram not available');
          }
        }
      } else {
        downloadDataUrl(dataUrl, 'fitlog-instagram.png');
        toast.success('Saved — open Instagram to post');
      }
    } finally {
      setSharing(false);
    }
  }, [captureCurrentCard, sharing, writeTempImage]);

  if (!open || !data) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-background flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/80 active:scale-95 transition-transform"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="text-center">
          <div className="text-primary text-xl font-extrabold leading-tight">Well done!</div>
          <div className="text-xs text-white/60">Swipe to see more</div>
        </div>
        <div className="w-10 h-10" />
      </div>

      {/* Cards carousel */}
      <div className="flex-1 min-h-0 flex flex-col justify-center">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex">
            {cards.map((c, i) => (
              <div key={c.key} className="min-w-0 shrink-0 grow-0 basis-full px-5">
                <div ref={(el) => { cardRefs.current[i] = el; }}>
                  {c.render(data, unitLabel, dw)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-1.5 mt-4">
          {cards.map((c, i) => (
            <button
              key={c.key}
              onClick={() => emblaApi?.scrollTo(i)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === activeIndex ? 'w-6 bg-primary' : 'w-1.5 bg-white/25'
              )}
              aria-label={`Card ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Bottom actions */}
      <div
        className="px-5 pt-3 flex flex-col gap-2.5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)' }}
      >
        <div className="flex gap-2.5">
          <Button
            onClick={handleInstagramShare}
            disabled={sharing}
            className="flex-1 h-12 rounded-full text-white font-semibold border-0"
            style={{
              background: 'linear-gradient(135deg,#f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)',
            }}
          >
            <Instagram className="w-5 h-5" /> Stories
          </Button>
          <Button
            onClick={handleShareSheet}
            disabled={sharing}
            variant="secondary"
            className="flex-1 h-12 rounded-full font-semibold"
          >
            <Share2 className="w-5 h-5" /> Share
          </Button>
        </div>
        <Button
          onClick={onClose}
          variant="ghost"
          className="w-full h-11 rounded-full text-white/70 hover:text-white"
        >
          Done
        </Button>
      </div>
    </div>
  );
}
