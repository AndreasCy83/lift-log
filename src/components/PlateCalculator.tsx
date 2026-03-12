import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const DEFAULT_PLATES = [20, 15, 10, 5, 2.5, 1.25];

export default function PlateCalculator() {
  const [target, setTarget] = useState('');
  const [barbell, setBarbell] = useState('20');
  const [result, setResult] = useState<{ plate: number; count: number }[] | null>(null);

  const calculate = () => {
    const t = parseFloat(target);
    const b = parseFloat(barbell);
    if (t <= b) { setResult([]); return; }
    let perSide = (t - b) / 2;
    const plates: { plate: number; count: number }[] = [];
    for (const plate of DEFAULT_PLATES) {
      const count = Math.floor(perSide / plate);
      if (count > 0) {
        plates.push({ plate, count });
        perSide -= count * plate;
      }
    }
    setResult(plates);
  };

  return (
    <div className="gym-card">
      <h3 className="font-display text-sm font-semibold mb-3">Plate Calculator</h3>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Target (kg)</label>
          <Input type="number" value={target} onChange={e => setTarget(e.target.value)} className="bg-secondary border-0" />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Bar (kg)</label>
          <Input type="number" value={barbell} onChange={e => setBarbell(e.target.value)} className="bg-secondary border-0" />
        </div>
      </div>
      <Button onClick={calculate} className="w-full bg-primary text-primary-foreground mb-3" size="sm">Calculate</Button>

      {result !== null && (
        <div className="animate-slide-up">
          <p className="text-xs text-muted-foreground mb-2">Per side:</p>
          {result.length === 0 ? (
            <p className="text-sm text-muted-foreground">No plates needed</p>
          ) : (
            <div className="space-y-1">
              {result.map(({ plate, count }) => (
                <div key={plate} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{plate} kg</span>
                  <span className="font-medium">× {count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
