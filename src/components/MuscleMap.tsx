/**
 * MuscleMap — compact front/back SVG figure highlighting the 7 tracked
 * muscle groups: chest, back, shoulders, biceps, triceps, legs, abs.
 *
 * Original, stylized artwork (not anatomical). Regions are keyed by
 * categoryId so callers can drive fill intensity from any per-muscle
 * signal (currently Estimated Stimulus; later Recovery with different
 * color logic).
 */
import { useMemo } from 'react';

export type MuscleIntensity = 0 | 1 | 2 | 3 | 4;

/** Supported muscle categories for this map. */
export const MUSCLE_MAP_CATEGORIES = [
  'cat-chest',
  'cat-back',
  'cat-shoulders',
  'cat-biceps',
  'cat-triceps',
  'cat-legs',
  'cat-abs',
] as const;

export type MuscleMapCategory = (typeof MUSCLE_MAP_CATEGORIES)[number];

interface Props {
  /** Intensity 0..4 per category. Missing = 0 (subdued). */
  intensities: Partial<Record<MuscleMapCategory, MuscleIntensity>>;
  /** Optional dimming for empty-state usage. */
  muted?: boolean;
  className?: string;
}

/** Dark-theme friendly fill for a given intensity. */
function fillFor(level: MuscleIntensity, muted: boolean): string {
  if (muted || level === 0) return 'hsl(var(--muted) / 0.35)';
  // Green → yellow → orange → red gradient by intensity.
  switch (level) {
    case 1: return 'hsl(152 60% 42% / 0.55)';
    case 2: return 'hsl(48 90% 55% / 0.70)';
    case 3: return 'hsl(28 90% 55% / 0.80)';
    case 4: return 'hsl(0 78% 55% / 0.85)';
  }
}

const STROKE = 'hsl(var(--border))';
const BODY_BG = 'hsl(var(--muted) / 0.15)';

export default function MuscleMap({ intensities, muted = false, className }: Props) {
  const f = useMemo(
    () => (cat: MuscleMapCategory) => fillFor(intensities[cat] ?? 0, muted),
    [intensities, muted],
  );

  return (
    <svg
      viewBox="0 0 220 140"
      className={className}
      role="img"
      aria-label="Muscle stimulus map"
    >
      {/* ================= FRONT ================= */}
      <g transform="translate(6,4)">
        {/* Body silhouette */}
        <path
          d="M50 8
             c-6 0 -10 4 -10 10
             c0 4 1 7 3 9
             c-6 2 -10 6 -12 12
             l-3 14
             c-1 4 0 6 3 7
             l3 1
             l-2 20
             c0 3 -1 6 -2 9
             l-4 30
             c-1 3 1 5 4 5
             l6 0
             c1 -3 2 -12 3 -18
             c1 -4 2 -8 3 -12
             c1 4 2 8 3 12
             c1 6 2 15 3 18
             l6 0
             c3 0 5 -2 4 -5
             l-4 -30
             c-1 -3 -2 -6 -2 -9
             l-2 -20
             l3 -1
             c3 -1 4 -3 3 -7
             l-3 -14
             c-2 -6 -6 -10 -12 -12
             c2 -2 3 -5 3 -9
             c0 -6 -4 -10 -10 -10 z"
          fill={BODY_BG}
          stroke={STROKE}
          strokeWidth="0.6"
        />
        {/* Shoulders */}
        <ellipse cx="30" cy="34" rx="7" ry="5" fill={f('cat-shoulders')} stroke={STROKE} strokeWidth="0.4" />
        <ellipse cx="70" cy="34" rx="7" ry="5" fill={f('cat-shoulders')} stroke={STROKE} strokeWidth="0.4" />
        {/* Chest (two pecs) */}
        <path d="M38 34 q6 -3 12 0 v10 q-6 4 -12 0 z" fill={f('cat-chest')} stroke={STROKE} strokeWidth="0.4" />
        <path d="M50 34 q6 -3 12 0 v10 q-6 4 -12 0 z" fill={f('cat-chest')} stroke={STROKE} strokeWidth="0.4" />
        {/* Biceps (front upper arms) */}
        <ellipse cx="24" cy="46" rx="4.5" ry="8" fill={f('cat-biceps')} stroke={STROKE} strokeWidth="0.4" />
        <ellipse cx="76" cy="46" rx="4.5" ry="8" fill={f('cat-biceps')} stroke={STROKE} strokeWidth="0.4" />
        {/* Abs */}
        <rect x="43" y="48" width="14" height="22" rx="3" fill={f('cat-abs')} stroke={STROKE} strokeWidth="0.4" />
        <line x1="50" y1="50" x2="50" y2="68" stroke={STROKE} strokeWidth="0.3" opacity="0.5" />
        <line x1="43.5" y1="55" x2="56.5" y2="55" stroke={STROKE} strokeWidth="0.3" opacity="0.5" />
        <line x1="43.5" y1="61" x2="56.5" y2="61" stroke={STROKE} strokeWidth="0.3" opacity="0.5" />
        {/* Legs (quads) */}
        <path d="M38 82 q3 -2 8 0 l1 34 q-6 2 -10 0 z" fill={f('cat-legs')} stroke={STROKE} strokeWidth="0.4" />
        <path d="M54 82 q5 -2 8 0 l1 34 q-4 2 -10 0 z" fill={f('cat-legs')} stroke={STROKE} strokeWidth="0.4" />
      </g>

      {/* ================= BACK ================= */}
      <g transform="translate(118,4)">
        <path
          d="M50 8
             c-6 0 -10 4 -10 10
             c0 4 1 7 3 9
             c-6 2 -10 6 -12 12
             l-3 14
             c-1 4 0 6 3 7
             l3 1
             l-2 20
             c0 3 -1 6 -2 9
             l-4 30
             c-1 3 1 5 4 5
             l6 0
             c1 -3 2 -12 3 -18
             c1 -4 2 -8 3 -12
             c1 4 2 8 3 12
             c1 6 2 15 3 18
             l6 0
             c3 0 5 -2 4 -5
             l-4 -30
             c-1 -3 -2 -6 -2 -9
             l-2 -20
             l3 -1
             c3 -1 4 -3 3 -7
             l-3 -14
             c-2 -6 -6 -10 -12 -12
             c2 -2 3 -5 3 -9
             c0 -6 -4 -10 -10 -10 z"
          fill={BODY_BG}
          stroke={STROKE}
          strokeWidth="0.6"
        />
        {/* Rear shoulders */}
        <ellipse cx="30" cy="34" rx="7" ry="5" fill={f('cat-shoulders')} stroke={STROKE} strokeWidth="0.4" />
        <ellipse cx="70" cy="34" rx="7" ry="5" fill={f('cat-shoulders')} stroke={STROKE} strokeWidth="0.4" />
        {/* Back (traps + lats + mid-back as one region) */}
        <path
          d="M38 32
             q12 -4 24 0
             l-2 8
             q-10 -2 -20 0 z"
          fill={f('cat-back')}
          stroke={STROKE}
          strokeWidth="0.4"
        />
        <path
          d="M36 42
             q14 -3 28 0
             l-3 26
             q-11 3 -22 0 z"
          fill={f('cat-back')}
          stroke={STROKE}
          strokeWidth="0.4"
        />
        {/* Triceps (rear upper arms) */}
        <ellipse cx="24" cy="46" rx="4.5" ry="8" fill={f('cat-triceps')} stroke={STROKE} strokeWidth="0.4" />
        <ellipse cx="76" cy="46" rx="4.5" ry="8" fill={f('cat-triceps')} stroke={STROKE} strokeWidth="0.4" />
        {/* Legs (hamstrings/glutes hint) */}
        <path d="M38 78 q3 -2 8 0 q1 4 1 6 l1 32 q-6 2 -10 0 z" fill={f('cat-legs')} stroke={STROKE} strokeWidth="0.4" />
        <path d="M54 78 q5 -2 8 0 q0 4 -1 6 l1 32 q-4 2 -10 0 z" fill={f('cat-legs')} stroke={STROKE} strokeWidth="0.4" />
      </g>
    </svg>
  );
}

/** Map a VolumeStatus onto a 0..4 intensity for the muscle map. */
export function statusToIntensity(status: string): MuscleIntensity {
  switch (status) {
    case 'below':
    case 'maintenance':
      return 1;
    case 'productive':
      return 2;
    case 'progressive':
      return 3;
    case 'high':
    case 'very_high':
      return 4;
    default:
      return 0;
  }
}
