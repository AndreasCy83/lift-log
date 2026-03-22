import { useState, useMemo } from 'react';
import { Download, Share2 } from 'lucide-react';
import { format, subDays, subMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { generateFitNotesCsv, saveExportToFile, shareExport, getExportSetCount } from '@/lib/csvExport';

type TimeFilter = 'all' | '1W' | '1M' | '3M' | '6M' | '1Y';

const FILTERS: { value: TimeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
];

function getFromDate(filter: TimeFilter): string | undefined {
  if (filter === 'all') return undefined;
  const now = new Date();
  const map: Record<string, Date> = {
    '1W': subDays(now, 7),
    '1M': subMonths(now, 1),
    '3M': subMonths(now, 3),
    '6M': subMonths(now, 6),
    '1Y': subMonths(now, 12),
  };
  return format(map[filter], 'yyyy-MM-dd');
}

export default function CsvExportButtons() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [filter, setFilter] = useState<TimeFilter>('all');

  const fromDate = useMemo(() => getFromDate(filter), [filter]);
  const setCount = useMemo(() => getExportSetCount(fromDate), [fromDate]);
  const isEmpty = setCount === 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = generateFitNotesCsv(fromDate);
      await saveExportToFile(result);
      toast({ title: '📤 Choose where to save your file', description: `${result.setCount.toLocaleString()} sets exported` });
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
      const result = generateFitNotesCsv(fromDate);
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
        <h3 className="font-display text-sm font-semibold">Spreadsheet Export</h3>
        {setCount > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {setCount.toLocaleString()} sets
          </Badge>
        )}
      </div>

      {/* Time filter */}
      <div className="flex gap-1">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`flex-1 rounded-md py-1 text-[10px] font-medium transition-colors
              ${filter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={isEmpty || saving} size="sm" className="flex-1 gap-1.5">
          <Download className="h-3.5 w-3.5" />
          {saving ? 'Saving…' : 'Save Export'}
        </Button>
        <Button onClick={handleShare} disabled={isEmpty || sharing} size="sm" className="flex-1 gap-1.5">
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
