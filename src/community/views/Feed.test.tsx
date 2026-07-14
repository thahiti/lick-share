/** 최신 피드 — 첫 페이지 마운트 로드, 좋아요 수는 원본 기준, 유사릭 배지 (설계 §8.2, §7). */
import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LickRow } from '../api/licks';

const lick = (over: Partial<LickRow> & Pick<LickRow, 'id' | 'title'>): LickRow => ({
  blob: 'invalid-blob',
  author_id: 'author-1',
  canonical_id: null,
  tags: [],
  created_at: '2026-01-02T00:00:00.000Z',
  profiles: { public_id: 'pub-1', display_name: 'Author A' },
  ...over,
});

const original = lick({ id: 'orig-1', title: 'Original lick' });
const similar = lick({
  id: 'sim-1',
  title: 'Similar lick',
  author_id: 'author-2',
  canonical_id: 'orig-1',
  created_at: '2026-01-01T00:00:00.000Z',
  profiles: { public_id: 'pub-2', display_name: 'Author B' },
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

    expect(await screen.findByText('Original lick')).toBeTruthy();
    expect(screen.getByText('Similar lick')).toBeTruthy();

    // 좋아요 수는 canonical(원본) 기준 — 유사릭도 원본의 카운트를 그대로 표시
    expect(screen.getAllByText('♥ 7')).toHaveLength(2);

    // 유사릭(canonical_id 존재)만 배지 표시
    expect(screen.getByText('similar')).toBeTruthy();

    expect(fetchFeedPage).toHaveBeenCalledWith(null, undefined);
    expect(fetchLikeCounts).toHaveBeenCalledWith(['orig-1']);
  });

  it('태그가 있는 카드는 칩을 렌더하고, 없는 카드는 칩을 렌더하지 않는다', async () => {
    const tagged = lick({ id: 'tag-1', title: 'Tagged lick', tags: ['jazz', 'blues'] });
    fetchFeedPage.mockResolvedValue([tagged, original]);

    render(<Feed />);

    expect(await screen.findByText('#jazz')).toBeTruthy();
    expect(screen.getByText('#blues')).toBeTruthy();
    // original(tags: [])은 칩이 없으므로 칩은 tagged의 2개뿐
    expect(document.querySelectorAll('.c-tag')).toHaveLength(2);
  });

  it('홈 피드는 정렬 pill(Latest/Popular)을 보여주고 클릭 시 active가 전환된다', async () => {
    render(<Feed />);
    const latest = await screen.findByRole('tab', { name: 'Latest' });
    const popular = screen.getByRole('tab', { name: 'Popular' });
    expect(latest.className).toContain('active');
    fireEvent.click(popular);
    expect(popular.className).toContain('active');
    expect(latest.className).not.toContain('active');
  });

  it('작성자 필터(유저 페이지)에서는 정렬 pill을 숨긴다', async () => {
    fetchFeedPage.mockResolvedValue([original]);
    render(<Feed authorId="author-1" />);
    await screen.findByText('Original lick');
    expect(screen.queryByRole('tab', { name: 'Popular' })).toBeNull();
  });

  it('StrictMode 이중 이펙트에서도 첫 페이지 요청은 정확히 1회', async () => {
    render(
      <StrictMode>
        <Feed />
      </StrictMode>,
    );

    expect(await screen.findByText('Original lick')).toBeTruthy();
    expect(screen.getAllByText('Original lick')).toHaveLength(1);
    expect(fetchFeedPage).toHaveBeenCalledTimes(1);
  });

  it('authorId가 바뀌면 상태를 초기화하고 새 작성자의 첫 페이지만 보여준다', async () => {
    const a1Lick = lick({ id: 'a1-1', title: "A1's lick", author_id: 'a1' });
    const a2Lick = lick({ id: 'a2-1', title: "A2's lick", author_id: 'a2' });
    fetchFeedPage.mockImplementation(async (_cursor, authorId) =>
      authorId === 'a2' ? [a2Lick] : [a1Lick],
    );

    const { rerender } = render(<Feed authorId="a1" />);
    expect(await screen.findByText("A1's lick")).toBeTruthy();

    rerender(<Feed authorId="a2" />);
    expect(await screen.findByText("A2's lick")).toBeTruthy();

    // 이전 작성자 목록에 append되지 않고 완전히 교체됨
    expect(screen.queryByText("A1's lick")).toBeNull();

    // 새 작성자의 첫 페이지는 커서 null부터 다시 시작
    expect(fetchFeedPage).toHaveBeenLastCalledWith(null, 'a2');
  });

  it('deletable: 빨간 Delete 버튼 대신 오버플로(⋯) 메뉴로 삭제 진입한다', async () => {
    fetchFeedPage.mockResolvedValue([original]);
    render(<Feed authorId="author-1" deletable />);
    await screen.findByText('Original lick');

    // 인라인 Delete 버튼은 없다 — 상세 페이지와 동일한 ⋯ 패턴
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('menuitem', { name: 'Delete lick' })).toBeTruthy();
  });

  it('deletable: Delete lick → 확인 다이얼로그 → Delete 확정 시 삭제·카드 제거', async () => {
    fetchFeedPage.mockResolvedValue([original]);
    render(<Feed authorId="author-1" deletable />);
    await screen.findByText('Original lick');

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete lick' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(deleteLick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await vi.waitFor(() => expect(deleteLick).toHaveBeenCalledWith('orig-1'));
    await vi.waitFor(() => expect(screen.queryByText('Original lick')).toBeNull());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('deletable: 다이얼로그 Cancel은 삭제하지 않고 닫는다', async () => {
    fetchFeedPage.mockResolvedValue([original]);
    render(<Feed authorId="author-1" deletable />);
    await screen.findByText('Original lick');

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete lick' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(deleteLick).not.toHaveBeenCalled();
    expect(screen.getByText('Original lick')).toBeTruthy();
  });

  it('첫 페이지 로드 실패 시 에러 안내와 재시도 버튼을 보여주고, 재시도 성공 시 카드가 렌더된다', async () => {
    fetchFeedPage.mockRejectedValueOnce(new Error('network down'));

    render(<Feed />);

    expect(await screen.findByText("Couldn't load the list")).toBeTruthy();
    const retry = screen.getByRole('button', { name: 'Retry' });

    fetchFeedPage.mockResolvedValueOnce([original, similar]);
    fireEvent.click(retry);

    expect(await screen.findByText('Original lick')).toBeTruthy();
    expect(screen.queryByText("Couldn't load the list")).toBeNull();
  });
});
