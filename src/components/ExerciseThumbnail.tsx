import { useState } from 'react';
import { getExerciseMedia } from '@/lib/exerciseMedia';
import ExerciseMediaPreview from './ExerciseMediaPreview';

interface Props {
  exerciseName: string;
  /** Tailwind size classes for the thumbnail. Kept small by default. */
  className?: string;
}

/**
 * Compact tappable thumbnail. Renders nothing if the exercise has no mapped
 * media, so existing rows stay visually unchanged for unmapped exercises.
 * Tapping opens the animated GIF preview modal.
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
        className={`shrink-0 overflow-hidden rounded-md bg-secondary/60 border border-border/60 ${className ?? 'h-9 w-9'}`}
        aria-label={`Preview ${exerciseName}`}
      >
        <img
          src={media.imageUrl}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
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
