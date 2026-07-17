import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { ExerciseMedia } from '@/lib/exerciseMedia';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseName: string;
  media: ExerciseMedia;
}

/**
 * Lightweight preview modal. Shows the animated GIF at a larger size.
 * If the GIF fails to load, falls back to the static image; if both fail,
 * shows a soft placeholder so the modal never renders broken.
 */
export default function ExerciseMediaPreview({ open, onOpenChange, exerciseName, media }: Props) {
  const [gifFailed, setGifFailed] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-4">
        <DialogHeader>
          <DialogTitle className="font-display text-base">{exerciseName}</DialogTitle>
        </DialogHeader>
        <div className="mt-2 flex items-center justify-center rounded-lg bg-secondary/60 overflow-hidden aspect-square">
          {!gifFailed ? (
            <img
              src={media.gifUrl}
              alt={`${exerciseName} demonstration`}
              className="max-h-full max-w-full object-contain"
              onError={() => setGifFailed(true)}
            />
          ) : !imgFailed ? (
            <img
              src={media.imageUrl}
              alt={exerciseName}
              className="max-h-full max-w-full object-contain"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="p-6 text-xs text-muted-foreground text-center">
              Preview unavailable
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
