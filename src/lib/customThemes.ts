// Custom theme storage & CSS variable application.
// Custom themes live alongside built-in themes and are addressed by an id
// of the form `custom-<uuid>`. They store hex colors plus a base theme id
// for a sensible starting point.

import { generateId } from './storage';

export interface CustomThemeColors {
  background: string;   // app background
  foreground: string;   // primary text
  card: string;         // card / surface
  primary: string;      // primary accent
  secondary: string;    // secondary accent
  mutedForeground: string;
  // advanced
  border: string;
  success: string;
  warning: string;
  destructive: string;
}

export interface CustomTheme {
  id: string;               // 'custom-<uuid>'
  name: string;
  baseThemeId: string;      // e.g. 'dark'
  isDark: boolean;
  colors: CustomThemeColors;
  createdAt: string;
  updatedAt: string;
}

const KEY = 'fitlogx-custom-themes';

export function isCustomThemeId(id: string): boolean {
  return typeof id === 'string' && id.startsWith('custom-');
}

export function getCustomThemes(): CustomTheme[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function getCustomTheme(id: string): CustomTheme | null {
  return getCustomThemes().find(t => t.id === id) ?? null;
}

export function saveCustomTheme(theme: CustomTheme): void {
  const all = getCustomThemes();
  const idx = all.findIndex(t => t.id === theme.id);
  const now = new Date().toISOString();
  const next = { ...theme, updatedAt: now };
  if (idx >= 0) all[idx] = next;
  else all.push(next);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteCustomTheme(id: string): void {
  const all = getCustomThemes().filter(t => t.id !== id);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function createCustomThemeId(): string {
  return `custom-${generateId()}`;
}

// ---------- color helpers ----------

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Convert hex to `H S% L%` string used by our CSS variables. */
export function hexToHslString(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0; const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    switch (max) {
      case rn: h = ((gn - bn) / d) % 6; break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** WCAG relative luminance from hex. */
export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const chan = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a), lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Pick black or white foreground for a solid color to guarantee legible text. */
export function readableOn(hex: string): '#ffffff' | '#000000' {
  return luminance(hex) > 0.4 ? '#000000' : '#ffffff';
}

// ---------- apply ----------

const CSS_VAR_MAP: Array<[keyof CustomThemeColors | 'accent' | 'muted' | 'popover' | 'input' | 'ring' | 'gym-surface' | 'gym-success' | 'gym-warning' | 'gym-pr' | 'primary-foreground' | 'accent-foreground' | 'card-foreground' | 'secondary-foreground' | 'destructive-foreground' | 'popover-foreground' | 'gym-surface-hover', string]> = [];

export interface AppliedCssVars {
  [cssVar: string]: string;
}

/** Build the full CSS variable map from a compact custom theme. */
export function buildCssVars(theme: CustomTheme): AppliedCssVars {
  const c = theme.colors;
  const bgHsl = hexToHslString(c.background);
  const fgHsl = hexToHslString(c.foreground);
  const cardHsl = hexToHslString(c.card);
  const primaryHsl = hexToHslString(c.primary);
  const secondaryHsl = hexToHslString(c.secondary);
  const mutedFgHsl = hexToHslString(c.mutedForeground);
  const borderHsl = hexToHslString(c.border);
  const successHsl = hexToHslString(c.success);
  const warningHsl = hexToHslString(c.warning);
  const destructiveHsl = hexToHslString(c.destructive);

  const primaryFgHsl = hexToHslString(readableOn(c.primary));
  const secondaryFgHsl = fgHsl;
  const cardFgHsl = fgHsl;

  return {
    '--background': bgHsl,
    '--foreground': fgHsl,
    '--card': cardHsl,
    '--card-foreground': cardFgHsl,
    '--popover': cardHsl,
    '--popover-foreground': fgHsl,
    '--primary': primaryHsl,
    '--primary-foreground': primaryFgHsl,
    '--secondary': secondaryHsl,
    '--secondary-foreground': secondaryFgHsl,
    '--muted': cardHsl,
    '--muted-foreground': mutedFgHsl,
    '--accent': primaryHsl,
    '--accent-foreground': primaryFgHsl,
    '--destructive': destructiveHsl,
    '--destructive-foreground': hexToHslString('#ffffff'),
    '--border': borderHsl,
    '--input': borderHsl,
    '--ring': primaryHsl,
    '--gym-surface': cardHsl,
    '--gym-surface-hover': cardHsl,
    '--gym-success': successHsl,
    '--gym-warning': warningHsl,
    '--gym-pr': primaryHsl,
    // sidebar (mirror main)
    '--sidebar-background': bgHsl,
    '--sidebar-foreground': fgHsl,
    '--sidebar-primary': primaryHsl,
    '--sidebar-primary-foreground': primaryFgHsl,
    '--sidebar-accent': secondaryHsl,
    '--sidebar-accent-foreground': secondaryFgHsl,
    '--sidebar-border': borderHsl,
    '--sidebar-ring': primaryHsl,
  };
}

const INLINE_STYLE_ID = 'fitlogx-custom-theme-style';

export function applyCustomThemeVars(theme: CustomTheme): void {
  const vars = buildCssVars(theme);
  const css = `:root, .fitlogx-custom-theme { ${Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join(' ')} }`;
  let el = document.getElementById(INLINE_STYLE_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = INLINE_STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
  document.documentElement.classList.add('fitlogx-custom-theme');
  if (theme.isDark) document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
}

export function clearCustomThemeVars(): void {
  const el = document.getElementById(INLINE_STYLE_ID);
  if (el) el.remove();
  document.documentElement.classList.remove('fitlogx-custom-theme');
}

// ---------- base theme presets (colors used to seed the editor) ----------

export interface BaseThemePreset {
  id: string;
  label: string;
  isDark: boolean;
  colors: CustomThemeColors;
}

export const BASE_PRESETS: BaseThemePreset[] = [
  { id: 'dark', label: 'Dark', isDark: true, colors: {
    background: '#0d1117', foreground: '#e6ebf3', card: '#131a24',
    primary: '#22c55e', secondary: '#1e2836', mutedForeground: '#7a8699',
    border: '#232e40', success: '#22c55e', warning: '#f59e0b', destructive: '#dc2626',
  }},
  { id: 'light', label: 'Light', isDark: false, colors: {
    background: '#ffffff', foreground: '#141a24', card: '#f2f4f8',
    primary: '#16a34a', secondary: '#e6e9f0', mutedForeground: '#66707d',
    border: '#dfe3eb', success: '#16a34a', warning: '#d97706', destructive: '#dc2626',
  }},
  { id: 'amoled-black', label: 'AMOLED Black', isDark: true, colors: {
    background: '#000000', foreground: '#f2f2f2', card: '#0a0a0a',
    primary: '#22c55e', secondary: '#161616', mutedForeground: '#8a8a8a',
    border: '#1a1a1a', success: '#22c55e', warning: '#f59e0b', destructive: '#ef4444',
  }},
  { id: 'titanium', label: 'Titanium', isDark: true, colors: {
    background: '#1c2028', foreground: '#e8ebf0', card: '#242832',
    primary: '#9aa4b2', secondary: '#2c313c', mutedForeground: '#8a92a1',
    border: '#333944', success: '#4ade80', warning: '#fbbf24', destructive: '#ef4444',
  }},
  { id: 'forest', label: 'Forest', isDark: true, colors: {
    background: '#0d1a12', foreground: '#e3f0e6', card: '#132318',
    primary: '#4ade80', secondary: '#1c2f22', mutedForeground: '#7a9484',
    border: '#1e3125', success: '#4ade80', warning: '#facc15', destructive: '#ef4444',
  }},
  { id: 'crimson-iron', label: 'Crimson Iron', isDark: true, colors: {
    background: '#131313', foreground: '#f0e8ea', card: '#1a1616',
    primary: '#b03249', secondary: '#251b1d', mutedForeground: '#8a7a7d',
    border: '#2b2022', success: '#22c55e', warning: '#f59e0b', destructive: '#ef4444',
  }},
  { id: 'monochrome', label: 'Monochrome', isDark: true, colors: {
    background: '#111111', foreground: '#ececec', card: '#1a1a1a',
    primary: '#e6e6e6', secondary: '#232323', mutedForeground: '#8a8a8a',
    border: '#2a2a2a', success: '#a3a3a3', warning: '#d4d4d4', destructive: '#a3a3a3',
  }},
  { id: 'neo-blue', label: 'Neo Blue', isDark: true, colors: {
    background: '#050a17', foreground: '#e8f0ff', card: '#0b1428',
    primary: '#1c8fff', secondary: '#132242', mutedForeground: '#7a8ba8',
    border: '#1b2a48', success: '#1cd0a7', warning: '#f59e0b', destructive: '#ef4444',
  }},
  { id: 'cotton-candy', label: 'Cotton Candy', isDark: false, colors: {
    background: '#fff0f7', foreground: '#3b1e42', card: '#fce0ee',
    primary: '#e34fb4', secondary: '#e6d5f5', mutedForeground: '#7a5f80',
    border: '#efc6df', success: '#3ac09e', warning: '#f59e0b', destructive: '#dc2626',
  }},
  { id: 'usa-world-cup', label: 'USA World Cup', isDark: true, colors: {
    background: '#0b1a3a', foreground: '#eef2ff', card: '#122451',
    primary: '#c8213a', secondary: '#1a2f5f', mutedForeground: '#8896c1',
    border: '#1e3468', success: '#22c55e', warning: '#f59e0b', destructive: '#dc2626',
  }},
];

export function getBasePreset(id: string): BaseThemePreset {
  return BASE_PRESETS.find(p => p.id === id) ?? BASE_PRESETS[0];
}

// ---------- HSL manipulation & style adjustments ----------

interface Hsl { h: number; s: number; l: number; }

function hexToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0; const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    switch (max) {
      case rn: h = ((gn - bn) / d) % 6; break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function hslToHex({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (0 <= hp && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = l - c / 2;
  return rgbToHex((r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255);
}

const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));

function adjust(hex: string, fn: (h: Hsl) => Hsl): string {
  const hsl = hexToHsl(hex);
  const next = fn(hsl);
  return hslToHex({ h: (next.h + 360) % 360, s: clamp(next.s), l: clamp(next.l) });
}

export type StyleAdjustment =
  | 'softer' | 'stronger'
  | 'cooler' | 'warmer'
  | 'more-contrast' | 'less-contrast';

/** Apply a one-tap style tweak to a set of theme colors. */
export function applyStyleAdjustment(
  colors: CustomThemeColors,
  adj: StyleAdjustment,
  isDark: boolean,
): CustomThemeColors {
  const c = { ...colors };
  switch (adj) {
    case 'softer':
      c.primary = adjust(c.primary, h => ({ ...h, s: h.s * 0.75 }));
      c.secondary = adjust(c.secondary, h => ({ ...h, s: h.s * 0.85 }));
      break;
    case 'stronger':
      c.primary = adjust(c.primary, h => ({ ...h, s: Math.min(1, h.s * 1.25 + 0.05) }));
      c.secondary = adjust(c.secondary, h => ({ ...h, s: Math.min(1, h.s * 1.15) }));
      break;
    case 'cooler':
      (['primary','secondary','background','card','border'] as const).forEach(k => {
        c[k] = adjust(c[k], h => ({ ...h, h: h.h + 15 }));
      });
      break;
    case 'warmer':
      (['primary','secondary','background','card','border'] as const).forEach(k => {
        c[k] = adjust(c[k], h => ({ ...h, h: h.h - 15 }));
      });
      break;
    case 'more-contrast':
      if (isDark) {
        c.background = adjust(c.background, h => ({ ...h, l: h.l * 0.7 }));
        c.card = adjust(c.card, h => ({ ...h, l: h.l * 0.85 }));
        c.foreground = adjust(c.foreground, h => ({ ...h, l: Math.min(1, h.l + 0.05) }));
      } else {
        c.background = adjust(c.background, h => ({ ...h, l: Math.min(1, h.l + 0.03) }));
        c.foreground = adjust(c.foreground, h => ({ ...h, l: h.l * 0.5 }));
      }
      break;
    case 'less-contrast':
      if (isDark) {
        c.background = adjust(c.background, h => ({ ...h, l: h.l + 0.05 }));
        c.card = adjust(c.card, h => ({ ...h, l: h.l + 0.04 }));
        c.foreground = adjust(c.foreground, h => ({ ...h, l: h.l * 0.9 }));
      } else {
        c.foreground = adjust(c.foreground, h => ({ ...h, l: Math.min(0.4, h.l + 0.15) }));
      }
      break;
  }
  return c;
}

/** Curated accent swatches — friendly first-tap options. */
export const CURATED_ACCENTS: Array<{ label: string; hex: string }> = [
  { label: 'Green',   hex: '#22c55e' },
  { label: 'Emerald', hex: '#10b981' },
  { label: 'Blue',    hex: '#3b82f6' },
  { label: 'Indigo',  hex: '#6366f1' },
  { label: 'Violet',  hex: '#8b5cf6' },
  { label: 'Pink',    hex: '#ec4899' },
  { label: 'Red',     hex: '#ef4444' },
  { label: 'Orange',  hex: '#f97316' },
  { label: 'Amber',   hex: '#f59e0b' },
  { label: 'Cyan',    hex: '#06b6d4' },
  { label: 'Slate',   hex: '#94a3b8' },
  { label: 'White',   hex: '#e6e6e6' },
];

/** Update the primary accent, keeping secondary in tonal harmony. */
export function setAccent(colors: CustomThemeColors, hex: string, isDark: boolean): CustomThemeColors {
  const p = hexToHsl(hex);
  const secondary = hslToHex({
    h: p.h,
    s: Math.min(0.3, p.s * 0.4),
    l: isDark ? 0.15 : 0.9,
  });
  return { ...colors, primary: hex, secondary };
}
