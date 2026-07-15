import type { GroupPosition } from '@/lib/supersets';

interface Props {
  position: GroupPosition | null;
  /** Optional accent color className override (defaults to primary). */
  className?: string;
}

/**
 * Compact visual grouping cue: a left rail with rounded caps on first/last
 * members plus a small SS/C label chip on the first member of the group.
 * Renders nothing for ungrouped exercises.
 */
export default function SupersetGroupRail({ position, className = '' }: Props) {
  if (!position) return null;
  const { isFirst, isLast, label, type } = position;
  const topRound = isFirst ? 'rounded-t-full' : '';
  const bottomRound = isLast ? 'rounded-b-full' : '';
  const chipColor = type === 'circuit' ? 'bg-fuchsia-500/20 text-fuchsia-300' : 'bg-primary/20 text-primary';
  return (
    <div className={`absolute left-0 top-0 bottom-0 w-1 pointer-events-none ${className}`}>
      <div className={`h-full w-full bg-primary/70 ${topRound} ${bottomRound}`} />
      {isFirst && (
        <span
          className={`absolute -top-1 -left-0.5 text-[9px] font-bold px-1 py-0.5 rounded ${chipColor}`}
        >
          {label}
        </span>
      )}
    </div>
  );
}
