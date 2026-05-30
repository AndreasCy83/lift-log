## Goal
Localize all user-facing strings on the Home screen using the existing `react-i18next` setup. No dependency changes, no other screens touched.

## Scope (files)
- `src/pages/HomePage.tsx` — main Home screen
- `src/components/RecoveryFatigueCard.tsx` — embedded on Home
- `src/i18n/locales/*.json` (all 10) — extend `home` namespace

## Strings to translate on Home
Header: `Fit Log X` (brand — keep as-is), `Start Workout`
Calendar: weekday short labels (Mon–Sun), `Show 3 weeks`, `Show full month`, month range separator
Selected day card: `Today`, `No workout logged`, `View Workout →`, `Copy Workout`, `Move this Workout`, `exercise/exercises` (pluralized), `Duration:`, `Vol:`, `Reps:`, `Sets:`, `Dist:`, `Time:`
Muscle Group Breakdown: `Muscle Group Breakdown` + category names already come from seed data (NOT translated per seed rule)
Delete dialog: `Delete Workout`, description, `Yes`, `No`
Copy dialog: `Copy Workout`, `Select a date to copy this workout to.`, `Copy to {{date}}`
Move dialog: `Move Workout`, `Select a date to move this workout to.`, `Move to {{date}}`
RecoveryFatigueCard: card title + band labels (`Low`, `Moderate`, `High`, `Very High` short forms) + `Ready` label — only translate the visible chrome shown in the card header/legend, keep computed muscle names as-is (seeded).

## Key structure (added under existing `home.*`)
```
home: {
  brand, startWorkout, today, noWorkoutLogged, viewWorkout,
  showThreeWeeks, showFullMonth,
  exercise_one, exercise_other,
  duration, vol, reps, sets, dist, time,
  muscleGroupBreakdown,
  weekdays: { mon, tue, wed, thu, fri, sat, sun },
  actions: { copyWorkout, moveWorkout },
  delete: { title, description, yes, no },
  copy: { title, description, cta },
  move: { title, description, cta },
  recovery: { title, ready, bandLow, bandModerate, bandHigh, bandVeryHigh }
}
```
Uses i18next plural suffix (`_one`/`_other`) for the exercise count.

## Implementation
1. Extend `home` namespace in `en.json` with all keys above.
2. Add translated equivalents in the other 9 locale files (fr, it, pt, ru, tr, zh, hi, ar, ja). Brand name kept in Latin. Arabic strings stay logical-order; RTL already wired globally.
3. In `HomePage.tsx`: add `const { t } = useTranslation();`, replace every literal string above. Pluralize via `t('home.exercise', { count })`. Interpolate dates via `t('home.copy.cta', { date: format(...) })`.
4. Replace `WEEKDAYS` constant with a `useMemo` that reads from `t`.
5. In `RecoveryFatigueCard.tsx`: thread `useTranslation` and translate header + band pills + `Ready` label only. Muscle names stay as computed (seed-derived).
6. No styling changes beyond letting flex items truncate (already in place) — verify in Arabic and Russian (long words).

## Out of scope
- Routines / Programs / Workout / Body / Stats screens
- Seed/exercise/category/program/routine names
- i18n dependency versions or init code
- Any business logic, storage, navigation

## QA checklist
- Switch language in Settings → Home updates immediately
- Arabic: layout mirrors via existing `dir="rtl"` on `<html>`
- Missing keys fall back to English (already configured via `fallbackLng: 'en'`)
- Pluralization renders correctly for 0/1/many exercises
- No layout overflow in long-string locales (ru/de-style words)
