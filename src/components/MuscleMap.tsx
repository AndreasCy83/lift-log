/**
 * Reusable front/back anatomical muscle map.
 *
 * Purely presentational: it receives a `categoryId -> VolumeStatus` map and
 * paints the matching anatomy using the FitLogX category colors, dimming
 * lower statuses and adding a restrained halo for the high-end states.
 */
import { useEffect, useId, useMemo, useState } from 'react';
import Body from 'react-muscle-highlighter';
import { buildHighlightData } from '@/lib/muscleMapGroups';
import { getCategoryColor } from '@/lib/categoryColors';
import type { VolumeStatus } from '@/lib/volumeInsights';

export interface MuscleMapProps {
  /** categoryId -> Estimated Stimulus status */
  statuses: Record<string, VolumeStatus>;
  /** Resolve a base color for a category. Defaults to the app category colors. */
  colorFor?: (categoryId: string) => string;
  /** Which view(s) to render. */
  side?: 'front' | 'back' | 'both';
  /** Scale passed through to the underlying SVG body. */
  scale?: number;
  className?: string;
}

export default function MuscleMap({
  statuses,
  colorFor = getCategoryColor,
  side = 'both',
  scale = 0.7,
  className = '',
}: MuscleMapProps) {
  const data = useMemo(
    () => buildHighlightData(statuses, colorFor),
    [statuses, colorFor],
  );

  // Unique scope so the injected glow CSS never leaks to other maps.
  const scope = `mm-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  /**
   * The highlighter library only forwards fill/stroke/strokeWidth to each
   * <path id={slug}>, so a real halo is impossible through props alone.
   * We add it with a scoped stylesheet that applies stacked drop-shadows
   * (SVG filter lengths resolve in the body's user-unit space) to the
   * paths of the glowing slugs only.
   */
  const glowCss = useMemo(() => {
    const rules: string[] = [];
    for (const part of data) {
      if (!part.glow) continue;
      const { color, blur, layers, pulse, pulseAmount } = part.glow;
      const shadow = (mult: number) =>
        Array.from({ length: layers })
          .map(
            (_, i) =>
              `drop-shadow(0 0 ${(blur * (i + 1) * 0.6 * mult).toFixed(2)}px ${color})`,
          )
          .join(' ');
      const key = `${scope}-p-${part.slug}`;
      let anim = '';
      if (pulse && pulseAmount) {
        // Slow, controlled breathing: opacity + brightness + halo swing.
        const lowOpacity = Math.max(0.4, 1 - pulseAmount);
        const lowBright = (1 - pulseAmount * 0.35).toFixed(3);
        const highBright = (1 + pulseAmount * 0.3).toFixed(3);
        rules.push(
          `@keyframes ${key}{` +
            `0%,100%{opacity:${lowOpacity.toFixed(3)};filter:${shadow(0.65)} brightness(${lowBright});}` +
            `50%{opacity:1;filter:${shadow(1.25)} brightness(${highBright});}` +
            `}`,
        );
        anim = `animation:${key} ${pulse === 'strong' ? '2.6s' : '3.2s'} ease-in-out infinite;`;
      }
      rules.push(`.${scope} path[id="${part.slug}"]{filter:${shadow(1)};${anim}}`);
    }
    // Motion safeguard: no breathing when the user prefers reduced motion.
    rules.push(
      `@media (prefers-reduced-motion: reduce){.${scope} path{animation:none !important;}}`,
    );
    // Perf: while scrolling, drop the animation entirely (static halo stays,
    // since the base rule keeps the drop-shadow filter).
    rules.push(`.${scope}.mm-scrolling path{animation:none !important;}`);
    return rules.join('\n');
  }, [data, scope]);

  /**
   * Android WebView repaints animated SVG filters on every scroll frame.
   * Pause the breathing immediately on any user interaction (scroll, touch,
   * drag) and only resume after 2 seconds of idle time. The static glow
   * remains visible the entire time because the base drop-shadow filter is
   * not tied to the animation.
   */
  const [idle, setIdle] = useState(true);
  useEffect(() => {
    let timer: number | undefined;
    const IDLE_BUFFER_MS = 2000;

    const onInteraction = () => {
      setIdle(false);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setIdle(true), IDLE_BUFFER_MS);
    };

    const events = ['scroll', 'touchstart', 'touchmove', 'pointermove', 'mousemove'];
    events.forEach(name =>
      window.addEventListener(name, onInteraction, { passive: true, capture: true }),
    );
    return () => {
      if (timer) window.clearTimeout(timer);
      events.forEach(name =>
        window.removeEventListener(name, onInteraction, { capture: true } as EventListenerOptions),
      );
    };
  }, []);

  const sides: Array<'front' | 'back'> =
    side === 'both' ? ['front', 'back'] : [side];

  return (
    <div
      className={`${scope} ${!idle ? 'mm-scrolling' : ''} flex w-full items-end justify-center gap-1 ${className}`}
      style={{ contain: 'paint', backfaceVisibility: 'hidden' }}
    >
      {glowCss && <style>{glowCss}</style>}
      {sides.map(s => (
        <div key={s} className="flex min-w-0 flex-1 flex-col items-center">
          <Body
            data={data}
            side={s}
            gender="male"
            scale={scale}
            border="none"
            defaultFill="hsl(var(--muted) / 0.55)"
            defaultStroke="hsl(var(--border))"
            defaultStrokeWidth={0.4}
          />
        </div>
      ))}
    </div>
  );
}

