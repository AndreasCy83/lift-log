/**
 * Exercise media mapping layer.
 *
 * Architecture:
 *   exercise (matched by canonical seedData name)
 *     -> reference ID (from final_list.xlsx, "Table id (gif ref)" column)
 *        NOTE: the reference ID is a 4-character TEXT code. Leading zeros are
 *        significant ("0041", "0151", "0597") and must never be stripped or
 *        coerced to a number.
 *     -> deterministic media paths:
 *          /exercise-pics/{refId}.jpg
 *          /exercise-gifs/{refId}.gif
 *
 * Only exercises present in EXERCISE_MEDIA_MAP have media. All lookups are
 * exact (case-insensitive on the exercise name) — no fuzzy matching at runtime.
 */

import { EXERCISE_MEDIA_MAP } from '@/data/exerciseMediaMap';

/** Lowercased index built once for O(1) exact lookups. */
const LOWER_INDEX: Record<string, string> = (() => {
  const idx: Record<string, string> = {};
  for (const [name, id] of Object.entries(EXERCISE_MEDIA_MAP)) {
    idx[name.trim().toLowerCase()] = id;
  }
  return idx;
})();

/**
 * Normalize a reference code to the canonical 4-character text form.
 * Accepts already-padded codes ("0597") and pads short ones ("597" -> "0597").
 */
export function padRefId(refId: string): string {
  return String(refId).trim().padStart(4, '0');
}

/** Case-insensitive exact lookup on the canonical exercise name. */
function lookupRefId(exerciseName: string): string | null {
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
