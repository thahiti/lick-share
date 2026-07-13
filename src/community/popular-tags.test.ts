import { describe, expect, it } from 'vitest';
import { topTags } from './popular-tags';

describe('topTags 인기 태그 집계', () => {
  it('빈도 내림차순으로 상위 N개를 반환한다', () => {
    const rows = [
      { tags: ['jazz', 'bebop'] },
      { tags: ['jazz', 'ballad'] },
      { tags: ['jazz'] },
      { tags: ['bebop'] },
    ];
    expect(topTags(rows, 2)).toEqual(['jazz', 'bebop']);
  });

  it('동률은 첫 등장 순으로 정렬한다', () => {
    const rows = [{ tags: ['a', 'b'] }, { tags: ['b', 'a'] }];
    // a·b 모두 2회 → 먼저 등장한 a가 앞
    expect(topTags(rows, 5)).toEqual(['a', 'b']);
  });

  it('tags 필드가 없는 행(컬럼 미적용)을 방어적으로 건너뛴다', () => {
    const rows = [{ tags: ['jazz'] }, {}, { tags: undefined }, { title: 'x' }];
    expect(topTags(rows, 5)).toEqual(['jazz']);
  });

  it('태그가 하나도 없으면 빈 배열을 반환한다', () => {
    expect(topTags([{}, { tags: [] }], 5)).toEqual([]);
  });

  it('limit을 초과하지 않는다', () => {
    const rows = [{ tags: ['a', 'b', 'c', 'd'] }];
    expect(topTags(rows, 3)).toHaveLength(3);
  });
});
