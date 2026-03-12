import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const PERCENTAGES = [100, 95, 90, 85, 80, 75, 70, 65, 60];

export default function OneRMCalculator() {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [oneRM, setOneRM] = useState<number | null>(null);

  const calculate = () => {
    const w = parseFloat(weight);
    const r = parseInt(reps);
    if (w > 0 && r > 0 && r <= 30) {
      const result = r === 1 ? w : w * (1 + r / 30); // Epley
      setOneRM(Math.round(result * 10) / 10);
    }
  };

  return (
    <div className="gym-card">
      <h3 className="font-display text-sm font-semibold mb-3">1RM Calculator</h3>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Weight (kg)</label>
          <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="bg-secondary border-0" />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Reps</label>
          <Input type="number" value={reps} onChange={e => setReps(e.target.value)} className="bg-secondary border-0" />
        </div>
      </div>
      <Button onClick={calculate} className="w-full bg-primary text-primary-foreground mb-3" size="sm">Calculate</Button>

      {oneRM && (
        <div className="animate-slide-up">
          <div className="mb-3 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold">{oneRM}</span>
            <span className="text-sm text-muted-foreground">kg estimated 1RM</span>
          </div>
          <div className="space-y-1">
            {PERCENTAGES.map(p => (
              <div key={p} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{p}%</span>
                <span className="font-medium">{Math.round(oneRM * p / 100 * 10) / 10} kg</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
