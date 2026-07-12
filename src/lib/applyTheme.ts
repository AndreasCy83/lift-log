import type { ThemeMode } from './storage';
import { THEME_BY_ID, THEME_CLASSES } from './themes';
import {
  isCustomThemeId,
  getCustomTheme,
  applyCustomThemeVars,
  clearCustomThemeVars,
} from './customThemes';

export function applyTheme(theme: ThemeMode | string) {
  const root = document.documentElement;
  root.classList.remove(...THEME_CLASSES);
  clearCustomThemeVars();

  if (typeof theme === 'string' && isCustomThemeId(theme)) {
    const ct = getCustomTheme(theme);
    if (ct) {
      applyCustomThemeVars(ct);
      return;
    }
    // fallback to dark if custom theme was deleted
    root.classList.add('dark');
    return;
  }

  if (theme === 'system') {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    }
    return;
  }

  const meta = THEME_BY_ID[theme as ThemeMode];
  if (!meta) return;
  if (meta.isDark) root.classList.add('dark');
  if (meta.className) root.classList.add(meta.className);
}
