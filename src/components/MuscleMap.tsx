/**
 * Reusable front/back anatomical muscle map.
 *
 * Purely presentational: it receives a `categoryId -> VolumeStatus` map and
 * paints the matching anatomy using the FitLogX category colors, dimming
 * lower statuses and adding a restrained halo for the high-end states.
 */
import { useMemo } from 'react';
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

  const sides: Array<'front' | 'back'> =
    side === 'both' ? ['front', 'back'] : [side];

  return (
    <div className={`flex w-full items-end justify-center gap-1 ${className}`}>
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
