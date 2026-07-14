import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchFeedPage } from './licks';

// 체이닝 질의 빌더 mock — 메서드 호출을 기록하고 await 시 빈 결과를 돌려준다
const calls: Array<[string, unknown[]]> = [];

vi.mock('../supabase', () => {
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'order', 'limit', 'lt', 'eq', 'contains', 'or']) {
    builder[m] = (...args: unknown[]) => {
      calls.push([m, args]);
      return builder;
    };
  }
  builder['then'] = (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
  return {
    supabase: {
      from: (table: string) => {
        calls.push(['from', [table]]);
        return builder;
      },
    },
  };
});

beforeEach(() => {
  calls.length = 0;
});

describe('fetchFeedPage 필터', () => {
  it('필터 없으면 lt/eq/contains를 걸지 않는다', async () => {
    await fetchFeedPage(null);
    const names = calls.map(([m]) => m);
    expect(names).not.toContain('lt');
    expect(names).not.toContain('eq');
    expect(names).not.toContain('contains');
  });

  it('cursor는 created_at lt로 전달', async () => {
    await fetchFeedPage('2026-07-01');
    expect(calls).toContainEqual(['lt', ['created_at', '2026-07-01']]);
  });

  it('authorId 필터는 author_id eq로 전달', async () => {
    await fetchFeedPage(null, { authorId: 'u1' });
    expect(calls).toContainEqual(['eq', ['author_id', 'u1']]);
  });

  it('tag 필터는 tags contains로 전달 (tags @> {tag})', async () => {
    await fetchFeedPage(null, { tag: 'bebop' });
    expect(calls).toContainEqual(['contains', ['tags', ['bebop']]]);
  });
});
