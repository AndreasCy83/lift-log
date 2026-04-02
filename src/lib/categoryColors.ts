// Muscle group category color map
// Colors use HSL values matching the design system approach

export const CATEGORY_COLORS: Record<string, string> = {
  'cat-chest': 'hsl(217, 91%, 60%)',    // Blue
  'cat-back': 'hsl(142, 71%, 45%)',     // Green
  'cat-legs': 'hsl(271, 91%, 65%)',     // Purple
  'cat-shoulders': 'hsl(25, 95%, 53%)', // Orange
  'cat-biceps': 'hsl(348, 83%, 55%)',   // Red/Pink
  'cat-triceps': 'hsl(15, 80%, 50%)',   // Burnt Orange
  'cat-core': 'hsl(47, 96%, 53%)',      // Yellow
  'cat-olympic': 'hsl(189, 94%, 43%)',  // Cyan
  'cat-cardio': 'hsl(330, 81%, 60%)',   // Magenta
  'cat-abs': 'hsl(60, 80%, 50%)',       // Lime/Yellow-Green
};

export function getCategoryColor(categoryId: string): string {
  return CATEGORY_COLORS[categoryId] ?? 'hsl(var(--muted-foreground))';
}
