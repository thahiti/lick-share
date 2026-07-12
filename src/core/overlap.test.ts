import { describe, expect, test } from 'vitest';
import { asMidi, asStep, type Note } from './types';
import { resolveOverlap } from './overlap';

const note = (id: number, s: number, d: number, p = 64): Note => ({
  id,
  s: asStep(s),
  d,
  p: asMidi(p),
});

describe('resolveOverlap (SPEC §5.1)', () => {
  test('[0,4) 존재 + [2,6) 추가 → 앞 노트 d=2로 잘림', () => {
    const existing = note(1, 0, 4);
    const added = note(2, 2, 4);
    const result = resolveOverlap([existing, added], added);
    expect(result).toHaveLength(2);
    expect(result.find((n) => n.id === 1)?.d).toBe(2);
    expect(result.find((n) => n.id === 2)?.d).toBe(4);
  });

  test('완전히 덮이는 노트는 제거', () => {
    const covered = note(1, 4, 2);
    const added = note(2, 2, 6); // [2,8) — [4,6)을 완전 포함
    const result = resolveOverlap([covered, added], added);
    expect(result.map((n) => n.id)).toEqual([2]);
  });

  test('자른 결과 d<1이면 제거', () => {
    const front = note(1, 2, 2); // [2,4)
    const added = note(2, 2, 4); // 시작이 같음 → 앞 걸침 아님 → 제거 대상
    const result = resolveOverlap([front, added], added);
    expect(result.map((n) => n.id)).toEqual([2]);
  });

  test('겹치지 않는 노트는 유지', () => {
    const before = note(1, 0, 2); // [0,2)
    const after = note(3, 6, 2); // [6,8)
    const added = note(2, 2, 4); // [2,6)
    const result = resolveOverlap([before, after, added], added);
    expect(result.map((n) => n.id).sort()).toEqual([1, 2, 3]);
  });

  test('경계 접촉(ne===s, ns===e)은 겹침 아님', () => {
    const left = note(1, 0, 4); // [0,4)
    const right = note(3, 8, 4); // [8,12)
    const added = note(2, 4, 4); // [4,8)
    const result = resolveOverlap([left, right, added], added);
    expect(result).toHaveLength(3);
    expect(result.find((n) => n.id === 1)?.d).toBe(4);
  });

  test('원본 배열을 변경하지 않음 (순수 함수)', () => {
    const existing = note(1, 0, 4);
    const added = note(2, 2, 4);
    const input = [existing, added];
    resolveOverlap(input, added);
    expect(existing.d).toBe(4);
    expect(input).toHaveLength(2);
  });
});
