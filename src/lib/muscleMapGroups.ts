/**
 * Mapping layer between FitLogX's visible muscle categories and the detailed
 * anatomical slugs used by `react-muscle-highlighter`.
 *
 * FitLogX only ever exposes 7 visible groups:
 *   chest, back, shoulders, biceps, triceps, legs, abs
 *
 * Grouping rules:
 *  - back  = traps + upper-back (lats) + lower-back
 *  - legs  = quads + hamstrings + calves + glutes + adductors
 *
 * This file is pure data + pure helpers. No React, no storage access.
 */
import type { VolumeStatus } from '@/lib/volumeInsights';

/** Slugs supported by the underlying body highlighter library. */
export type MuscleSlug =
  | 'abs' | 'adductors' | 'ankles' | 'biceps' | 'calves' | 'chest'
  | 'deltoids' | 'feet' | 'forearm' | 'gluteal' | 'hamstring' | 'hands'
  | 'hair' | 'head' | 'knees' | 'lower-back' | 'neck' | 'obliques'
  | 'quadriceps' | 'tibialis' | 'trapezius' | 'triceps' | 'upper-back';

/**
 * categoryId -> anatomical slugs.
 * Categories not listed here (cardio, olympic, …) are intentionally not drawn.
 */
export const CATEGORY_TO_SLUGS: Record<string, MuscleSlug[]> = {
  'cat-chest':     ['chest'],
  'cat-back':      ['trapezius', 'upper-back', 'lower-back'],
  'cat-shoulders': ['deltoids'],
  'cat-biceps':    ['biceps'],
  'cat-triceps':   ['triceps'],
  'cat-legs':      ['quadriceps', 'hamstring', 'calves', 'gluteal', 'adductors'],
  'cat-abs':       ['abs', 'obliques'],
  // Internal legacy category — visually identical to abs.
  'cat-core':      ['abs', 'obliques'],
};

export interface HighlightPart {
  slug: MuscleSlug;
  color: string;
  styles?: { fill?: string; stroke?: string; strokeWidth?: number };
  /** Soft outer halo, rendered by MuscleMap as a CSS drop-shadow filter. */
  glow?: {
    color: string;
    blur: number;
    layers: number;
    /** Gentle breathing animation intensity for extreme states. */
    pulse?: 'subtle' | 'strong';
    /**
     * Breathing amplitude 0..1 — how far opacity/brightness swing during the
     * pulse. Higher = more clearly visible breathing.
     */
    pulseAmount?: number;
  };
}

/**
 * Per-category glow damping. Large regions (legs) cover far more pixels, so
 * an identical halo reads as much stronger. Scale their halo down so glow
 * strength communicates *status*, not surface area.
 *
 * `pulse` additionally scales the breathing amplitude per category so smaller
 * regions (chest) still read as clearly alive.
 */
export const CATEGORY_GLOW_SCALE: Record<
  string,
  { alpha: number; width: number; blur: number; pulse?: number }
> = {
  // Legs cover the most pixels — keep them clearly high-stimulus but far less
  // dominant than before. Values are ~10% softer than the previous tuning.
  'cat-legs': { alpha: 0.27, width: 0.27, blur: 0.252, pulse: 0.765 },
  'cat-back': { alpha: 0.675, width: 0.675, blur: 0.675, pulse: 0.9 },
  // Chest is a small region: still lifted, but ~10% softer than before.
  'cat-chest': { alpha: 1.035, width: 1.08, blur: 1.08, pulse: 1.215 },
};


/** Base breathing amplitude per pulse intensity (0..1). */
export const PULSE_BASE_AMOUNT: Record<'subtle' | 'strong', number> = {
  subtle: 0.3,
  strong: 0.45,
};


/**
 * Per-status visual band.
 *  - alpha / dl (lightness delta) / ds (saturation delta) shape the fill
 *  - glow is ONLY defined for the high-end states
 *
 * NOTE: stroke widths / blur radii are expressed in the body SVG's *user
 * units* (viewBox 724x1448 painted at ~200x400 CSS px), so they are ~3.6x
 * larger than the equivalent CSS pixel value.
 */
interface StatusBand {
  alpha: number;
  dl: number;
  ds: number;
  /** Halo stroke alpha (in user units, see note above). */
  glowAlpha?: number;
  glowWidth?: number;
  /** Outer soft blur radius, user units. */
  glowBlur?: number;
  /** How many stacked drop-shadows (builds intensity without widening). */
  glowLayers?: number;
}

export const STATUS_BANDS: Record<VolumeStatus, StatusBand | null> = {
  none:        null,                                   // not drawn
  below:       { alpha: 0.26, dl: -16, ds: -30 },      // clearly dimmed
  maintenance: { alpha: 0.5,  dl: -7,  ds: -12 },      // softer than normal
  productive:  { alpha: 0.8,  dl: 0,   ds: 0 },        // clean category color
  progressive: { alpha: 0.94, dl: 8,  ds: 8,  glowAlpha: 0.55, glowWidth: 7,  glowBlur: 9,  glowLayers: 2 },
  high:        { alpha: 0.99, dl: 13, ds: 10, glowAlpha: 0.7,  glowWidth: 10, glowBlur: 14, glowLayers: 3 },
  very_high:   { alpha: 1,    dl: 16, ds: 12, glowAlpha: 0.8,  glowWidth: 12, glowBlur: 18, glowLayers: 3 },
};

/**
 * Expand a `categoryId -> VolumeStatus` map into per-slug highlight entries.
 * Hue (category identity) is always preserved — only opacity, lightness,
 * saturation and an optional halo change.
 */
export function buildHighlightData(
  statuses: Record<string, VolumeStatus>,
  colorFor: (categoryId: string) => string,
): HighlightPart[] {
  const out: HighlightPart[] = [];
  const seen = new Set<MuscleSlug>();

  for (const [categoryId, status] of Object.entries(statuses)) {
    const slugs = CATEGORY_TO_SLUGS[categoryId];
    const band = STATUS_BANDS[status];
    if (!slugs || !band) continue;

    const base = adjustHsl(colorFor(categoryId), band.dl, band.ds);
    const fill = withAlpha(base, band.alpha);
    const styles: HighlightPart['styles'] = { fill };
    let glow: HighlightPart['glow'];

    if (band.glowAlpha && band.glowWidth) {
      const scale = CATEGORY_GLOW_SCALE[categoryId] ?? { alpha: 1, width: 1, blur: 1, pulse: 1 };
      // Same hue, lifted a little: reads as a halo, never as a new color.
      const halo = adjustHsl(colorFor(categoryId), band.dl + 14, band.ds);
      const alpha = band.glowAlpha * scale.alpha;
      styles.stroke = withAlpha(halo, alpha);
      styles.strokeWidth = band.glowWidth * scale.width;
      const pulse =
        status === 'high' || status === 'very_high'
          ? ('strong' as const)
          : status === 'progressive'
            ? ('subtle' as const)
            : undefined;
      glow = {
        color: withAlpha(halo, Math.min(1, alpha + 0.1)),
        blur: (band.glowBlur ?? band.glowWidth * 1.5) * scale.blur,
        layers: band.glowLayers ?? 2,
        pulse,
        pulseAmount: pulse
          ? Math.min(0.6, PULSE_BASE_AMOUNT[pulse] * (scale.pulse ?? 1))
          : undefined,
      };
    }


    for (const slug of slugs) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      out.push({ slug, color: fill, styles, glow });
    }
  }

  return out;
}


/**
 * Nudge lightness/saturation of an `hsl(h, s%, l%)` color, keeping the hue
 * (category identity) untouched. Non-hsl inputs are returned unchanged.
 */
export function adjustHsl(color: string, dl: number, ds: number): string {
  const c = color.trim();
  const m = /^hsl\(\s*([\d.]+)(deg)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)$/i.exec(c);
  if (!m) return c;

  const h = parseFloat(m[1]);
  const s = parseFloat(m[3]);
  const l = parseFloat(m[4]);

  const newL = Math.min(92, Math.max(8, l + dl));
  const newS = Math.min(100, Math.max(0, s + ds));

  return `hsl(${h}, ${Math.round(newS * 10) / 10}%, ${Math.round(newL * 10) / 10}%)`;
}

/**
 * Apply an alpha channel to a color string.
 * Supports `hsl(...)`, `rgb(...)` and `#rrggbb`; falls back to the input.
 */
export function withAlpha(color: string, alpha: number): string {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 1000) / 1000;
  const c = color.trim();

  if (c.startsWith('hsl(')) return `hsla(${c.slice(4, -1)}, ${a})`;
  if (c.startsWith('hsla(')) return c;
  if (c.startsWith('rgb(')) return `rgba(${c.slice(4, -1)}, ${a})`;
  if (c.startsWith('rgba(')) return c;

  if (/^#[0-9a-f]{6}$/i.test(c)) {
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  return c;
}
