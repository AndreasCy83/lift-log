import { Input } from '@/components/ui/input';
import type { WorkoutSet, SetType } from '@/types/fitness';
import type { WeightUnitSetting } from '@/lib/units';
import { toDisplayWeight, toStorageKg, weightUnitLabel } from '@/lib/units';

interface Props {
  set: WorkoutSet;
  setType: SetType;
  weightUnit: WeightUnitSetting;
  onUpdate: (field: keyof WorkoutSet, value: any) => void;
}

const inputClass = "h-8 text-sm text-center bg-secondary border-0 px-2 min-w-[3.5rem] w-full rounded-md [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none overflow-visible";

export default function DynamicSetInputs({ set, setType, weightUnit, onUpdate }: Props) {
  const unitLabel = weightUnitLabel(weightUnit);
  const displayWeight = toDisplayWeight(set.weightKg, weightUnit);

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value ? parseFloat(e.target.value) : null;
    onUpdate('weightKg', toStorageKg(raw, weightUnit));
  };

  switch (setType) {
    case 'WEIGHT_REPS':
      return (
        <>
          <div>
            <Input
              type="number" placeholder={unitLabel} value={displayWeight ?? ''}
              onChange={handleWeightChange}
              className={inputClass}
            />
          </div>
          <div>
            <Input
              type="number" placeholder="Reps" value={set.reps ?? ''}
              onChange={e => onUpdate('reps', e.target.value ? parseInt(e.target.value) : null)}
              className={inputClass}
            />
          </div>
          <div>
            <Input
              type="number" placeholder="RPE" value={set.rpe ?? ''}
              onChange={e => onUpdate('rpe', e.target.value ? parseFloat(e.target.value) : null)}
              className={inputClass}
            />
          </div>
        </>
      );

    case 'WEIGHT_TIME':
      return (
        <>
          <div>
            <Input
              type="number" placeholder={unitLabel} value={displayWeight ?? ''}
              onChange={handleWeightChange}
              className={inputClass}
            />
          </div>
          <div>
            <Input
              type="number" placeholder="Sec" value={set.durationMinutes ?? ''}
              onChange={e => onUpdate('durationMinutes', e.target.value ? parseFloat(e.target.value) : null)}
              className={inputClass}
            />
          </div>
          <div />
        </>
      );

    case 'REPS_DISTANCE':
      return (
        <>
          <div>
            <Input
              type="number" placeholder="Reps" value={set.reps ?? ''}
              onChange={e => onUpdate('reps', e.target.value ? parseInt(e.target.value) : null)}
              className={inputClass}
            />
          </div>
          <div>
            <Input
              type="number" placeholder="km" value={set.distanceKm ?? ''}
              onChange={e => onUpdate('distanceKm', e.target.value ? parseFloat(e.target.value) : null)}
              className={inputClass}
            />
          </div>
          <div />
        </>
      );

    case 'REPS_TIME':
      return (
        <>
          <div>
            <Input
              type="number" placeholder="Reps" value={set.reps ?? ''}
              onChange={e => onUpdate('reps', e.target.value ? parseInt(e.target.value) : null)}
              className={inputClass}
            />
          </div>
          <div>
            <Input
              type="number" placeholder="Min" value={set.durationMinutes ?? ''}
              onChange={e => onUpdate('durationMinutes', e.target.value ? parseFloat(e.target.value) : null)}
              className={inputClass}
            />
          </div>
          <div />
        </>
      );

    case 'WEIGHT_ONLY':
      return (
        <>
          <div>
            <Input
              type="number" placeholder={unitLabel} value={displayWeight ?? ''}
              onChange={handleWeightChange}
              className={inputClass}
            />
          </div>
          <div />
          <div />
        </>
      );

    default:
      return null;
  }
}

export function SetColumnHeaders({ setType, weightUnit }: { setType: SetType; weightUnit: WeightUnitSetting }) {
  const unitLabel = weightUnitLabel(weightUnit).toUpperCase();

  switch (setType) {
    case 'WEIGHT_REPS':
      return (
        <>
          <div>{unitLabel}</div>
          <div>REPS</div>
          <div>RPE</div>
        </>
      );
    case 'WEIGHT_TIME':
      return (
        <>
          <div>{unitLabel}</div>
          <div>SEC</div>
          <div />
        </>
      );
    case 'REPS_DISTANCE':
      return (
        <>
          <div>REPS</div>
          <div>KM</div>
          <div />
        </>
      );
    case 'REPS_TIME':
      return (
        <>
          <div>REPS</div>
          <div>MIN</div>
          <div />
        </>
      );
    case 'WEIGHT_ONLY':
      return (
        <>
          <div>{unitLabel}</div>
          <div />
          <div />
        </>
      );
    default:
      return null;
  }
}
