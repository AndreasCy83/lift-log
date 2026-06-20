import {
  Layers,
  Flame,
  Dumbbell,
  Activity,
  Sparkles,
  Zap,
  Heart,
  Mountain,
  Rows3,
  ArrowUpDown,
  Footprints,
  ListChecks,
  type LucideIcon,
} from 'lucide-react';

export type RoutineIconKey =
  | 'ppl'
  | 'fullBody'
  | 'upperLower'
  | 'fatLoss'
  | 'hypertrophy'
  | 'strength'
  | 'beginner'
  | 'cardio'
  | 'mobility'
  | 'default';

const ICONS: Record<RoutineIconKey, LucideIcon> = {
  ppl: Rows3,
  fullBody: Activity,
  upperLower: ArrowUpDown,
  fatLoss: Flame,
  hypertrophy: Dumbbell,
  strength: Mountain,
  beginner: Sparkles,
  cardio: Heart,
  mobility: Footprints,
  default: ListChecks,
};

/**
 * Resolve a routine/program name (and optional description) to a stable icon key.
 * Keep matching cheap & order-sensitive: most specific first.
 */
export function resolveRoutineIconKey(name: string, description = ''): RoutineIconKey {
  const s = `${name} ${description}`.toLowerCase();

  if (/\b(ppl|push[\s/-]*pull[\s/-]*legs?|push pull)\b/.test(s)) return 'ppl';
  if (/\b(upper[\s/-]*lower|u\/l)\b/.test(s)) return 'upperLower';
  if (/\b(full[\s-]*body|total[\s-]*body|fbw)\b/.test(s)) return 'fullBody';
  if (/\b(fat[\s-]*loss|cut|shred|conditioning|hiit|burn)\b/.test(s)) return 'fatLoss';
  if (/\b(cardio|run(ning)?|endurance|aerobic)\b/.test(s)) return 'cardio';
  if (/\b(strength|powerlifting|5x5|5\/3\/1|wendler|starting strength)\b/.test(s)) return 'strength';
  if (/\b(hypertrophy|bodybuilding|mass|size|bro[\s-]*split)\b/.test(s)) return 'hypertrophy';
  if (/\b(beginner|starter|intro|foundation|novice)\b/.test(s)) return 'beginner';
  if (/\b(mobility|stretch|yoga|recovery|flexibility)\b/.test(s)) return 'mobility';

  return 'default';
}

export function getRoutineIcon(name: string, description = ''): LucideIcon {
  return ICONS[resolveRoutineIconKey(name, description)];
}
