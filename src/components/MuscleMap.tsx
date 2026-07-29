/**
 * Reusable front/back anatomical muscle map.
 *
 * Purely presentational: it receives a `categoryId -> intensity (0..1)` map and
 * paints the matching anatomy using the FitLogX category colors. Intended for
 * Estimated Stimulus first, and reusable as-is for Recovery later (just pass
 * fatigue values instead of volume values).
 */
import { useMemo } from 'react';
import Body from 'react-muscle-highlighter';
import { buildHighlightData } from '@/lib/muscleMapGroups';
import { getCategoryColor } from '@/lib/categoryColors';

export interface MuscleMapProps {
  /** categoryId -> normalized intensity 0..1 */
  values: Record<string, number>;
  /** Resolve a base color for a category. Defaults to the app category colors. */
  colorFor?: (categoryId: string) => string;
  /** Which view(s) to render. */
  side?: 'front' | 'back' | 'both';
  /** Scale passed through to the underlying SVG body. */
  scale?: number;
  className?: string;
}

export default function MuscleMap({
  values,
  colorFor = getCategoryColor,
  side = 'both',
  scale = 0.7,
  className = '',
}: MuscleMapProps) {
  const data = useMemo(
    () => buildHighlightData(values, colorFor),
    [values, colorFor],
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
