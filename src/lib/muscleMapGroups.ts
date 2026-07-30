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
}

/**
 * Per-status visual band.
 *  - alpha / dl (lightness delta) / ds (saturation delta) shape the fill
 *  - glow (halo stroke) is ONLY defined for the two high-end states
 */
interface StatusBand {
  alpha: number;
  dl: number;
  ds: number;
  glowAlpha?: number;
  glowWidth?: number;
}

export const STATUS_BANDS: Record<VolumeStatus, StatusBand | null> = {
  none:        null,                                   // not drawn
  below:       { alpha: 0.26, dl: -16, ds: -30 },      // clearly dimmed
  maintenance: { alpha: 0.5,  dl: -7,  ds: -12 },      // softer than normal
  productive:  { alpha: 0.8,  dl: 0,   ds: 0 },        // clean category color
  progressive: { alpha: 0.92, dl: 6,   ds: 6, glowAlpha: 0.32, glowWidth: 1.6 },
  high:        { alpha: 0.98, dl: 11,  ds: 9, glowAlpha: 0.46, glowWidth: 2.6 },
  very_high:   { alpha: 1,    dl: 14,  ds: 10, glowAlpha: 0.55, glowWidth: 3.2 },
};

/**
 * Expand a `categoryId -> VolumeStatus` map into per-slug highlight entries.
 * Hue (category identity) is always preserved — only opacity, lightness,
 * saturation and an optional halo stroke change.
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

    if (band.glowAlpha && band.glowWidth) {
      styles.stroke = withAlpha(adjustHsl(colorFor(categoryId), band.dl + 12, band.ds), band.glowAlpha);
      styles.strokeWidth = band.glowWidth;
    }

    for (const slug of slugs) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      out.push({ slug, color: fill, styles });
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
