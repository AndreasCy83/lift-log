import { getRoutineIcon } from '@/lib/routineIcon';
import { cn } from '@/lib/utils';

interface RoutineIconProps {
  name: string;
  description?: string;
  className?: string;
}

/**
 * Compact, monochrome routine identity icon.
 * Rendered in a small rounded square that aligns with card height.
 */
export function RoutineIcon({ name, description = '', className }: RoutineIconProps) {
  const Icon = getRoutineIcon(name, description);
  return (
    <div
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
        'bg-primary/10 text-primary ring-1 ring-primary/15',
        className,
      )}
      aria-hidden="true"
    >
      <Icon className="h-5 w-5" strokeWidth={2} />
    </div>
  );
}
