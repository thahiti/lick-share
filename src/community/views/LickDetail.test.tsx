/** 릭 상세 — 재생·좋아요 낙관적 토글·삭제·유사릭 원본 링크 (설계 §7, §9). */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeSong } from '../../core/codec';
import { demoSong } from '../../core/demo-song';
import { total } from '../../core/geometry';
import type { Player } from '../../adapters/player';
import type { LickRow } from '../api/licks';

const blob = encodeSong(demoSong);

const lick = (over: Partial<LickRow> & Pick<LickRow, 'id'>): LickRow => ({
  title: '오리지널 릭',
  blob,
  author_id: 'author-1',
  canonical_id: null,
  created_at: '2026-01-02T00:00:00.000Z',
  profiles: { public_id: 'pub-1', display_name: '작성자A' },
  ...over,
});

const original = lick({ id: 'orig-1' });
const similar = lick({
  id: 'sim-1',
  title: '유사한 릭',
  author_id: 'author-2',
  canonical_id: 'orig-1',
  profiles: { public_id: 'pub-2', display_name: '작성자B' },
});

const fetchLick = vi.fn<(id: string) => Promise<LickRow | null>>();
const deleteLick = vi.fn(async (_id: string) => {});
const fetchLikeCounts = vi.fn(async (_ids: readonly string[]) => new Map<string, number>());
const fetchMyLikedSet = vi.fn(async (_userId: string) => new Set<string>());
const addLike = vi.fn(async (_target: string) => {});
const removeLike = vi.fn(async (_target: string) => {});
const navigate = vi.fn();

vi.mock('../api/licks', () => ({
  fetchLick: (id: string) => fetchLick(id),
  deleteLick: (id: string) => deleteLick(id),
}));

vi.mock('../api/likes', () => ({
  likeTargetId: (l: { id: string; canonical_id: string | null }): string => l.canonical_id ?? l.id,
  fetchLikeCounts: (ids: readonly string[]) => fetchLikeCounts(ids),
  fetchMyLikedSet: (userId: string) => fetchMyLikedSet(userId),
  addLike: (target: string) => addLike(target),
  removeLike: (target: string) => removeLike(target),
}));

vi.mock('../routing', () => ({
  navigate: (path: string) => navigate(path),
}));

import { LickDetail } from './LickDetail';

const fakePlayer = (): Player =>
  ({
    play: vi.fn(),
    stop: vi.fn(),
    isPlaying: vi.fn(() => false),
    toggleMetro: vi.fn(),
    toggleAcc: vi.fn(),
    onTick: vi.fn(() => () => {}),
    onEnded: vi.fn(() => () => {}),
    preview: vi.fn(),
  }) as unknown as Player;

const user1 = { id: 'author-1' } as import('@supabase/supabase-js').User;
const user2 = { id: 'author-2' } as import('@supabase/supabase-js').User;

afterEach(cleanup);

describe('LickDetail 릭 상세', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchLikeCounts.mockResolvedValue(new Map([['orig-1', 3]]));
    fetchMyLikedSet.mockResolvedValue(new Set());
  });

  it('원본 릭: 제목·악보(svg)·좋아요 카운트가 렌더된다', async () => {
    fetchLick.mockResolvedValue(original);
    const { container } = render(
      <LickDetail id="orig-1" user={null} player={fakePlayer()} />,
    );

    expect(await screen.findByText('오리지널 릭')).toBeTruthy();
    expect(container.querySelector('svg')).not.toBeNull();
    expect(await screen.findByText('♥ 3')).toBeTruthy();
    expect(fetchLick).toHaveBeenCalledWith('orig-1');
  });

  it('유사릭: 안내 문구 + 원본 링크, 클릭 시 원본으로 이동한다', async () => {
    fetchLick.mockResolvedValue(similar);
    render(<LickDetail id="sim-1" user={null} player={fakePlayer()} />);

    expect(await screen.findByText(/이 릭은 유사릭이에요/)).toBeTruthy();
    expect(fetchLikeCounts).toHaveBeenCalledWith(['orig-1']);

    fireEvent.click(screen.getByText('원본 릭'));
    expect(navigate).toHaveBeenCalledWith('/lick/orig-1');
  });

  it('로그인 상태에서 좋아요 토글 → addLike(원본 대상) 호출·카운트 +1·on 클래스', async () => {
    fetchLick.mockResolvedValue(similar);
    const { container } = render(
      <LickDetail id="sim-1" user={user2} player={fakePlayer()} />,
    );

    await screen.findByText(/이 릭은 유사릭이에요/);
    const likeBtn = container.querySelector('.c-like');
    if (!likeBtn) throw new Error('좋아요 버튼 없음');
    await waitFor(() => expect(likeBtn.textContent).toContain('♥ 3'));

    fireEvent.click(likeBtn);

    expect(addLike).toHaveBeenCalledWith('orig-1');
    expect(likeBtn.className).toContain('on');
    expect(likeBtn.textContent).toContain('♥ 4');
  });

  it('좋아요 요청 진행 중 재클릭은 무시된다 (single-flight — 롤백 경합 방지)', async () => {
    fetchLick.mockResolvedValue(original);
    let resolveAdd: (() => void) | undefined;
    // once: clearAllMocks는 구현을 지우지 않으므로 pending promise가 다른 테스트로 새지 않게 한다
    addLike.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveAdd = resolve;
      }),
    );
    const { container } = render(
      <LickDetail id="orig-1" user={user2} player={fakePlayer()} />,
    );

    await screen.findByText('오리지널 릭');
    const likeBtn = container.querySelector<HTMLButtonElement>('.c-like');
    if (!likeBtn) throw new Error('좋아요 버튼 없음');
    await waitFor(() => expect(likeBtn.textContent).toContain('♥ 3'));

    fireEvent.click(likeBtn); // addLike pending — 낙관적 반영 + 버튼 비활성화
    expect(addLike).toHaveBeenCalledTimes(1);
    expect(likeBtn.disabled).toBe(true);
    expect(likeBtn.textContent).toContain('♥ 4');

    fireEvent.click(likeBtn); // 진행 중 재클릭 — 무시되어야 함
    expect(removeLike).not.toHaveBeenCalled();
    expect(addLike).toHaveBeenCalledTimes(1);
    expect(likeBtn.textContent).toContain('♥ 4');

    resolveAdd?.();
    await waitFor(() => expect(likeBtn.disabled).toBe(false));
    expect(likeBtn.textContent).toContain('♥ 4');
    expect(likeBtn.className).toContain('on');
  });

  it('비로그인 상태에서 좋아요 클릭 → 로그인 안내, addLike는 호출되지 않는다', async () => {
    fetchLick.mockResolvedValue(original);
    const { container } = render(
      <LickDetail id="orig-1" user={null} player={fakePlayer()} />,
    );

    await screen.findByText('오리지널 릭');
    const likeBtn = container.querySelector('.c-like');
    if (!likeBtn) throw new Error('좋아요 버튼 없음');
    fireEvent.click(likeBtn);

    expect(screen.getByText(/로그인 후에/)).toBeTruthy();
    expect(addLike).not.toHaveBeenCalled();
  });

  it('삭제 버튼은 작성자에게만 보인다', async () => {
    fetchLick.mockResolvedValue(original);
    const { unmount } = render(
      <LickDetail id="orig-1" user={user1} player={fakePlayer()} />,
    );
    await screen.findByText('오리지널 릭');
    expect(screen.getByText('삭제')).toBeTruthy();
    unmount();

    fetchLick.mockResolvedValue(original);
    render(<LickDetail id="orig-1" user={user2} player={fakePlayer()} />);
    await screen.findByText('오리지널 릭');
    expect(screen.queryByText('삭제')).toBeNull();
  });

  it('확인 대화상자에서 승인하면 deleteLick 후 피드로 이동한다', async () => {
    fetchLick.mockResolvedValue(original);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<LickDetail id="orig-1" user={user1} player={fakePlayer()} />);

    const deleteBtn = await screen.findByText('삭제');
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(deleteLick).toHaveBeenCalledWith('orig-1');
      expect(navigate).toHaveBeenCalledWith('/');
    });
    confirmSpy.mockRestore();
  });

  it('확인 대화상자에서 취소하면 deleteLick·navigate 모두 호출되지 않는다', async () => {
    fetchLick.mockResolvedValue(original);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<LickDetail id="orig-1" user={user1} player={fakePlayer()} />);

    const deleteBtn = await screen.findByText('삭제');
    fireEvent.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteLick).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('전곡 재생 버튼 클릭 → player.play(전체 구간), 언마운트 시 player.stop 호출', async () => {
    fetchLick.mockResolvedValue(original);
    const player = fakePlayer();
    const { unmount } = render(
      <LickDetail id="orig-1" user={null} player={player} />,
    );

    const playBtn = await screen.findByText('전곡 재생');
    fireEvent.click(playBtn);

    expect(player.play).toHaveBeenCalledWith(
      demoSong,
      { melody: true, accomp: false, metro: false },
      0,
      total(demoSong),
    );

    unmount();
    expect(player.stop).toHaveBeenCalled();
  });
});
