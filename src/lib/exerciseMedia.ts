/**
 * Exercise media mapping layer.
 *
 * Architecture:
 *   exercise (matched by canonical seedData name)
 *     -> reference ID (from Exercisereference.xlsx, "Table id gif ref" column)
 *     -> zero-padded to 4 digits ("refId")
 *     -> deterministic media paths:
 *          /exercise-pics/{refId}.jpg
 *          /exercise-gifs/{refId}.gif
 *
 * Only exercises present in EXERCISE_MEDIA_MAP have media. All lookups are
 * exact (case-insensitive on the exercise name) — no fuzzy matching at runtime.
 *
 * Scaling later: extend EXERCISE_MEDIA_MAP with the remaining rows from
 * Exercisereference.xlsx (generate it offline from the sheet, then paste).
 */

import { EXERCISE_MEDIA_MAP } from '@/data/exerciseMediaMap';

/** Lowercased index built once for O(1) exact lookups. */
const LOWER_INDEX: Record<string, number> = (() => {
  const idx: Record<string, number> = {};
  for (const [name, id] of Object.entries(EXERCISE_MEDIA_MAP)) {
    idx[name.trim().toLowerCase()] = id;
  }
  return idx;
})();

/** Zero-pad a numeric reference ID to a 4-digit string ("0597"). */
export function padRefId(refId: number): string {
  return String(refId).padStart(4, '0');
}

/** Case-insensitive exact lookup on the canonical exercise name. */
function lookupRefId(exerciseName: string): number | null {
  if (!exerciseName) return null;
  return LOWER_INDEX[exerciseName.trim().toLowerCase()] ?? null;
}


export interface ExerciseMedia {
  refId: string;
  imageUrl: string;
  gifUrl: string;
}

/**
 * Return media paths for an exercise, or null if no mapping exists.
 * The caller is responsible for graceful fallback on 404s (the <img> onError
 * handler in <ExerciseThumbnail> handles this).
 */
export function getExerciseMedia(exerciseName: string): ExerciseMedia | null {
  const raw = lookupRefId(exerciseName);
  if (raw == null) return null;
  const refId = padRefId(raw);
  return {
    refId,
    imageUrl: `/exercise-pics/${refId}.jpg`,
    gifUrl: `/exercise-gifs/${refId}.gif`,
  };
}
