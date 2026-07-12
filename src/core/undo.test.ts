import { describe, expect, test } from 'vitest';
import { demoSong } from './demo-song';
import { emptyUndo, pushUndo, redoStep, undoStep } from './undo';
import type { Song } from './types';

const version = (tempo: number): Song => ({ ...demoSong, tempo });

describe('undo 스택 (SPEC §8: 스냅샷 최대 60)', () => {
  test('push 후 undo → 스냅샷 복원, 현재 상태는 redo로', () => {
    const stack = pushUndo(emptyUndo, version(100));
    const r = undoStep(stack, version(110));
    if (!r) throw new Error('undo 실패');
    expect(r.song.tempo).toBe(100);
    const back = redoStep(r.stack, r.song);
    expect(back?.song.tempo).toBe(110);
  });

  test('빈 스택에서 undo/redo → null', () => {
    expect(undoStep(emptyUndo, demoSong)).toBeNull();
    expect(redoStep(emptyUndo, demoSong)).toBeNull();
  });

  test('push는 redo 스택을 비운다', () => {
    const stack = pushUndo(emptyUndo, version(100));
    const r = undoStep(stack, version(110));
    if (!r) throw new Error('undo 실패');
    expect(r.stack.future).toHaveLength(1);
    const afterPush = pushUndo(r.stack, version(120));
    expect(afterPush.future).toHaveLength(0);
  });

  test('60개 초과 시 가장 오래된 스냅샷 폐기', () => {
    let stack = emptyUndo;
    for (let i = 0; i < 65; i++) stack = pushUndo(stack, version(40 + i));
    expect(stack.past).toHaveLength(60);
    expect(stack.past[0]?.tempo).toBe(40 + 5); // 앞 5개 폐기
  });

  test('undo×n → 최초 스냅샷까지 복원', () => {
    let stack = emptyUndo;
    for (let i = 0; i < 5; i++) stack = pushUndo(stack, version(100 + i));
    let cur = version(105);
    for (let i = 0; i < 5; i++) {
      const r = undoStep(stack, cur);
      if (!r) throw new Error('undo 실패');
      stack = r.stack;
      cur = r.song;
    }
    expect(cur.tempo).toBe(100);
    expect(undoStep(stack, cur)).toBeNull();
  });
});
