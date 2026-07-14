/** SearchResults — /search 결과 페이지: Users/Licks 섹션 + 빈 상태 (tag-search 설계 §3~4). */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LickRow } from '../api/licks';
import type { ProfileHit } from '../api/search';

const navigate = vi.fn<(path: string) => void>();
vi.mock('../routing', async (orig) => ({
  ...(await orig<typeof import('../routing')>()),
  navigate: (p: string) => navigate(p),
}));

const searchLicks = vi.fn<
  (q: string, opts: { limit: number; cursor?: string | null }) => Promise<LickRow[]>
>();
const searchUsers = vi.fn<(q: string, limit: number) => Promise<ProfileHit[]>>();
vi.mock('../api/search', () => ({
  searchLicks: (q: string, opts: { limit: number; cursor?: string | null }) =>
    searchLicks(q, opts),
  searchUsers: (q: string, limit: number) => searchUsers(q, limit),
}));

const fetchLikeCounts = vi.fn(async (_ids: readonly string[]) => new Map<string, number>());
vi.mock('../api/likes', () => ({
  canonicalIds: (ls: readonly { id: string; canonical_id: string | null }[]): string[] => [
    ...new Set(ls.map((l) => l.canonical_id ?? l.id)),
  ],
  likeTargetId: (l: { id: string; canonical_id: string | null }): string => l.canonical_id ?? l.id,
  fetchLikeCounts: (ids: readonly string[]) => fetchLikeCounts(ids),
}));

import { SearchResults } from './SearchResults';

const lick = (id: string, title: string): LickRow =>
  ({
    id,
    title,
    blob: 'invalid-blob',
    author_id: 'a1',
    canonical_id: null,
    tags: [],
    created_at: '2026-01-02T00:00:00.000Z',
    profiles: { public_id: 'pub-1', display_name: 'Author A' },
  }) as LickRow;

beforeEach(() => {
  vi.clearAllMocks();
  searchLicks.mockResolvedValue([]);
  searchUsers.mockResolvedValue([]);
  fetchLikeCounts.mockResolvedValue(new Map());
});

describe('SearchResults', () => {
  it('릭과 유저를 섹션으로 나눠 보여준다', async () => {
    searchLicks.mockResolvedValue([lick('l1', 'Blue Bossa')]);
    searchUsers.mockResolvedValue([
      { public_id: 'u1', display_name: 'blue note', avatar_url: null },
    ]);

    render(<SearchResults query="blue" />);

    expect(await screen.findByText('Blue Bossa')).toBeTruthy();
    expect(screen.getByText('blue note')).toBeTruthy();
    expect(screen.getByText('Licks')).toBeTruthy();
    expect(screen.getByText('Users')).toBeTruthy();
    expect(searchLicks).toHaveBeenCalledWith('blue', { limit: 20, cursor: null });
    // 유저 링크는 /user/:public_id
    expect(screen.getByText('blue note').closest('a')?.getAttribute('href')).toBe('/user/u1');
  });

  it('결과가 없으면 빈 상태 문구를 보여준다', async () => {
    render(<SearchResults query="zzz" />);
    expect(await screen.findByText(/No results for/)).toBeTruthy();
  });

  it('빈 질의면 검색하지 않고 안내 문구만 보여준다', () => {
    render(<SearchResults query="  " />);
    expect(screen.getByText(/Type something to search/)).toBeTruthy();
    expect(searchLicks).not.toHaveBeenCalled();
    expect(searchUsers).not.toHaveBeenCalled();
  });

  it('릭 검색이 실패해도 조용히 빈 목록 처리한다 (설계 §4)', async () => {
    searchLicks.mockRejectedValue(new Error('down'));
    render(<SearchResults query="blue" />);
    expect(await screen.findByText(/No results for/)).toBeTruthy();
  });
});
