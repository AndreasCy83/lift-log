// Muscle group category color map

export const CATEGORY_COLORS: Record<string, string> = {
  'cat-chest':     'hsl(25, 95%, 53%)',    // Orange
  'cat-back':      'hsl(217, 91%, 60%)',   // Blue
  'cat-legs':      'hsl(271, 91%, 65%)',   // Purple
  'cat-shoulders': 'hsl(348, 83%, 55%)',   // Red
  'cat-biceps':    'hsl(174, 72%, 46%)',   // Teal
  'cat-triceps':   'hsl(142, 71%, 45%)',   // Green
  'cat-core':      'hsl(47, 96%, 53%)',    // Yellow
  'cat-olympic':   'hsl(189, 94%, 43%)',   // Cyan
  'cat-cardio':    'hsl(330, 81%, 60%)',   // Pink
  'cat-abs':       'hsl(15, 80%, 50%)',    // Burnt Orange
};

export function getCategoryColor(categoryId: string): string {
  return CATEGORY_COLORS[categoryId] ?? 'hsl(var(--muted-foreground))';
}
