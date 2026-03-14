import { Input } from '@/components/ui/input';
import type { WorkoutSet, SetType, WeightUnit } from '@/types/fitness';

interface Props {
  set: WorkoutSet;
  setType: SetType;
  weightUnit: WeightUnit;
  onUpdate: (field: keyof WorkoutSet, value: any) => void;
}

export default function DynamicSetInputs({ set, setType, weightUnit, onUpdate }: Props) {
  const unitLabel = weightUnit === 'lb' ? 'lb' : 'kg';

  switch (setType) {
    case 'WEIGHT_REPS':
      return (
        <>
          <div className="col-span-3">
            <Input
              type="number" placeholder={unitLabel} value={set.weightKg ?? ''}
              onChange={e => onUpdate('weightKg', e.target.value ? parseFloat(e.target.value) : null)}
              className="h-8 text-xs text-center bg-secondary border-0"
            />
          </div>
          <div className="col-span-3">
            <Input
              type="number" placeholder="Reps" value={set.reps ?? ''}
              onChange={e => onUpdate('reps', e.target.value ? parseInt(e.target.value) : null)}
              className="h-8 text-xs text-center bg-secondary border-0"
            />
          </div>
          <div className="col-span-2">
            <Input
              type="number" placeholder="RPE" value={set.rpe ?? ''}
              onChange={e => onUpdate('rpe', e.target.value ? parseFloat(e.target.value) : null)}
              className="h-8 text-xs text-center bg-secondary border-0"
            />
          </div>
        </>
      );

    case 'WEIGHT_TIME':
      return (
        <>
          <div className="col-span-4">
            <Input
              type="number" placeholder={unitLabel} value={set.weightKg ?? ''}
              onChange={e => onUpdate('weightKg', e.target.value ? parseFloat(e.target.value) : null)}
              className="h-8 text-xs text-center bg-secondary border-0"
            />
          </div>
          <div className="col-span-4">
            <Input
              type="number" placeholder="Sec" value={set.durationMinutes ?? ''}
              onChange={e => onUpdate('durationMinutes', e.target.value ? parseFloat(e.target.value) : null)}
              className="h-8 text-xs text-center bg-secondary border-0"
            />
          </div>
        </>
      );

    case 'REPS_DISTANCE':
      return (
        <>
          <div className="col-span-4">
            <Input
              type="number" placeholder="Reps" value={set.reps ?? ''}
              onChange={e => onUpdate('reps', e.target.value ? parseInt(e.target.value) : null)}
              className="h-8 text-xs text-center bg-secondary border-0"
            />
          </div>
          <div className="col-span-4">
            <Input
              type="number" placeholder="km" value={set.distanceKm ?? ''}
              onChange={e => onUpdate('distanceKm', e.target.value ? parseFloat(e.target.value) : null)}
              className="h-8 text-xs text-center bg-secondary border-0"
            />
          </div>
        </>
      );

    case 'REPS_TIME':
      return (
        <>
          <div className="col-span-4">
            <Input
              type="number" placeholder="Reps" value={set.reps ?? ''}
              onChange={e => onUpdate('reps', e.target.value ? parseInt(e.target.value) : null)}
              className="h-8 text-xs text-center bg-secondary border-0"
            />
          </div>
          <div className="col-span-4">
            <Input
              type="number" placeholder="Min" value={set.durationMinutes ?? ''}
              onChange={e => onUpdate('durationMinutes', e.target.value ? parseFloat(e.target.value) : null)}
              className="h-8 text-xs text-center bg-secondary border-0"
            />
          </div>
        </>
      );

    case 'WEIGHT_ONLY':
      return (
        <div className="col-span-8">
          <Input
            type="number" placeholder={unitLabel} value={set.weightKg ?? ''}
            onChange={e => onUpdate('weightKg', e.target.value ? parseFloat(e.target.value) : null)}
            className="h-8 text-xs text-center bg-secondary border-0"
          />
        </div>
      );

    default:
      return null;
  }
}

export function SetColumnHeaders({ setType, weightUnit }: { setType: SetType; weightUnit: WeightUnit }) {
  const unitLabel = weightUnit === 'lb' ? 'LB' : 'KG';

  switch (setType) {
    case 'WEIGHT_REPS':
      return (
        <>
          <div className="col-span-3">{unitLabel}</div>
          <div className="col-span-3">REPS</div>
          <div className="col-span-2">RPE</div>
        </>
      );
    case 'WEIGHT_TIME':
      return (
        <>
          <div className="col-span-4">{unitLabel}</div>
          <div className="col-span-4">SEC</div>
        </>
      );
    case 'REPS_DISTANCE':
      return (
        <>
          <div className="col-span-4">REPS</div>
          <div className="col-span-4">KM</div>
        </>
      );
    case 'REPS_TIME':
      return (
        <>
          <div className="col-span-4">REPS</div>
          <div className="col-span-4">MIN</div>
        </>
      );
    case 'WEIGHT_ONLY':
      return <div className="col-span-8">{unitLabel}</div>;
    default:
      return null;
  }
}
