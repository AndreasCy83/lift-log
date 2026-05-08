import { useEffect, useRef, useState } from 'react';
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

const inputClass = "h-8 text-sm text-center bg-secondary border-0 px-1 min-w-0 w-full rounded-md [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none overflow-visible";

/**
 * Weight input that keeps its own string state so the user can naturally type
 * decimal values (e.g. "22.5", "27.", "100.0") without the controlled value
 * being rewritten by a kg<->lbs roundtrip on every keystroke.
 */
function WeightInput({
  weightKg,
  weightUnit,
  onChangeKg,
}: {
  weightKg: number | null;
  weightUnit: WeightUnitSetting;
  onChangeKg: (kg: number | null) => void;
}) {
  const unitLabel = weightUnitLabel(weightUnit);
  const display = toDisplayWeight(weightKg, weightUnit);
  const [text, setText] = useState<string>(display !== null ? String(display) : '');
  const focusedRef = useRef(false);

  // Sync external changes (e.g. unit switched, prefill from prev set) only when not focused.
  useEffect(() => {
    if (focusedRef.current) return;
    const next = display !== null ? String(display) : '';
    setText(prev => {
      // Avoid clobbering equivalent numeric typing like "22.50" vs "22.5".
      const prevNum = prev === '' ? null : parseFloat(prev.replace(',', '.'));
      const nextNum = display;
      if (prevNum === nextNum) return prev;
      return next;
    });
  }, [display]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);
    if (raw === '' || raw === '-' || raw === '.' || raw === '-.') {
      onChangeKg(null);
      return;
    }
    const normalized = raw.replace(',', '.');
    const num = parseFloat(normalized);
    if (isNaN(num)) return;
    onChangeKg(toStorageKg(num, weightUnit));
  };

  return (
    <Input
      type="number"
      inputMode="decimal"
      step="any"
      placeholder={unitLabel}
      value={text}
      onFocus={() => { focusedRef.current = true; }}
      onBlur={() => {
        focusedRef.current = false;
        // Re-normalize from canonical kg value on blur.
        const d = toDisplayWeight(weightKg, weightUnit);
        setText(d !== null ? String(d) : '');
      }}
      onChange={handleChange}
      className={inputClass}
    />
  );
}

export default function DynamicSetInputs({ set, setType, weightUnit, onUpdate }: Props) {
  const unitLabel = weightUnitLabel(weightUnit);

  const weightField = (
    <WeightInput
      weightKg={set.weightKg ?? null}
      weightUnit={weightUnit}
      onChangeKg={kg => onUpdate('weightKg', kg)}
    />
  );

  switch (setType) {
    case 'WEIGHT_REPS':
      return (
        <>
          <div>{weightField}</div>
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
          <div>{weightField}</div>
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
          <div>{weightField}</div>
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
