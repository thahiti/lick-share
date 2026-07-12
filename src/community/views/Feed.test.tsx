/** 최신 피드 — 첫 페이지 마운트 로드, 좋아요 수는 원본 기준, 유사릭 배지 (설계 §8.2, §7). */
import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LickRow } from '../api/licks';

const lick = (over: Partial<LickRow> & Pick<LickRow, 'id' | 'title'>): LickRow => ({
  blob: 'invalid-blob',
  author_id: 'author-1',
  canonical_id: null,
  created_at: '2026-01-02T00:00:00.000Z',
  profiles: { public_id: 'pub-1', display_name: '작성자A' },
  ...over,
});

const original = lick({ id: 'orig-1', title: '오리지널 릭' });
const similar = lick({
  id: 'sim-1',
  title: '유사한 릭',
  author_id: 'author-2',
  canonical_id: 'orig-1',
  created_at: '2026-01-01T00:00:00.000Z',
  profiles: { public_id: 'pub-2', display_name: '작성자B' },
});

const fetchFeedPage = vi.fn<(cursor: string | null, authorId?: string) => Promise<LickRow[]>>();
const deleteLick = vi.fn(async (_id: string) => {});
const fetchLikeCounts = vi.fn(async (_ids: readonly string[]) => new Map<string, number>());

vi.mock('../api/licks', () => ({
  PAGE_SIZE: 20,
  fetchFeedPage: (cursor: string | null, authorId?: string) => fetchFeedPage(cursor, authorId),
  deleteLick: (id: string) => deleteLick(id),
}));

vi.mock('../api/likes', () => ({
  canonicalIds: (ls: readonly { id: string; canonical_id: string | null }[]): string[] => [
    ...new Set(ls.map((l) => l.canonical_id ?? l.id)),
  ],
  likeTargetId: (l: { id: string; canonical_id: string | null }): string => l.canonical_id ?? l.id,
  fetchLikeCounts: (ids: readonly string[]) => fetchLikeCounts(ids),
}));

import { Feed } from './Feed';

describe('Feed 최신 피드', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchFeedPage.mockResolvedValue([original, similar]);
    fetchLikeCounts.mockResolvedValue(new Map([['orig-1', 7]]));
  });

  it('마운트 시 첫 페이지를 로드해 카드 2개 · 원본 기준 좋아요 수 · 유사릭 배지를 보여준다', async () => {
    render(<Feed />);

    expect(await screen.findByText('오리지널 릭')).toBeTruthy();
    expect(screen.getByText('유사한 릭')).toBeTruthy();

    // 좋아요 수는 canonical(원본) 기준 — 유사릭도 원본의 카운트를 그대로 표시
    expect(screen.getAllByText('♥ 7')).toHaveLength(2);

    // 유사릭(canonical_id 존재)만 배지 표시
    expect(screen.getByText('유사릭')).toBeTruthy();

    expect(fetchFeedPage).toHaveBeenCalledWith(null, undefined);
    expect(fetchLikeCounts).toHaveBeenCalledWith(['orig-1']);
  });

  it('StrictMode 이중 이펙트에서도 첫 페이지 요청은 정확히 1회', async () => {
    render(
      <StrictMode>
        <Feed />
      </StrictMode>,
    );

    expect(await screen.findByText('오리지널 릭')).toBeTruthy();
    expect(screen.getAllByText('오리지널 릭')).toHaveLength(1);
    expect(fetchFeedPage).toHaveBeenCalledTimes(1);
  });

  it('authorId가 바뀌면 상태를 초기화하고 새 작성자의 첫 페이지만 보여준다', async () => {
    const a1Lick = lick({ id: 'a1-1', title: 'A1의 릭', author_id: 'a1' });
    const a2Lick = lick({ id: 'a2-1', title: 'A2의 릭', author_id: 'a2' });
    fetchFeedPage.mockImplementation(async (_cursor, authorId) =>
      authorId === 'a2' ? [a2Lick] : [a1Lick],
    );

    const { rerender } = render(<Feed authorId="a1" />);
    expect(await screen.findByText('A1의 릭')).toBeTruthy();

    rerender(<Feed authorId="a2" />);
    expect(await screen.findByText('A2의 릭')).toBeTruthy();

    // 이전 작성자 목록에 append되지 않고 완전히 교체됨
    expect(screen.queryByText('A1의 릭')).toBeNull();

    // 새 작성자의 첫 페이지는 커서 null부터 다시 시작
    expect(fetchFeedPage).toHaveBeenLastCalledWith(null, 'a2');
  });
});
