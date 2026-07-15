import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  computeGroupLabels,
  planCreateGroup,
  planRemoveFromGroup,
  computeSupersetNextTarget,
  isRoundComplete,
  getGroupType,
} from './supersets';
import type { WorkoutExercise, WorkoutSet } from '@/types/fitness';

vi.mock('./storage', () => ({
  generateId: () => 'gid-' + Math.random().toString(36).slice(2, 8),
}));

function we(id: string, position: number, gid?: string, order?: number): WorkoutExercise {
  return {
    id,
    workoutId: 'w1',
    exerciseId: 'ex-' + id,
    position,
    notes: '',
    supersetGroupId: gid ?? null,
    supersetOrder: order ?? null,
    groupType: gid ? 'superset' : null,
  };
}

function set(weId: string, setIndex: number, isCompleted = false): WorkoutSet {
  return {
    id: `${weId}-${setIndex}`,
    workoutExerciseId: weId,
    setIndex,
    setTag: 'N',
    weightKg: 100,
    reps: 8,
    distanceKm: null,
    durationMinutes: null,
    rpe: null,
    isWarmup: false,
    isCompleted,
    notes: '',
  };
}

describe('supersets: getGroupType', () => {
  it('2 => superset, 3+ => circuit, <2 => null', () => {
    expect(getGroupType(2)).toBe('superset');
    expect(getGroupType(3)).toBe('circuit');
    expect(getGroupType(5)).toBe('circuit');
    expect(getGroupType(1)).toBeNull();
  });
});

describe('supersets: planCreateGroup', () => {
  it('assigns fresh groupId, order, and superset type for 2 members', () => {
    const items = [we('A', 0), we('B', 1), we('C', 2)];
    const { updates, groupId } = planCreateGroup(items, ['A', 'B']);
    expect(groupId).toBeTruthy();
    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({ id: 'A', supersetGroupId: groupId, supersetOrder: 0, groupType: 'superset' });
    expect(updates[1]).toMatchObject({ id: 'B', supersetGroupId: groupId, supersetOrder: 1, groupType: 'superset' });
  });
  it('uses circuit type for 3 members', () => {
    const items = [we('A', 0), we('B', 1), we('C', 2)];
    const { updates } = planCreateGroup(items, ['A', 'B', 'C']);
    updates.forEach((u) => expect(u.groupType).toBe('circuit'));
  });
});

describe('supersets: planRemoveFromGroup', () => {
  it('dissolves group when it drops to 1 member', () => {
    const gid = 'g1';
    const items = [we('A', 0, gid, 0), we('B', 1, gid, 1), we('C', 2)];
    const updates = planRemoveFromGroup(items, 'A');
    // Both A (removed) and B (dissolved) get grouping cleared.
    const cleared = updates.filter((u) => u.supersetGroupId === null);
    expect(cleared).toHaveLength(2);
  });
  it('keeps group as superset when circuit drops to 2', () => {
    const gid = 'g1';
    const items = [we('A', 0, gid, 0), we('B', 1, gid, 1), we('C', 2, gid, 2)];
    items.forEach((i) => { i.groupType = 'circuit'; });
    const updates = planRemoveFromGroup(items, 'A');
    const removed = updates.find((u) => u.id === 'A');
    expect(removed?.supersetGroupId).toBeNull();
    const remaining = updates.filter((u) => u.id !== 'A');
    remaining.forEach((u) => expect(u.groupType).toBe('superset'));
  });
});

describe('supersets: computeGroupLabels', () => {
  it('assigns SS1/SS2/C1 in first-appearance order', () => {
    const items = [
      we('A', 0, 'g1', 0), we('B', 1, 'g1', 1),
      we('C', 2, 'g2', 0), we('D', 3, 'g2', 1), we('E', 4, 'g2', 2),
      we('F', 5, 'g3', 0), we('G', 6, 'g3', 1),
    ];
    const labels = computeGroupLabels(items);
    expect(labels.get('g1')).toBe('SS1');
    expect(labels.get('g2')).toBe('C1');
    expect(labels.get('g3')).toBe('SS2');
  });
});

describe('supersets: computeSupersetNextTarget round-by-round', () => {
  const items = [we('A', 0, 'g', 0), we('B', 1, 'g', 1)];
  const setsFor = (aCompleted: number, bCompleted: number) => ({
    A: [0, 1, 2].map((i) => set('A', i, i < aCompleted)),
    B: [0, 1, 2].map((i) => set('B', i, i < bCompleted)),
  });
  it('A1 completed -> next is B1 (same round)', () => {
    const next = computeSupersetNextTarget(items, setsFor(1, 0), 'A', 0);
    expect(next).toEqual({ workoutExerciseId: 'B', setIndex: 0 });
  });
  it('B1 completed after A1 -> next is A2 (next round)', () => {
    const next = computeSupersetNextTarget(items, setsFor(1, 1), 'B', 0);
    expect(next).toEqual({ workoutExerciseId: 'A', setIndex: 1 });
  });
  it('all done -> null', () => {
    const next = computeSupersetNextTarget(items, setsFor(3, 3), 'B', 2);
    expect(next).toBeNull();
  });
  it('skips fully-completed member and continues with the other', () => {
    const items3 = [we('A', 0, 'g', 0), we('B', 1, 'g', 1), we('C', 2, 'g', 2)];
    const sets = {
      A: [set('A', 0, true), set('A', 1, true)],
      B: [set('B', 0, true), set('B', 1, false)],
      C: [set('C', 0, true), set('C', 1, false)],
    };
    // Just completed A1 (round 1). B is fully done? no B has round 1 incomplete.
    const next = computeSupersetNextTarget(items3, sets, 'A', 1);
    expect(next).toEqual({ workoutExerciseId: 'B', setIndex: 1 });
  });
});

describe('supersets: isRoundComplete', () => {
  const items = [we('A', 0, 'g', 0), we('B', 1, 'g', 1)];
  it('false when other group member has same-round set incomplete', () => {
    const sets = { A: [set('A', 0, true)], B: [set('B', 0, false)] };
    expect(isRoundComplete(items, sets, 'A', 0)).toBe(false);
  });
  it('true when all group members done for that round', () => {
    const sets = { A: [set('A', 0, true)], B: [set('B', 0, true)] };
    expect(isRoundComplete(items, sets, 'B', 0)).toBe(true);
  });
  it('true for ungrouped exercise', () => {
    const solo = [we('S', 0)];
    const sets = { S: [set('S', 0, true)] };
    expect(isRoundComplete(solo, sets, 'S', 0)).toBe(true);
  });
});
