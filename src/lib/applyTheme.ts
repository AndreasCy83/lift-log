import type { ThemeMode } from './storage';
import { THEME_BY_ID, THEME_CLASSES } from './themes';

export function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove(...THEME_CLASSES);

  if (theme === 'system') {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    }
    return;
  }

  const meta = THEME_BY_ID[theme];
  if (!meta) return;
  if (meta.isDark) root.classList.add('dark');
  if (meta.className) root.classList.add(meta.className);
}
