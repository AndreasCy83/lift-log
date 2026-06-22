import type { ThemeMode } from './storage';

const THEME_CLASSES = ['dark', 'theme-cotton-candy', 'theme-neo-blue'];

export function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove(...THEME_CLASSES);
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    // default light, no class
  } else if (theme === 'cotton-candy') {
    root.classList.add('theme-cotton-candy');
  } else if (theme === 'neo-blue') {
    root.classList.add('dark', 'theme-neo-blue');
  } else {
    // system
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      root.classList.add('dark');
    }
  }
}
