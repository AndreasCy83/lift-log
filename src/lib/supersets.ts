/**
 * Superset / circuit grouping helpers.
 *
 * Grouping is metadata only. It does NOT change how sets, history, PRs,
 * stats, volume, recovery, or Coach logic operate — those all continue to
 * consume individual completed sets exactly as before.
 *
 * A group is:
 *   - superset when 2 exercises share a supersetGroupId
 *   - circuit  when 3+ exercises share a supersetGroupId
 *
 * Group members are ordered by supersetOrder (fallback: position).
 */

import type {
  RoutineExercise,
  WorkoutExercise,
  WorkoutSet,
  SupersetGroupType,
} from '@/types/fitness';
import { generateId } from './storage';

export type GroupableItem = RoutineExercise | WorkoutExercise;

export function getGroupType(size: number): SupersetGroupType | null {
  if (size >= 3) return 'circuit';
  if (size === 2) return 'superset';
  return null;
}

/** Return group members sorted by supersetOrder then by position. */
export function groupMembers<T extends GroupableItem>(items: T[], groupId: string | null | undefined): T[] {
  if (!groupId) return [];
  return items
    .filter((x) => x.supersetGroupId === groupId)
    .sort((a, b) => {
      const ao = a.supersetOrder ?? a.position;
      const bo = b.supersetOrder ?? b.position;
      return ao - bo;
    });
}

/**
 * Compute label per group ("SS1", "SS2", "C1", ...) using first-appearance
 * order in the linear list.
 */
export function computeGroupLabels<T extends GroupableItem>(items: T[]): Map<string, string> {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const labels = new Map<string, string>();
  let ss = 0;
  let c = 0;
  const seen = new Set<string>();
  for (const it of sorted) {
    const gid = it.supersetGroupId;
    if (!gid || seen.has(gid)) continue;
    seen.add(gid);
    const size = items.filter((x) => x.supersetGroupId === gid).length;
    if (size >= 3) {
      c += 1;
      labels.set(gid, `C${c}`);
    } else if (size === 2) {
      ss += 1;
      labels.set(gid, `SS${ss}`);
    }
  }
  return labels;
}

export interface GroupPosition {
  index: number;          // 0..n-1 within group
  isFirst: boolean;
  isLast: boolean;
  size: number;
  label: string;
  type: SupersetGroupType;
}

/** Return position info for a single item within its group, or null when ungrouped/invalid. */
export function getGroupPosition<T extends GroupableItem>(items: T[], item: T): GroupPosition | null {
  const gid = item.supersetGroupId;
  if (!gid) return null;
  const members = groupMembers(items, gid);
  if (members.length < 2) return null;
  const idx = members.findIndex((m) => m.id === item.id);
  if (idx < 0) return null;
  const labels = computeGroupLabels(items);
  const type = getGroupType(members.length);
  if (!type) return null;
  return {
    index: idx,
    isFirst: idx === 0,
    isLast: idx === members.length - 1,
    size: members.length,
    label: labels.get(gid) ?? (type === 'circuit' ? 'C?' : 'SS?'),
    type,
  };
}

/**
 * Snap-order helper: given a linear list and a target groupId, return the
 * list rewritten so all group members are contiguous, in supersetOrder,
 * inserted at the position of the first current member.
 */
export function contiguousOrderedIds<T extends GroupableItem>(items: T[], groupId: string): string[] {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const memberIds = new Set(sorted.filter((x) => x.supersetGroupId === groupId).map((x) => x.id));
  if (memberIds.size < 2) return sorted.map((x) => x.id);
  const orderedMembers = groupMembers(sorted, groupId).map((x) => x.id);
  const result: string[] = [];
  let inserted = false;
  for (const it of sorted) {
    if (memberIds.has(it.id)) {
      if (!inserted) {
        result.push(...orderedMembers);
        inserted = true;
      }
      continue;
    }
    result.push(it.id);
  }
  return result;
}

/**
 * Build a plan for creating (or updating) a group so that:
 *   - memberIds share a fresh (or existing) supersetGroupId
 *   - each member has supersetOrder 0..n-1 (in the memberIds order given)
 *   - each member has groupType inferred from size
 *   - other items are unchanged
 * Callers should also call contiguousOrderedIds() and reorder positions
 * so grouped rows are adjacent in the list.
 */
export function planCreateGroup<T extends GroupableItem>(
  items: T[],
  memberIds: string[],
  opts: { groupId?: string; restMode?: 'afterRound' | 'perExercise' } = {},
): { updates: T[]; groupId: string | null } {
  const cleanIds = memberIds.filter((id) => items.some((x) => x.id === id));
  if (cleanIds.length < 2) return { updates: [], groupId: null };
  const groupId = opts.groupId ?? generateId();
  const type = getGroupType(cleanIds.length);
  const restMode = opts.restMode ?? 'afterRound';
  const updates: T[] = [];
  cleanIds.forEach((id, i) => {
    const orig = items.find((x) => x.id === id);
    if (!orig) return;
    updates.push({
      ...orig,
      supersetGroupId: groupId,
      supersetOrder: i,
      groupType: type,
      restMode,
    });
  });
  return { updates, groupId };
}

/**
 * Build a plan for removing one member from a group. If the group drops
 * below 2, dissolve it (all remaining members cleared). Returns updates
 * for members whose grouping fields must change.
 */
export function planRemoveFromGroup<T extends GroupableItem>(items: T[], itemId: string): T[] {
  const target = items.find((x) => x.id === itemId);
  const gid = target?.supersetGroupId ?? null;
  if (!target || !gid) return [];
  const members = groupMembers(items, gid);
  const remaining = members.filter((m) => m.id !== itemId);
  const updates: T[] = [];
  // Always clear the removed member's grouping fields.
  updates.push({
    ...target,
    supersetGroupId: null,
    supersetOrder: null,
    groupType: null,
    restMode: null,
  });
  if (remaining.length < 2) {
    // Dissolve — clear grouping on any remaining members too.
    for (const m of remaining) {
      updates.push({
        ...m,
        supersetGroupId: null,
        supersetOrder: null,
        groupType: null,
        restMode: null,
      });
    }
  } else {
    // Re-index order + refresh group type.
    const newType = getGroupType(remaining.length);
    remaining
      .sort((a, b) => (a.supersetOrder ?? 0) - (b.supersetOrder ?? 0))
      .forEach((m, i) => {
        updates.push({ ...m, supersetOrder: i, groupType: newType });
      });
  }
  return updates;
}

/* ------------------------- workout progression ------------------------- */

export interface ProgressionSetsByWE {
  [workoutExerciseId: string]: WorkoutSet[];
}

/**
 * Compute the next target inside a superset given a set that was just
 * completed on `weId`. Rules:
 *   - move to the next member of the group whose current-round set exists
 *     and is still incomplete
 *   - if end of the group is reached, wrap around to the first member with
 *     an incomplete set (next round)
 *   - completed sets are skipped
 *   - members with no more sets are skipped
 *   - returns null when nothing incomplete remains in the group
 */
export function computeSupersetNextTarget(
  items: WorkoutExercise[],
  setsByWE: ProgressionSetsByWE,
  justCompletedWeId: string,
  justCompletedSetIndex: number,
): { workoutExerciseId: string; setIndex: number } | null {
  const current = items.find((x) => x.id === justCompletedWeId);
  if (!current?.supersetGroupId) return null;
  const members = groupMembers(items, current.supersetGroupId);
  if (members.length < 2) return null;

  const idxInGroup = members.findIndex((m) => m.id === justCompletedWeId);
  if (idxInGroup < 0) return null;

  const memberCount = members.length;
  // Try same round (indices > justCompletedSetIndex are next round;
  // indices = justCompletedSetIndex on later group members = same round).
  // We loop through group members starting from idxInGroup+1 and cycle,
  // preferring same-round sets, then next-round.
  const rounds = [justCompletedSetIndex, justCompletedSetIndex + 1];
  for (const round of rounds) {
    for (let step = 1; step <= memberCount; step += 1) {
      const m = members[(idxInGroup + step) % memberCount];
      const sets = (setsByWE[m.id] ?? []).slice().sort((a, b) => a.setIndex - b.setIndex);
      const candidate = sets.find(
        (s) => s.setIndex === round && !s.isCompleted && !s.isWarmup && s.setTag !== 'W',
      );
      if (candidate) {
        return { workoutExerciseId: m.id, setIndex: candidate.setIndex };
      }
    }
  }
  // Fallback: any remaining incomplete working set anywhere in the group.
  for (let step = 1; step <= memberCount; step += 1) {
    const m = members[(idxInGroup + step) % memberCount];
    const sets = (setsByWE[m.id] ?? []).slice().sort((a, b) => a.setIndex - b.setIndex);
    const candidate = sets.find(
      (s) => !s.isCompleted && !s.isWarmup && s.setTag !== 'W',
    );
    if (candidate) return { workoutExerciseId: m.id, setIndex: candidate.setIndex };
  }
  return null;
}

/**
 * True when the just-completed set is the LAST working set of the current
 * round across the group (i.e. every member of the group has an equal-or-
 * further-along completed working set at this round index). Used to gate
 * the default 'afterRound' rest timer behavior.
 *
 * Ungrouped exercises always return true.
 */
export function isRoundComplete(
  items: WorkoutExercise[],
  setsByWE: ProgressionSetsByWE,
  weId: string,
  setIndex: number,
): boolean {
  const current = items.find((x) => x.id === weId);
  if (!current?.supersetGroupId) return true;
  const restMode = current.restMode ?? 'afterRound';
  if (restMode === 'perExercise') return true;
  const members = groupMembers(items, current.supersetGroupId);
  if (members.length < 2) return true;
  for (const m of members) {
    if (m.id === weId) continue;
    const sets = setsByWE[m.id] ?? [];
    const s = sets.find(
      (x) => x.setIndex === setIndex && !x.isWarmup && x.setTag !== 'W',
    );
    // If a member has no set at this round index, treat as complete for that member.
    if (!s) continue;
    if (!s.isCompleted) return false;
  }
  return true;
}

/* --------------------------- smart advance setting -------------------------- */

const SMART_ADVANCE_KEY = 'gym-smart-superset-advance';

export function getSmartSupersetAdvance(): boolean {
  try {
    const raw = localStorage.getItem(SMART_ADVANCE_KEY);
    if (raw == null) return true;
    return raw === 'true';
  } catch {
    return true;
  }
}
export function setSmartSupersetAdvance(v: boolean) {
  try { localStorage.setItem(SMART_ADVANCE_KEY, String(v)); } catch { /* ignore */ }
}
