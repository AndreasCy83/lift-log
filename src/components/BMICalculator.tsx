import { useState } from 'react';
import { getProfile, addBMIEntry, getBMIHistory } from '@/lib/storage';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function getBMICategory(bmi: number) {
  if (bmi < 18.5) return { label: 'Underweight', color: 'text-gym-warning' };
  if (bmi < 25) return { label: 'Normal', color: 'text-gym-success' };
  if (bmi < 30) return { label: 'Overweight', color: 'text-gym-warning' };
  return { label: 'Obese', color: 'text-destructive' };
}

function healthyWeightRange(heightCm: number) {
  const hm = heightCm / 100;
  return { min: Math.round(18.5 * hm * hm * 10) / 10, max: Math.round(24.9 * hm * hm * 10) / 10 };
}

export default function BMICalculator() {
  const profile = getProfile();
  const [height, setHeight] = useState(profile?.heightCm?.toString() ?? '175');
  const [weight, setWeight] = useState(profile?.currentWeightKg?.toString() ?? '70');
  const [result, setResult] = useState<number | null>(null);

  const calculate = () => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (h > 0 && w > 0) {
      const bmi = w / ((h / 100) ** 2);
      setResult(Math.round(bmi * 10) / 10);
    }
  };

  const save = () => {
    if (result) {
      addBMIEntry({ date: format(new Date(), 'yyyy-MM-dd'), bmi: result, weightKg: parseFloat(weight), heightCm: parseFloat(height) });
    }
  };

  const cat = result ? getBMICategory(result) : null;
  const range = height ? healthyWeightRange(parseFloat(height)) : null;

  return (
    <div className="gym-card">
      <h3 className="font-display text-sm font-semibold mb-3">BMI Calculator</h3>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Height (cm)</label>
          <Input type="number" value={height} onChange={e => setHeight(e.target.value)} className="bg-secondary border-0" />
        </div>
        <div>
          <label className="text-[10px] uppercase text-muted-foreground">Weight (kg)</label>
          <Input type="number" value={weight} onChange={e => setWeight(e.target.value)} className="bg-secondary border-0" />
        </div>
      </div>
      <Button onClick={calculate} className="w-full bg-primary text-primary-foreground mb-3" size="sm">Calculate</Button>

      {result && cat && range && (
        <div className="space-y-2 animate-slide-up">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold">{result}</span>
            <span className={`text-sm font-medium ${cat.color}`}>{cat.label}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Healthy range for {height}cm: {range.min}–{range.max} kg
          </p>
          <Button variant="ghost" size="sm" onClick={save} className="text-xs text-primary">
            Save as data point
          </Button>
        </div>
      )}
    </div>
  );
}
