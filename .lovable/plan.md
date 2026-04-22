

## Goal

Make routine "predefined sets" mode aware of each exercise's existing `setType`, so the routine builder shows the correct fields per row and the generated workout sets carry the right values into `WorkoutSet`. Strictly scoped to the routine flow.

## Scope (touched files only)

1. `src/types/fitness.ts` — extend `RoutineExercise` with an optional `predefinedRows` array.
2. `src/components/RoutineExerciseSetupSheet.tsx` — replace the single sets/reps/rest block with a per-row editor branched by `setType`.
3. `src/lib/routineRunner.ts` — rewrite `predefinedSet` to map per-row data into `WorkoutSet` by `setType`; fall back to legacy aggregate fields when `predefinedRows` is absent.
4. `src/pages/RoutineDetailPage.tsx` — pass the resolved `setType` into the setup sheet and seed initial `predefinedRows` from exercise defaults when a new routine exercise is added.

Nothing else changes. Workout log, stats, goals, seed data, copy_previous mode, blank mode, and the manual-add flow remain untouched.

## Data model change (minimum)

Add to `RoutineExercise`:

```ts
export interface RoutinePredefinedRow {
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  restSeconds: number | null;
}

predefinedRows?: RoutinePredefinedRow[]; // optional; legacy entries fall back to sets/repsMin/restSeconds
```

Existing `sets`, `repsMin`, `repsMax`, `restSeconds` fields stay as-is for backward compatibility with already-saved routines.

## Field mapping (per row, by exercise.setType)

| setType         | Inputs shown            | WorkoutSet fields written            |
|-----------------|-------------------------|--------------------------------------|
| WEIGHT_REPS     | KG, Reps, Rest          | weightKg, reps                       |
| REPS_DISTANCE   | Reps, KM, Rest          | reps, distanceKm                     |
| REPS_TIME       | Reps, Time (min), Rest  | reps, durationMinutes                |
| WEIGHT_TIME     | KG, Time (min), Rest    | weightKg, durationMinutes            |
| WEIGHT_ONLY     | KG, Rest (fallback)     | weightKg                             |

Irrelevant fields stay `null`.

## Setup sheet UX (predefined mode only)

```text
[ Mode selector — unchanged ]
─ Predefined sets ──────────────
 # 1   [KG] [Reps]      [Rest s]   ✕
 # 2   [KG] [Reps]      [Rest s]   ✕
 # 3   [KG] [Reps]      [Rest s]   ✕
 [ + Add set ]
```

- Field columns are chosen from `exercise.setType` resolved by the parent (passed in as a new `setType` prop).
- "Add set" duplicates the last row's values (or a blank row if none).
- "Remove" disabled when only 1 row remains.
- First-time open with no `predefinedRows`: seed from legacy aggregates — `sets` rows, each with `reps = repsMin`, `restSeconds = restSeconds`.

## Routine generation (`routineRunner.ts`)

`predefinedSet` becomes setType-aware:

- If `re.predefinedRows` exists, iterate it and write only the fields valid for the exercise's `setType`.
- Else (legacy), keep current behavior: build `re.sets` rows with `reps = re.repsMin` (preserves existing routines).
- `restSeconds` per row falls back to `re.restSeconds` then exercise default.

The runner needs `exercise.setType`, which it already loads via `allExercises.find(...)`.

## Other modes

- `copy_previous`: unchanged.
- `blank`: unchanged.

## Backward compatibility

Old saved routines have no `predefinedRows` → runner uses the existing aggregate path → identical output to today. Opening an old entry in the setup sheet seeds `predefinedRows` from the aggregates so the new editor shows them, and saving migrates that single entry forward.

## Acceptance mapping

1–4. Setup sheet renders KG+Reps / Reps+KM / Reps+Time / KG+Time per row driven by `exercise.setType`.
5. Generated `WorkoutSet`s carry the correct fields (verified in `predefinedSet`).
6–7. blank and copy_previous code paths are not touched.
8. Workout log reads `WorkoutSet` exactly as before; field names are unchanged.
9–10. No seed data edits, no new set type added.

