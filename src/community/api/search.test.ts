import { beforeEach, describe, expect, it, vi } from 'vitest';
import { escapeLike, licksOrFilter, parseQuery, searchLicks, searchUsers } from './search';

// licks.test.ts와 동일한 체이닝 빌더 mock
const calls: Array<[string, unknown[]]> = [];

vi.mock('../supabase', () => {
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'order', 'limit', 'lt', 'ilike', 'contains', 'or']) {
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

describe('escapeLike', () => {
  it('ilike 와일드카드(%·_)와 백슬래시를 이스케이프', () => {
    expect(escapeLike('50%_x')).toBe('50\\%\\_x');
    expect(escapeLike('a\\b')).toBe('a\\\\b');
    expect(escapeLike('plain')).toBe('plain');
  });
});

describe('parseQuery', () => {
  it('# 접두는 태그 전용 검색으로 해석하고 #를 뗀다', () => {
    expect(parseQuery('#bebop')).toEqual({ text: 'bebop', tagOnly: true });
    expect(parseQuery('blues')).toEqual({ text: 'blues', tagOnly: false });
  });

  it('앞뒤 공백은 무시한다', () => {
    expect(parseQuery('  blues ')).toEqual({ text: 'blues', tagOnly: false });
    expect(parseQuery(' #ii-v-i ')).toEqual({ text: 'ii-v-i', tagOnly: true });
  });
});

describe('licksOrFilter', () => {
  it('제목 부분 매칭 OR 태그 정확 일치 필터를 만든다', () => {
    expect(licksOrFilter('blues')).toBe('title.ilike."*blues*",tags.cs.{"blues"}');
  });

  it('PostgREST 예약문자(쉼표·괄호)는 큰따옴표 안이라 그대로 안전하다', () => {
    expect(licksOrFilter('a,b(c)')).toBe('title.ilike."*a,b(c)*",tags.cs.{"a,b(c)"}');
  });

  it('큰따옴표·백슬래시는 이스케이프한다', () => {
    expect(licksOrFilter('a"b')).toBe('title.ilike."*a\\"b*",tags.cs.{"a\\"b"}');
  });
});

describe('searchLicks', () => {
  it('일반 질의는 or(제목 ilike, 태그 cs)로 검색한다', async () => {
    await searchLicks('blues', { limit: 5 });
    expect(calls).toContainEqual(['from', ['licks']]);
    expect(calls).toContainEqual(['or', ['title.ilike."*blues*",tags.cs.{"blues"}']]);
    expect(calls).toContainEqual(['limit', [5]]);
  });

  it('# 접두 질의는 태그 contains만 사용한다', async () => {
    await searchLicks('#bebop', { limit: 5 });
    expect(calls).toContainEqual(['contains', ['tags', ['bebop']]]);
    expect(calls.map(([m]) => m)).not.toContain('or');
  });

  it('cursor를 주면 created_at lt keyset 페이지네이션', async () => {
    await searchLicks('blues', { limit: 20, cursor: '2026-07-01' });
    expect(calls).toContainEqual(['lt', ['created_at', '2026-07-01']]);
  });
});

describe('searchUsers', () => {
  it('display_name 부분 매칭으로 프로필을 검색한다', async () => {
    await searchUsers('sang', 5);
    expect(calls).toContainEqual(['from', ['profiles']]);
    expect(calls).toContainEqual(['ilike', ['display_name', '%sang%']]);
    expect(calls).toContainEqual(['limit', [5]]);
  });

  it('와일드카드 입력은 이스케이프되어 전달된다', async () => {
    await searchUsers('50%', 5);
    expect(calls).toContainEqual(['ilike', ['display_name', '%50\\%%']]);
  });
});
