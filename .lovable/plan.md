# Muscle Map — Investigation Result & Plan

## Verdict

**Use `react-muscle-highlighter` (v1.2.0).** Reject a custom SVG for now; keep `@mjcdev/react-body-highlighter` as fallback only.

### What I verified from the npm registry / package tarballs
- `react-muscle-highlighter@1.2.0`: **zero runtime dependencies**, peer deps `react ^18 || ^19` (project is React 18.3.1 — compatible), ships ESM + CJS + `dist/types/index.d.ts` with proper `exports` map. Pure inline-SVG rendering, no react-native, no canvas, no DOM/native APIs.
- Its API: `<Body data={[{slug, intensity|color, side, styles}]} side="front"|"back" gender scale border defaultFill defaultStroke defaultStrokeWidth hiddenParts disabledParts onBodyPartPress />`.
- Slug set: `chest, abs, obliques, biceps, triceps, forearm, deltoids, trapezius, upper-back, lower-back, quadriceps, hamstring, calves, gluteal, adductors, tibialis, knees, ankles, feet, hands, neck, head, hair`.
- `@mjcdev/react-body-highlighter@0.0.4`: same slug set and same origin, but pulls in **`ramda`** as a runtime dep, has **no per-part `color`/`styles`/`defaultFill`/`hiddenParts`** props, and only `intensity` + a global `colors` array. Less customizable, extra bundle weight, v0.0.x.

### Why this answers each question
- **Can Lovable install/use it?** Yes — plain npm ESM React package, no postinstall, no native module.
- **Front + back views?** Yes, `side="front" | "back"` from the same component.
- **Grouping into the 7 FitLogX categories without editing library source?** Yes — group mapping lives entirely in our own file; we pass an expanded slug list per group.
- **Dark-UI styling?** Yes — `defaultFill`, `defaultStroke`, `defaultStrokeWidth`, `border`, plus per-part `color`/`styles`. We drive colors from the existing `getCategoryColor()` map, so themes stay consistent.
- **Custom SVG?** Not preferable now: high authoring cost, no benefit over an already-typed, dependency-free SVG library. Reasonable later if we ever need paths that don't exist upstream.

## Grouping design (no new tracked categories)

One new pure mapping module — 7 FitLogX categories → library slugs:

```text
cat-chest      -> chest
cat-back       -> trapezius, upper-back, lower-back
cat-shoulders  -> deltoids
cat-biceps     -> biceps
cat-triceps    -> triceps
cat-legs       -> quadriceps, hamstring, calves, gluteal, adductors
cat-abs        -> abs, obliques
```

Notes:
- The library has **no `lats` slug** — lats are visually covered by `upper-back`, which is why lats/traps/upper/lower all fold into `cat-back`. Acceptable and invisible to users.
- `cat-core` (existing internal category) maps to the same slugs as `cat-abs`; `cat-olympic` / `cat-cardio` map to nothing (not rendered).
- Every slug in a group gets the **same color/intensity**, so a group always highlights as one unit.
- Unused slugs (`head`, `hair`, `hands`, `feet`, `knees`, `ankles`, `tibialis`, `forearm`, `neck`) get the neutral default fill.

## Component design

New `src/components/MuscleMap.tsx` — presentational only, no data fetching:

```ts
interface MuscleMapProps {
  values: Record<string, number>;   // categoryId -> 0..1 (or status-derived)
  colorFor?: (categoryId: string) => string;  // default: getCategoryColor
  side?: 'front' | 'back' | 'both'; // 'both' renders the pair side by side
  scale?: number;
}
```
- Internally expands `values` through the group map into the library's `data` array, one entry per slug with `color`.
- Renders front and back as two flex children so a phone width fits both; falls back to a small front/back toggle if we prefer at build time.
- Because it takes a generic `categoryId -> value` map, **Recovery reuse is a one-line call** with fatigue values instead of stimulus values — no changes to the component.

## Wiring into Estimated Stimulus (visual only)

- `src/components/VolumeInsightsCard.tsx`: render `<MuscleMap />` **only in the expanded state**, above the existing muscle rows. Collapsed card stays byte-for-byte as today.
- Values come from the already-computed `summary.weeklyByCategory` (`weeklySets` normalized against the existing `BAR_MAX = 20`, or mapped from `status`). **No change to `src/lib/volumeInsights.ts`.**
- The current expand block uses a fixed `maxHeight` calculation — it will need to account for the map's height, which is the only layout change required.

## Files affected

| File | Change |
| --- | --- |
| `package.json` | add `react-muscle-highlighter` |
| `src/lib/muscleMapGroups.ts` *(new)* | category → slug map + value expansion helper |
| `src/components/MuscleMap.tsx` *(new)* | reusable front/back map wrapper |
| `src/components/VolumeInsightsCard.tsx` | render map in expanded state; adjust expand max-height |

Untouched: Recovery, stimulus logic, Home layout, category colors.

## Risks & caveats

- **Maintenance risk:** young single-maintainer package (v1.2.0, MIT). Mitigation: it's dependency-free SVG — if it's ever abandoned we can vendor the `dist/assets/*` path data into the repo with no API change on our side.
- **Sizing:** the library exposes `scale`, not width/height. Needs a wrapper with a fixed-height container + `overflow-hidden` to be predictable on 360px-wide Android screens.
- **Capacitor/Android:** no risk — inline SVG in the WebView, no native bridge, no network.
- **Bundle size:** the tarball carries male + female front/back path data (~360KB unpacked, mostly source maps). Real JS impact is the path strings; acceptable, and tree-shaking via the ESM build helps.
- **Theming:** must read colors from `getCategoryColor()` / CSS tokens rather than hardcoding, so custom themes and AMOLED keep working.
- **React version:** peer allows 18 — no `--legacy-peer-deps` needed.
