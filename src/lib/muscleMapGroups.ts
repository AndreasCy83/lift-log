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
}

/**
 * Expand a `categoryId -> value (0..1)` map into per-slug highlight entries.
 *
 * @param values   normalized intensity per FitLogX category (0..1)
 * @param colorFor resolves the base color for a category
 * @param minAlpha lowest opacity applied to a category with a value > 0
 */
export function buildHighlightData(
  values: Record<string, number>,
  colorFor: (categoryId: string) => string,
  minAlpha = 0.28,
): HighlightPart[] {
  const out: HighlightPart[] = [];
  const seen = new Set<MuscleSlug>();

  for (const [categoryId, raw] of Object.entries(values)) {
    const slugs = CATEGORY_TO_SLUGS[categoryId];
    if (!slugs || !Number.isFinite(raw) || raw <= 0) continue;

    const v = Math.min(1, Math.max(0, raw));
    const alpha = minAlpha + (1 - minAlpha) * v;
    const color = withAlpha(colorFor(categoryId), alpha);

    for (const slug of slugs) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      out.push({ slug, color });
    }
  }

  return out;
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
