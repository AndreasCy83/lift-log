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
 * Lightweight preview modal. Shows the animated GIF at a larger size with
 * minimal chrome so the media dominates. Falls back to static image, then
 * to a soft placeholder — never renders broken.
 */
export default function ExerciseMediaPreview({ open, onOpenChange, exerciseName, media }: Props) {
  const [gifFailed, setGifFailed] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-3 gap-2">
        <DialogHeader className="px-1">
          <DialogTitle className="font-display text-sm font-semibold truncate pr-6">
            {exerciseName}
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center rounded-xl bg-secondary/60 ring-1 ring-inset ring-border/60 overflow-hidden aspect-square">
          {!gifFailed ? (
            <img
              src={media.gifUrl}
              alt={`${exerciseName} demonstration`}
              className="h-full w-full object-contain"
              onError={() => setGifFailed(true)}
            />
          ) : !imgFailed ? (
            <img
              src={media.imageUrl}
              alt={exerciseName}
              className="h-full w-full object-contain"
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
