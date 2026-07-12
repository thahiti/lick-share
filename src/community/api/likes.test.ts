import { describe, expect, it } from 'vitest';
import { appendDeduped, canonicalIds, likeTargetId, toCountMap } from './likes';

describe('likeTargetId', () => {
  it('유사릭이면 원본 id, 원본이면 자기 id (설계 §7)', () => {
    expect(likeTargetId({ id: 'a', canonical_id: null })).toBe('a');
    expect(likeTargetId({ id: 'b', canonical_id: 'a' })).toBe('a');
  });
});

describe('canonicalIds', () => {
  it('카운트 대상 = 원본 id 집합 (중복 제거)', () => {
    expect(
      canonicalIds([
        { id: 'a', canonical_id: null },
        { id: 'b', canonical_id: 'a' },
        { id: 'c', canonical_id: null },
      ]),
    ).toEqual(['a', 'c']);
  });
});

describe('toCountMap', () => {
  it('likes 행 → lick_id별 카운트', () => {
    const m = toCountMap([{ lick_id: 'a' }, { lick_id: 'a' }, { lick_id: 'c' }]);
    expect(m.get('a')).toBe(2);
    expect(m.get('c')).toBe(1);
    expect(m.get('x')).toBeUndefined();
  });
});

describe('appendDeduped', () => {
  it('랭킹 offset 스크롤: 순위 드리프트 중복 제거 (설계 §8.5)', () => {
    expect(appendDeduped([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }])).toEqual([
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ]);
  });
});
