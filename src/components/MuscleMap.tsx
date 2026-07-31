/**
 * Reusable front/back anatomical muscle map.
 *
 * Purely presentational: it receives a `categoryId -> VolumeStatus` map and
 * paints the matching anatomy using the FitLogX category colors, dimming
 * lower statuses and adding a restrained halo for the high-end states.
 */
import { useId, useMemo } from 'react';
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
    const rules: string[] = [
      `@keyframes ${scope}-breathe-strong{0%,100%{opacity:.72}50%{opacity:1}}`,
      `@keyframes ${scope}-breathe-subtle{0%,100%{opacity:.88}50%{opacity:1}}`,
    ];
    for (const part of data) {
      if (!part.glow) continue;
      const { color, blur, layers, pulse } = part.glow;
      const shadow = Array.from({ length: layers })
        .map((_, i) => `drop-shadow(0 0 ${blur * (i + 1) * 0.6}px ${color})`)
        .join(' ');
      const anim = pulse
        ? `animation:${scope}-breathe-${pulse} ${pulse === 'strong' ? '2.4s' : '3s'} ease-in-out infinite;`
        : '';
      rules.push(`.${scope} path[id="${part.slug}"]{filter:${shadow};${anim}}`);
    }
    // Motion safeguard: no breathing when the user prefers reduced motion.
    rules.push(
      `@media (prefers-reduced-motion: reduce){.${scope} path{animation:none !important;}}`,
    );
    return rules.join('\n');
  }, [data, scope]);


  const sides: Array<'front' | 'back'> =
    side === 'both' ? ['front', 'back'] : [side];

  return (
    <div className={`${scope} flex w-full items-end justify-center gap-1 ${className}`}>
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

