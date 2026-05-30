# Multi-Language Support

Add full app internationalization with a language picker in Settings. All UI strings, exercise names, and seeded program/routine names will be translatable.

## Languages (10)
English (default/fallback), French, Italian, Portuguese, Russian, Turkish, Chinese (Simplified), Hindi, Arabic, Japanese.

## Scope
Every screen: Home, Workouts, Routines, Programs, Body Tracker, Stats, Settings, all dialogs, toasts, empty states, bottom nav, splash, onboarding, tutorial overlays, changelog, privacy policy.

Built-in exercise names (Bench Press, Deadlift…) and seeded program/routine names (5 Day Split Hypertrophy, Push Day…) translated too. User-created exercises/routines stay as the user typed them.

## Approach

### Library
Use `react-i18next` + `i18next` + `i18next-browser-languagedetector`. Mature, offline-friendly (no network), tiny runtime, works perfectly with Capacitor.

### File structure
```
src/i18n/
  index.ts              ← init, language detection, persistence
  languages.ts          ← language list + native labels + RTL flag
  locales/
    en.json             ← source of truth
    fr.json  it.json  pt.json  ru.json  tr.json
    zh.json  hi.json  ar.json  ja.json
```

Each locale file is one flat JSON namespaced by area:
```json
{
  "nav": { "home": "...", "workouts": "..." },
  "settings": { "title": "...", "language": "...", ... },
  "workout": { "addSet": "...", "rest": "...", ... },
  "exercise": { "ex-bench-press": "Bench Press", ... },
  "program": { "program-builtin-5daysplit": "5 Day Split Hypertrophy", ... },
  "routine": { "Push Day": "...", ... }
}
```

### Settings integration
- Add `language: SupportedLang` to `AppSettings` in `storage.ts` (default `'en'`, falls back to device language on first launch via the detector).
- Add a "Language" card in `SettingsPage.tsx` above "Weight Unit" — a `Select` showing each language in its native script (English, Français, Italiano, Português, Русский, Türkçe, 中文, हिन्दी, العربية, 日本語).
- Selecting persists to localStorage via `saveSettings` and calls `i18n.changeLanguage(...)`.

### RTL handling
Arabic only. When `ar` is active, set `document.documentElement.dir = "rtl"`; otherwise `"ltr"`. Tailwind classes already work with logical properties for most layouts; any directional `left-*`/`right-*` that breaks will be swapped to `start-*`/`end-*` where needed.

### Exercise & program translation strategy
- Exercises: `getExerciseDisplayName(ex)` helper — returns `t('exercise.'+ex.id, { defaultValue: ex.name })`. Used everywhere instead of `ex.name` directly. Custom exercises (no translation key) fall through to stored name automatically.
- Seeded programs/routines: same pattern with `program.*` and `routine.*` namespaces, keyed by stable IDs already used in `storage.ts`.
- Storage stays English — no migration needed. Switching language re-renders display only.

### Translation source
I'll write all 10 locale files in code. English is authoritative; the other 9 are translated by me. You don't need to upload anything. After delivery you can refine any wording by editing the relevant `src/i18n/locales/*.json` file.

## Implementation steps

1. **Install** `i18next`, `react-i18next`, `i18next-browser-languagedetector`.
2. **Create `src/i18n/`** with init module, language list, and the 10 locale JSONs (full UI + exercise + program/routine keys).
3. **Wire init** in `src/main.tsx` before `<App />` renders.
4. **Extend `AppSettings`** with `language` field + migration default.
5. **Refactor all screens/components** to use `useTranslation()` + `t('...')`. Touches: BottomNav, HomePage, WorkoutLogPage, RoutinesPage, ProgramDetailPage, RoutineDetailPage, BodyTrackerPage, StatsPage (+ all stats tabs), SettingsPage, OnboardingWizard, SplashScreen, ChangelogDialog, PrivacyPolicyModal, all dialogs/sheets under `components/`, all toasts.
6. **Replace `ex.name`/program name reads** with the display helpers.
7. **Add language picker UI** to SettingsPage.
8. **Apply `dir` attribute** based on active language.
9. **QA pass** by switching each language in preview.

## Technical notes

- All translation files bundled at build time — fully offline, no runtime fetch. Bundle size impact ≈ 80–150 KB gzipped total for 10 languages of this app's surface.
- Plurals use i18next's built-in plural rules (handles ru/ar/pl-style complexity automatically).
- Date/number formatting will use `Intl.DateTimeFormat`/`Intl.NumberFormat` with the active locale where dates are user-facing.
- This is a large mechanical refactor across ~40 files. No business logic changes — kg storage, calculations, persistence, RLS-equivalent localStorage keys all untouched.
