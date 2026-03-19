import { useState, useMemo } from 'react';
import { Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { generateFitNotesCsv, saveExportToFile, shareExport, getExportSetCount } from '@/lib/csvExport';

export default function CsvExportButtons() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const setCount = useMemo(() => getExportSetCount(), []);
  const isEmpty = setCount === 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = generateFitNotesCsv();
      await saveExportToFile(result);
      toast({ title: `✅ Saved to Downloads`, description: `${result.setCount.toLocaleString()} sets exported` });
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        toast({ title: 'Export failed', description: String(e?.message || e), variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const result = generateFitNotesCsv();
      await shareExport(result);
      toast({ title: '📤 Ready to share', description: `${result.setCount.toLocaleString()} sets` });
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        toast({ title: 'Share failed', description: String(e?.message || e), variant: 'destructive' });
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold">FitNotes CSV Export</h3>
        {setCount > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {setCount.toLocaleString()} sets
          </Badge>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={isEmpty || saving}
          size="sm"
          className="flex-1 gap-1.5"
        >
          <Download className="h-3.5 w-3.5" />
          {saving ? 'Saving…' : 'Save Export'}
        </Button>
        <Button
          onClick={handleShare}
          disabled={isEmpty || sharing}
          size="sm"
          className="flex-1 gap-1.5"
        >
          <Share2 className="h-3.5 w-3.5" />
          {sharing ? 'Sharing…' : 'Share Export'}
        </Button>
      </div>
      {isEmpty && (
        <p className="text-[10px] text-muted-foreground text-center">No workouts to export</p>
      )}
    </div>
  );
}
