import { Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ChangelogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CHANGES = [
  'Added New Routines/Programs',
  '8 Languages (beta)',
  'Added Measurements in Body Function',
  'Optimized Flow',
  'Improved Rest Timer',
];

export default function ChangelogDialog({ open, onOpenChange }: ChangelogDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            What's New
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <span className="font-display text-2xl font-bold text-primary">Version 1.5</span>
            <p className="text-xs text-muted-foreground mt-1">Latest additions and fixes</p>
          </div>

          <ul className="space-y-2">
            {CHANGES.map((change, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-primary mt-0.5">•</span>
                <span className="text-muted-foreground">{change}</span>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" className="w-full">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
