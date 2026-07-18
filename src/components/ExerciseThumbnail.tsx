import { useState } from 'react';
import { Play } from 'lucide-react';
import { getExerciseMedia } from '@/lib/exerciseMedia';
import ExerciseMediaPreview from './ExerciseMediaPreview';

interface Props {
  exerciseName: string;
  /** Tailwind size classes for the thumbnail. Defaults to a 40px premium tile. */
  className?: string;
}

/**
 * Compact tappable "exercise token" thumbnail. Renders nothing when the
 * exercise has no mapped media so unmapped rows stay visually unchanged.
 *
 * Styling notes (visual polish only — logic/paths unchanged):
 *  - Fixed 40px tile with 10px rounded corners
 *  - Subtle inset stroke + soft dark tile background so light source images
 *    don't feel pasted onto the dark UI
 *  - Very subtle play glyph overlay to hint that tapping opens a preview
 */
export default function ExerciseThumbnail({ exerciseName, className }: Props) {
  const media = getExerciseMedia(exerciseName);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!media || failed) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={`group relative shrink-0 overflow-hidden rounded-[10px] bg-secondary/70 ring-1 ring-inset ring-border/70 shadow-[inset_0_0_0_1px_hsl(var(--background)/0.25)] transition-transform active:scale-[0.97] ${className ?? 'h-10 w-10'}`}
        aria-label={`Preview ${exerciseName}`}
      >
        <img
          src={media.imageUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
        {/* Subtle darkening + play glyph to communicate tap-to-preview */}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
        <span className="pointer-events-none absolute bottom-0.5 right-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-background/70 backdrop-blur-sm ring-1 ring-inset ring-border/60">
          <Play className="h-2 w-2 fill-foreground text-foreground" />
        </span>
      </button>
      {open && (
        <ExerciseMediaPreview
          open={open}
          onOpenChange={setOpen}
          exerciseName={exerciseName}
          media={media}
        />
      )}
    </>
  );
}
