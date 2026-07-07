import {
  Sun, Moon, Monitor, Candy, Zap, Contrast, Flag,
  Circle, Hexagon, Trees, Flame,
  type LucideIcon,
} from 'lucide-react';
import type { ThemeMode } from './storage';

export interface ThemeMeta {
  id: ThemeMode;
  labelKey: string;
  fallback: string;
  icon: LucideIcon;
  /** CSS background value used for the swatch dot. */
  dot: string;
  /** Optional className applied to <html> (in addition to `dark` where noted). */
  className?: string;
  /** Whether the theme should also add the `dark` class. */
  isDark?: boolean;
}

export const THEMES: ThemeMeta[] = [
  { id: 'system', labelKey: 'settings.themeSystem', fallback: 'System', icon: Monitor,
    dot: 'linear-gradient(135deg, hsl(220 15% 95%) 50%, hsl(220 25% 10%) 50%)' },
  { id: 'light', labelKey: 'settings.themeLight', fallback: 'Light', icon: Sun,
    dot: 'hsl(0 0% 100%)' },
  { id: 'dark', labelKey: 'settings.themeDark', fallback: 'Dark', icon: Moon,
    dot: 'hsl(145 80% 45%)', isDark: true },
  { id: 'cotton-candy', labelKey: 'settings.themeCottonCandy', fallback: 'Cotton Candy', icon: Candy,
    dot: 'linear-gradient(135deg, hsl(320 80% 62%), hsl(260 80% 72%))', className: 'theme-cotton-candy' },
  { id: 'neo-blue', labelKey: 'settings.themeNeoBlue', fallback: 'Neo Blue', icon: Zap,
    dot: 'linear-gradient(135deg, hsl(210 100% 56%), hsl(195 100% 55%))', className: 'theme-neo-blue', isDark: true },
  { id: 'monochrome', labelKey: 'settings.themeMonochrome', fallback: 'Monochrome', icon: Contrast,
    dot: 'linear-gradient(135deg, hsl(0 0% 92%), hsl(0 0% 30%))', className: 'theme-monochrome', isDark: true },
  { id: 'usa-world-cup', labelKey: 'settings.themeUsaWorldCup', fallback: 'USA World Cup', icon: Flag,
    dot: 'linear-gradient(135deg, hsl(214 82% 20%) 50%, hsl(348 74% 45%) 50%)', className: 'theme-usa-world-cup', isDark: true },
  { id: 'amoled-black', labelKey: 'settings.themeAmoledBlack', fallback: 'AMOLED Black', icon: Circle,
    dot: 'linear-gradient(135deg, hsl(0 0% 0%) 50%, hsl(0 0% 30%) 50%)', className: 'theme-amoled-black', isDark: true },
  { id: 'titanium', labelKey: 'settings.themeTitanium', fallback: 'Titanium', icon: Hexagon,
    dot: 'linear-gradient(135deg, hsl(215 12% 32%), hsl(215 10% 62%))', className: 'theme-titanium', isDark: true },
  { id: 'forest', labelKey: 'settings.themeForest', fallback: 'Forest', icon: Trees,
    dot: 'linear-gradient(135deg, hsl(145 40% 10%), hsl(145 55% 42%))', className: 'theme-forest', isDark: true },
  { id: 'crimson-iron', labelKey: 'settings.themeCrimsonIron', fallback: 'Crimson Iron', icon: Flame,
    dot: 'linear-gradient(135deg, hsl(0 0% 12%) 50%, hsl(350 65% 42%) 50%)', className: 'theme-crimson-iron', isDark: true },
];

export const THEME_BY_ID: Record<ThemeMode, ThemeMeta> =
  THEMES.reduce((acc, t) => { acc[t.id] = t; return acc; }, {} as Record<ThemeMode, ThemeMeta>);

export const THEME_CLASSES: string[] = ['dark', ...THEMES.map(t => t.className).filter(Boolean) as string[]];
