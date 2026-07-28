# Superset Support — Routines + Live Workouts

## Model
Group exercises by a shared `supersetGroupId`. 2 = superset, 3+ = circuit. Grouping is metadata only — sets, history, stats, PRs, Coach logic remain unchanged.

## Data model changes

**`src/types/fitness.ts`**
Add to `RoutineExercise` and `WorkoutExercise`:
- `supersetGroupId?: string | null`
- `supersetLabel?: string | null`   (e.g. `SS1`, `C1`, auto-derived)
- `supersetOrder?: number | null`   (position inside group)
- `groupType?: 'superset' | 'circuit' | null`
- `restMode?: 'afterRound' | 'perExercise' | null`

Existing `RoutineExercise.supersetGroup` (already present, unused) will be reused as `supersetGroupId` — rename via alias to avoid churn.

Migration: absent fields → treated as ungrouped. Idempotent.

## Storage (`src/lib/storage.ts`)
- Persist new fields transparently (existing spread-based writes already carry unknown keys — verify and adjust).
- Add helpers:
  - `groupExercisesIntoSuperset(ids: string[], parent: 'routine'|'workout')`
  - `addExerciseToSuperset(exerciseRowId, groupId)`
  - `removeExerciseFromSuperset(exerciseRowId)` — auto-dissolves if group drops below 2, recomputes `groupType`.
  - `relabelGroups(parentId)` — assigns SS1/SS2/C1 by first-appearance order.

## Routine runner (`src/lib/routineRunner.ts`)
When creating a workout from a routine (`createWorkoutFromRoutine` + `appendRoutineToWorkout`):
1. Copy `supersetGroupId/supersetOrder/groupType/restMode` from `RoutineExercise` → `WorkoutExercise`. Generate fresh group IDs per workout to avoid cross-referencing routine ids.
2. Preserve linear `position` order — grouped items are already adjacent because routine builder keeps them adjacent.
3. Populate sets exactly as today (predefined / copy_previous / blank).
4. Run `applyPendingOverrideOnCreate` last, unchanged — Coach override still runs per-exercise, does not touch grouping fields.

## Routine builder (`src/pages/RoutineDetailPage.tsx`)
- Multi-select mode: long-press or "Select" toggle → checkboxes → "Create superset" action.
- Per-row overflow menu: `Create superset with…`, `Add to superset`, `Remove from superset`, `Reorder within group`.
- On group create: assign new `supersetGroupId`, order 0..n, groupType by count, snap grouped rows adjacent in `position` order.
- Visual: shared left rail (2px accent), compact `SS1`/`C1` chip on first row.

## Live workout UI (`src/pages/WorkoutLogPage.tsx`)
- Same grouping controls as routine builder.
- Round-by-round progression:
  - On set completion in grouped exercise, compute next target = next exercise in group with an incomplete set at current round; wrap to first exercise, next round.
  - Setting `smartSupersetAdvance` (localStorage flag, default ON) controls auto-scroll/focus vs. highlight-only.
- Rest timer: default `afterRound` — suppress per-set rest start inside a group until the round completes; then start rest using the last completed set's rest.

## Coach precedence (unchanged behavior, verified)
`applyPendingOverrideOnCreate` continues to:
- match by `exerciseId`
- overwrite working sets only (skip `setTag === 'W'`, skip `isCompleted`)
- not modify `supersetGroupId` / `supersetOrder` / `groupType` on the WorkoutExercise
- preserve per-set rep pattern logic already in `coachApply.ts`

No changes needed to Coach files. Add a test asserting grouping fields survive Coach apply.

## UI components
- `src/components/SupersetGroupRail.tsx` — visual rail + label chip. Reused in routine detail and workout log.
- Extend `RoutineExerciseSetupSheet` only if group membership editing is exposed there (kept out for MVP; managed at list level).

## Tests
- `src/lib/routineRunner.superset.test.ts` — routine with SS preserves grouping in created workout.
- `src/lib/coachApply.superset.test.ts` — Coach apply keeps grouping fields and warm-up rows intact.
- `src/lib/workoutProgression.superset.test.ts` — round-by-round next-target logic (A1→B1→A2→B2; unequal set counts; completed sets skipped).
- `src/lib/routineRunner.sameDayRebuild.test.ts` — rebuilding same-day workout preserves both grouping and Coach override.

## Execution model summary
- Rounds are computed from `setIndex` position within each grouped exercise's incomplete sets (not from raw indices), so unequal set counts degrade gracefully.
- Once a grouped exercise runs out of remaining sets, it's skipped; remaining group members continue round-by-round until all done.
- Grouping is purely a UI/navigation/rest concern; storage, stats, PRs, recovery, and Coach see only individual completed sets — identical semantics to today.

## Coach precedence model
1. Routine-run populates sets (predefined / copy_previous / blank).
2. Grouping fields copied from routine → workout.
3. `applyPendingOverrideOnCreate` runs last per exercise, overwriting non-warmup, non-completed working sets only. Grouping fields are never touched.
4. Same-day rebuild deletes and recreates the workout via the same path → both Coach override and grouping reappear deterministically.

## Files to change
- `src/types/fitness.ts`
- `src/lib/storage.ts` (helpers + persistence check)
- `src/lib/routineRunner.ts` (copy grouping fields, fresh group ids)
- `src/lib/supersetProgression.ts` (new — pure logic)
- `src/pages/RoutineDetailPage.tsx` (group controls + visual rail)
- `src/pages/WorkoutLogPage.tsx` (group controls + smart advance + rest suppression)
- `src/components/SupersetGroupRail.tsx` (new)
- `src/hooks/useWorkoutSession.ts` (integrate progression + rest gating)
- Tests as listed above.

No changes to `coachApply.ts`, stats, recovery, PR, or backup code.
