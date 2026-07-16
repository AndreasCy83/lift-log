import { paletteForIndex, type GroupPosition } from '@/lib/supersets';

interface Props {
  position: GroupPosition | null;
  className?: string;
}

/**
 * Left rail + label chip for a grouped exercise. The label is shown on
 * EVERY member of the group (not only the first), and every group has a
 * distinct color drawn from GROUP_COLOR_PALETTE via position.colorIndex.
 */
export default function SupersetGroupRail({ position, className = '' }: Props) {
  if (!position) return null;
  const { isFirst, isLast, label, colorIndex } = position;
  const palette = paletteForIndex(colorIndex);
  const topRound = isFirst ? 'rounded-t-full' : '';
  const bottomRound = isLast ? 'rounded-b-full' : '';
  return (
    <div className={`absolute left-0 top-0 bottom-0 w-1 pointer-events-none ${className}`}>
      <div className={`h-full w-full ${palette.rail} opacity-80 ${topRound} ${bottomRound}`} />
      <span
        className={`absolute top-1 left-2 text-[9px] font-bold px-1 py-0.5 rounded ${palette.chipBg} ${palette.chipText}`}
      >
        {label}
      </span>
    </div>
  );
}
