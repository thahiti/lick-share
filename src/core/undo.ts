/**
 * undo/redo 스냅샷 스택 (SPEC §8). Song 전체 스냅샷, 최대 60개. 순수 자료구조.
 */
import type { Song } from './types';

const MAX_SNAPSHOTS = 60;

export interface UndoStack {
  readonly past: readonly Song[];
  readonly future: readonly Song[];
}

export const emptyUndo: UndoStack = { past: [], future: [] };

/** 파괴적 조작 직전의 Song을 쌓는다. redo 스택은 비운다 */
export const pushUndo = (stack: UndoStack, snapshot: Song): UndoStack => ({
  past: [...stack.past.slice(-(MAX_SNAPSHOTS - 1)), snapshot],
  future: [],
});

export interface UndoResult {
  readonly stack: UndoStack;
  readonly song: Song;
}

/** 마지막 스냅샷으로 되돌린다. current는 redo 스택으로 */
export const undoStep = (stack: UndoStack, current: Song): UndoResult | null => {
  const song = stack.past[stack.past.length - 1];
  if (!song) return null;
  return {
    stack: { past: stack.past.slice(0, -1), future: [...stack.future, current] },
    song,
  };
};

/** undo를 되돌린다. current는 undo 스택으로 (60개 제한 없이 원복이므로 그대로 push) */
export const redoStep = (stack: UndoStack, current: Song): UndoResult | null => {
  const song = stack.future[stack.future.length - 1];
  if (!song) return null;
  return {
    stack: { past: [...stack.past, current], future: stack.future.slice(0, -1) },
    song,
  };
};
