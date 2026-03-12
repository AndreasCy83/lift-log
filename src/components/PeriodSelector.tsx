import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export type Period = '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

const PERIODS: { value: Period; label: string }[] = [
  { value: '1W', label: '1W' },
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'All' },
];

export function periodToDays(period: Period): number | null {
  switch (period) {
    case '1W': return 7;
    case '1M': return 30;
    case '3M': return 90;
    case '6M': return 180;
    case '1Y': return 365;
    case 'ALL': return null;
  }
}

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
}

export default function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as Period)}
      className="w-full justify-start gap-1"
    >
      {PERIODS.map(p => (
        <ToggleGroupItem
          key={p.value}
          value={p.value}
          size="sm"
          className="flex-1 text-[10px] h-7 px-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {p.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
