/**
 * MuscleMap — large anatomical front/back human-body map highlighting the
 * 7 tracked muscle groups: chest, back, shoulders, biceps, triceps, legs,
 * abs.
 *
 * Original stylized SVG artwork (not medically accurate). Regions are keyed
 * by categoryId so callers can drive fill intensity from any per-muscle
 * signal (currently Estimated Stimulus; later Recovery with different color
 * logic).
 *
 * Designed to render large inside the expanded Estimated Stimulus card, with
 * strong visual presence on mobile-sized surfaces.
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
  if (muted || level === 0) return 'hsl(var(--muted-foreground) / 0.14)';
  switch (level) {
    case 1: return 'hsl(152 62% 44% / 0.80)';
    case 2: return 'hsl(48 90% 55% / 0.88)';
    case 3: return 'hsl(28 92% 55% / 0.92)';
    case 4: return 'hsl(0 80% 56% / 0.95)';
  }
}

const STROKE = 'hsl(var(--border) / 0.9)';
const OUTLINE = 'hsl(var(--foreground) / 0.35)';
const BODY_BG = 'hsl(var(--muted) / 0.18)';
const HEAD_BG = 'hsl(var(--muted) / 0.25)';

export default function MuscleMap({ intensities, muted = false, className }: Props) {
  const f = useMemo(
    () => (cat: MuscleMapCategory) => fillFor(intensities[cat] ?? 0, muted),
    [intensities, muted],
  );

  /**
   * Two figures inside a 400 x 520 viewBox. Each figure is ~170 wide and
   * fills most of the vertical space, so the map dominates its container.
   */
  return (
    <svg
      viewBox="0 0 400 520"
      className={className}
      role="img"
      aria-label="Anatomical muscle stimulus map"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* =====================================================
          FRONT VIEW  (x: 15 → 185)
          ===================================================== */}
      <g transform="translate(15,10)">
        {/* Head */}
        <ellipse cx="85" cy="30" rx="22" ry="26" fill={HEAD_BG} stroke={OUTLINE} strokeWidth="1" />
        {/* Neck */}
        <path d="M75 54 h20 v10 q-10 5 -20 0 z" fill={BODY_BG} stroke={OUTLINE} strokeWidth="0.8" />

        {/* Torso silhouette */}
        <path
          d="M50 78
             q35 -14 70 0
             l4 40
             q-5 10 -12 12
             l-4 46
             q-3 8 -8 10
             l0 6
             q-30 8 -60 0
             l0 -6
             q-5 -2 -8 -10
             l-4 -46
             q-7 -2 -12 -12 z"
          fill={BODY_BG}
          stroke={OUTLINE}
          strokeWidth="1"
        />

        {/* Arms silhouette (upper + forearm) */}
        <path
          d="M50 82
             q-12 4 -16 16
             l-6 44
             q-2 10 0 20
             l6 34
             q1 8 6 10
             q6 -2 7 -10
             l-2 -34
             q-1 -10 2 -20
             l6 -40
             q3 -12 8 -18 z"
          fill={BODY_BG}
          stroke={OUTLINE}
          strokeWidth="1"
        />
        <path
          d="M120 82
             q12 4 16 16
             l6 44
             q2 10 0 20
             l-6 34
             q-1 8 -6 10
             q-6 -2 -7 -10
             l2 -34
             q1 -10 -2 -20
             l-6 -40
             q-3 -12 -8 -18 z"
          fill={BODY_BG}
          stroke={OUTLINE}
          strokeWidth="1"
        />

        {/* Legs silhouette */}
        <path
          d="M55 200
             q15 6 30 0
             l3 90
             q1 40 -4 90
             q-2 20 -6 40
             l-14 0
             q-4 -20 -5 -40
             q-3 -50 -4 -90 z"
          fill={BODY_BG}
          stroke={OUTLINE}
          strokeWidth="1"
        />
        <path
          d="M85 200
             q15 6 30 0
             l1 90
             q0 40 -4 90
             q-1 20 -5 40
             l-14 0
             q-4 -20 -6 -40
             q-5 -50 -4 -90 z"
          fill={BODY_BG}
          stroke={OUTLINE}
          strokeWidth="1"
        />

        {/* ---- Highlighted muscle groups (front) ---- */}

        {/* Shoulders (front delts) */}
        <path
          d="M45 82
             q10 -8 22 -6
             q6 4 6 14
             q-14 6 -28 4 z"
          fill={f('cat-shoulders')}
          stroke={STROKE}
          strokeWidth="0.8"
        />
        <path
          d="M125 82
             q-10 -8 -22 -6
             q-6 4 -6 14
             q14 6 28 4 z"
          fill={f('cat-shoulders')}
          stroke={STROKE}
          strokeWidth="0.8"
        />

        {/* Chest — two pecs */}
        <path
          d="M68 92
             q17 -8 34 0
             q-2 22 -17 26
             q-15 -4 -17 -26 z"
          fill={f('cat-chest')}
          stroke={STROKE}
          strokeWidth="0.8"
        />
        <line x1="85" y1="92" x2="85" y2="118" stroke={OUTLINE} strokeWidth="0.6" opacity="0.6" />

        {/* Biceps — front upper arms */}
        <path
          d="M36 100
             q-10 4 -12 16
             l-4 30
             q10 4 20 0
             l2 -30
             q1 -12 -6 -16 z"
          fill={f('cat-biceps')}
          stroke={STROKE}
          strokeWidth="0.8"
        />
        <path
          d="M134 100
             q10 4 12 16
             l4 30
             q-10 4 -20 0
             l-2 -30
             q-1 -12 6 -16 z"
          fill={f('cat-biceps')}
          stroke={STROKE}
          strokeWidth="0.8"
        />

        {/* Abs — 6-pack block */}
        <path
          d="M70 124
             q15 -6 30 0
             l-2 60
             q-13 6 -26 0 z"
          fill={f('cat-abs')}
          stroke={STROKE}
          strokeWidth="0.8"
        />
        {/* Center line + row dividers for definition */}
        <line x1="85" y1="126" x2="85" y2="182" stroke={OUTLINE} strokeWidth="0.6" opacity="0.55" />
        <line x1="71" y1="140" x2="99" y2="140" stroke={OUTLINE} strokeWidth="0.5" opacity="0.45" />
        <line x1="71" y1="156" x2="99" y2="156" stroke={OUTLINE} strokeWidth="0.5" opacity="0.45" />
        <line x1="72" y1="170" x2="98" y2="170" stroke={OUTLINE} strokeWidth="0.5" opacity="0.45" />

        {/* Legs — quads */}
        <path
          d="M56 210
             q14 6 28 0
             l-2 80
             q-4 6 -12 6
             q-8 0 -12 -6 z"
          fill={f('cat-legs')}
          stroke={STROKE}
          strokeWidth="0.8"
        />
        <path
          d="M86 210
             q14 6 28 0
             l-2 80
             q-4 6 -12 6
             q-8 0 -12 -6 z"
          fill={f('cat-legs')}
          stroke={STROKE}
          strokeWidth="0.8"
        />
        {/* Lower legs — calves front-shin (subtle, shares legs color) */}
        <path
          d="M60 340
             q10 4 20 0
             l-2 60
             q-4 6 -8 6
             q-4 0 -8 -6 z"
          fill={f('cat-legs')}
          opacity="0.75"
          stroke={STROKE}
          strokeWidth="0.6"
        />
        <path
          d="M90 340
             q10 4 20 0
             l-2 60
             q-4 6 -8 6
             q-4 0 -8 -6 z"
          fill={f('cat-legs')}
          opacity="0.75"
          stroke={STROKE}
          strokeWidth="0.6"
        />
      </g>

      {/* =====================================================
          BACK VIEW  (x: 215 → 385)
          ===================================================== */}
      <g transform="translate(215,10)">
        {/* Head */}
        <ellipse cx="85" cy="30" rx="22" ry="26" fill={HEAD_BG} stroke={OUTLINE} strokeWidth="1" />
        <path d="M75 54 h20 v10 q-10 5 -20 0 z" fill={BODY_BG} stroke={OUTLINE} strokeWidth="0.8" />

        {/* Torso silhouette */}
        <path
          d="M50 78
             q35 -14 70 0
             l4 40
             q-5 10 -12 12
             l-4 46
             q-3 8 -8 10
             l0 6
             q-30 8 -60 0
             l0 -6
             q-5 -2 -8 -10
             l-4 -46
             q-7 -2 -12 -12 z"
          fill={BODY_BG}
          stroke={OUTLINE}
          strokeWidth="1"
        />

        {/* Arms silhouette */}
        <path
          d="M50 82
             q-12 4 -16 16
             l-6 44
             q-2 10 0 20
             l6 34
             q1 8 6 10
             q6 -2 7 -10
             l-2 -34
             q-1 -10 2 -20
             l6 -40
             q3 -12 8 -18 z"
          fill={BODY_BG}
          stroke={OUTLINE}
          strokeWidth="1"
        />
        <path
          d="M120 82
             q12 4 16 16
             l6 44
             q2 10 0 20
             l-6 34
             q-1 8 -6 10
             q-6 -2 -7 -10
             l2 -34
             q1 -10 -2 -20
             l-6 -40
             q-3 -12 -8 -18 z"
          fill={BODY_BG}
          stroke={OUTLINE}
          strokeWidth="1"
        />

        {/* Glutes/hip region blend (drawn under leg silhouettes) */}
        <path
          d="M55 195
             q30 -6 60 0
             l-2 26
             q-28 8 -56 0 z"
          fill={f('cat-legs')}
          opacity="0.9"
          stroke={STROKE}
          strokeWidth="0.8"
        />

        {/* Legs silhouette */}
        <path
          d="M55 210
             q15 6 30 0
             l3 80
             q1 40 -4 90
             q-2 20 -6 40
             l-14 0
             q-4 -20 -5 -40
             q-3 -50 -4 -90 z"
          fill={BODY_BG}
          stroke={OUTLINE}
          strokeWidth="1"
        />
        <path
          d="M85 210
             q15 6 30 0
             l1 80
             q0 40 -4 90
             q-1 20 -5 40
             l-14 0
             q-4 -20 -6 -40
             q-5 -50 -4 -90 z"
          fill={BODY_BG}
          stroke={OUTLINE}
          strokeWidth="1"
        />

        {/* ---- Highlighted muscle groups (back) ---- */}

        {/* Rear shoulders */}
        <path
          d="M45 82
             q10 -8 22 -6
             q6 4 6 14
             q-14 6 -28 4 z"
          fill={f('cat-shoulders')}
          stroke={STROKE}
          strokeWidth="0.8"
        />
        <path
          d="M125 82
             q-10 -8 -22 -6
             q-6 4 -6 14
             q14 6 28 4 z"
          fill={f('cat-shoulders')}
          stroke={STROKE}
          strokeWidth="0.8"
        />

        {/* Back — traps */}
        <path
          d="M70 78
             q15 -4 30 0
             l-4 22
             q-11 -3 -22 0 z"
          fill={f('cat-back')}
          stroke={STROKE}
          strokeWidth="0.8"
        />
        {/* Back — lats + mid-back (large single grouped zone) */}
        <path
          d="M62 100
             q23 -6 46 0
             l-3 40
             q-1 20 -6 34
             q-14 6 -28 0
             q-5 -14 -6 -34 z"
          fill={f('cat-back')}
          stroke={STROKE}
          strokeWidth="0.8"
        />
        {/* Spine hint */}
        <line x1="85" y1="80" x2="85" y2="176" stroke={OUTLINE} strokeWidth="0.6" opacity="0.5" />

        {/* Triceps — rear upper arms */}
        <path
          d="M36 100
             q-10 4 -12 16
             l-4 30
             q10 4 20 0
             l2 -30
             q1 -12 -6 -16 z"
          fill={f('cat-triceps')}
          stroke={STROKE}
          strokeWidth="0.8"
        />
        <path
          d="M134 100
             q10 4 12 16
             l4 30
             q-10 4 -20 0
             l-2 -30
             q-1 -12 6 -16 z"
          fill={f('cat-triceps')}
          stroke={STROKE}
          strokeWidth="0.8"
        />

        {/* Hamstrings */}
        <path
          d="M56 224
             q14 6 28 0
             l-2 70
             q-4 6 -12 6
             q-8 0 -12 -6 z"
          fill={f('cat-legs')}
          stroke={STROKE}
          strokeWidth="0.8"
        />
        <path
          d="M86 224
             q14 6 28 0
             l-2 70
             q-4 6 -12 6
             q-8 0 -12 -6 z"
          fill={f('cat-legs')}
          stroke={STROKE}
          strokeWidth="0.8"
        />
        {/* Calves */}
        <path
          d="M58 330
             q12 5 24 0
             l-2 58
             q-5 6 -10 6
             q-5 0 -10 -6 z"
          fill={f('cat-legs')}
          opacity="0.9"
          stroke={STROKE}
          strokeWidth="0.6"
        />
        <path
          d="M88 330
             q12 5 24 0
             l-2 58
             q-5 6 -10 6
             q-5 0 -10 -6 z"
          fill={f('cat-legs')}
          opacity="0.9"
          stroke={STROKE}
          strokeWidth="0.6"
        />
      </g>

      {/* View labels */}
      <text x="100" y="510" textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))" letterSpacing="2">
        FRONT
      </text>
      <text x="300" y="510" textAnchor="middle" fontSize="10" fill="hsl(var(--muted-foreground))" letterSpacing="2">
        BACK
      </text>
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
