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
  title: 'Original lick',
  blob,
  author_id: 'author-1',
  canonical_id: null,
  tags: [],
  created_at: '2026-01-02T00:00:00.000Z',
  profiles: { public_id: 'pub-1', display_name: 'Author A' },
  ...over,
});

const original = lick({ id: 'orig-1' });
const similar = lick({
  id: 'sim-1',
  title: 'Similar lick',
  author_id: 'author-2',
  canonical_id: 'orig-1',
  profiles: { public_id: 'pub-2', display_name: 'Author B' },
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
    setLoop: vi.fn(),
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

  it('시안 C 구조: 툴바·악보가 한 프레임 안(R1), 그 사이 구분선(R4), 재생 컨트롤은 프레임 밖에 없다(R5)', async () => {
    fetchLick.mockResolvedValue(original);
    const { container } = render(<LickDetail id="orig-1" user={null} player={fakePlayer()} />);
    await screen.findByText('Original lick');

    const frame = container.querySelector('.c-frame');
    expect(frame).not.toBeNull();
    // R1: 툴바와 악보(svg)가 같은 프레임 컨테이너 안
    expect(frame?.querySelector('.c-toolbar')).not.toBeNull();
    expect(frame?.querySelector('svg')).not.toBeNull();
    // R4: 툴바와 악보 사이 구분선
    expect(frame?.querySelector('.c-frame-divider')).not.toBeNull();
    // R5: 재생 버튼은 프레임 안에만 있다 (프레임 밖에 재생 컨트롤 없음)
    const playBtn = screen.getByLabelText('Play');
    expect(frame?.contains(playBtn)).toBe(true);
    // 하단 푸터 DOM 순서: 액션(primary=Duplicate) 먼저, 태그 나중 (§6)
    const footer = container.querySelector('.c-footer');
    const kids = [...(footer?.children ?? [])];
    expect(kids[0]?.classList.contains('c-actions')).toBe(true);
    expect(footer?.querySelector('.c-dup')).not.toBeNull(); // primary 정확히 하나
    expect(container.querySelectorAll('.c-dup')).toHaveLength(1);
  });

  it('조옮김·다운로드 관련 UI가 어디에도 없다 (§18)', async () => {
    fetchLick.mockResolvedValue(original);
    const { container } = render(<LickDetail id="orig-1" user={user1} player={fakePlayer()} />);
    await screen.findByText('Original lick');
    fireEvent.click(screen.getByLabelText('More actions')); // 메뉴까지 열어 확인
    const text = container.textContent ?? '';
    expect(/transpose|download|midi|musicxml|\.png/i.test(text)).toBe(false);
  });

  it('원본 릭: 제목·악보(svg)·좋아요 카운트가 렌더된다', async () => {
    fetchLick.mockResolvedValue(original);
    const { container } = render(<LickDetail id="orig-1" user={null} player={fakePlayer()} />);

    expect(await screen.findByText('Original lick')).toBeTruthy();
    expect(container.querySelector('svg')).not.toBeNull();
    expect(await screen.findByText('♥ 3')).toBeTruthy();
    expect(fetchLick).toHaveBeenCalledWith('orig-1');
  });

  it('태그가 있으면 칩(#tag)을 렌더한다 (클릭 비활성 순수 표시)', async () => {
    fetchLick.mockResolvedValue(lick({ id: 'orig-1', tags: ['jazz', '재즈'] }));
    render(<LickDetail id="orig-1" user={null} player={fakePlayer()} />);

    expect(await screen.findByText('#jazz')).toBeTruthy();
    expect(screen.getByText('#재즈')).toBeTruthy();
    // 칩은 링크·버튼이 아니다
    expect(screen.getByText('#jazz').closest('a, button')).toBeNull();
  });

  it('태그가 없으면 칩을 렌더하지 않는다', async () => {
    fetchLick.mockResolvedValue(original);
    const { container } = render(<LickDetail id="orig-1" user={null} player={fakePlayer()} />);

    await screen.findByText('Original lick');
    expect(container.querySelector('.c-tag')).toBeNull();
  });

  it('유사릭: 안내 문구 + 원본 링크, 클릭 시 원본으로 이동한다', async () => {
    fetchLick.mockResolvedValue(similar);
    render(<LickDetail id="sim-1" user={null} player={fakePlayer()} />);

    expect(await screen.findByText(/This is a similar lick/)).toBeTruthy();
    expect(fetchLikeCounts).toHaveBeenCalledWith(['orig-1']);

    fireEvent.click(screen.getByText('original lick'));
    expect(navigate).toHaveBeenCalledWith('/lick/orig-1');
  });

  it('Duplicate & edit: 릭 blob으로 /edit# 로 이동한다', async () => {
    fetchLick.mockResolvedValue(original);
    render(<LickDetail id="orig-1" user={null} player={fakePlayer()} />);

    fireEvent.click(await screen.findByText('Duplicate & edit'));
    expect(navigate).toHaveBeenCalledWith('/edit#' + blob);
  });

  it('로그인 상태에서 좋아요 토글 → addLike(원본 대상) 호출·카운트 +1·on 클래스', async () => {
    fetchLick.mockResolvedValue(similar);
    const { container } = render(<LickDetail id="sim-1" user={user2} player={fakePlayer()} />);

    await screen.findByText(/This is a similar lick/);
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
    const { container } = render(<LickDetail id="orig-1" user={user2} player={fakePlayer()} />);

    await screen.findByText('Original lick');
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
    const { container } = render(<LickDetail id="orig-1" user={null} player={fakePlayer()} />);

    await screen.findByText('Original lick');
    const likeBtn = container.querySelector('.c-like');
    if (!likeBtn) throw new Error('좋아요 버튼 없음');
    fireEvent.click(likeBtn);

    expect(screen.getByText(/Sign in to like/)).toBeTruthy();
    expect(addLike).not.toHaveBeenCalled();
  });

  it('오버플로 메뉴: 작성자만 ⋯ 버튼을 보고 Delete lick 항목이 있다', async () => {
    fetchLick.mockResolvedValue(original);
    const { unmount } = render(<LickDetail id="orig-1" user={user1} player={fakePlayer()} />);
    await screen.findByText('Original lick');
    const more = screen.getByLabelText('More actions');
    fireEvent.click(more);
    expect(screen.getByText('Delete lick')).toBeTruthy();
    unmount();

    // 비작성자: Report 미구현이라 ⋯ 버튼 자체가 없다
    fetchLick.mockResolvedValue(original);
    render(<LickDetail id="orig-1" user={user2} player={fakePlayer()} />);
    await screen.findByText('Original lick');
    expect(screen.queryByLabelText('More actions')).toBeNull();
  });

  it('삭제 다이얼로그 확인 → deleteLick 후 /me 로 이동한다', async () => {
    fetchLick.mockResolvedValue(original);
    render(<LickDetail id="orig-1" user={user1} player={fakePlayer()} />);

    await screen.findByText('Original lick');
    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(await screen.findByText('Delete lick'));
    // 확인 다이얼로그
    expect(screen.getByText('Delete this lick?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(deleteLick).toHaveBeenCalledWith('orig-1');
      expect(navigate).toHaveBeenCalledWith('/me');
    });
  });

  it('삭제 다이얼로그 취소 → deleteLick·navigate 모두 호출되지 않고 닫힌다', async () => {
    fetchLick.mockResolvedValue(original);
    render(<LickDetail id="orig-1" user={user1} player={fakePlayer()} />);

    await screen.findByText('Original lick');
    fireEvent.click(screen.getByLabelText('More actions'));
    fireEvent.click(await screen.findByText('Delete lick'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(deleteLick).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete this lick?')).toBeNull();
  });

  it('툴바 Play 클릭 → player.play(세션 템포·전체 구간·loop=false), 언마운트 시 stop', async () => {
    fetchLick.mockResolvedValue(original);
    const player = fakePlayer();
    const { unmount } = render(<LickDetail id="orig-1" user={null} player={player} />);

    const playBtn = await screen.findByLabelText('Play');
    fireEvent.click(playBtn);

    // 세션 bpm 기본값 = 원곡 tempo이므로 {...song, tempo} 는 demoSong과 동일
    expect(player.play).toHaveBeenCalledWith(
      demoSong,
      { melody: true, accomp: true, metro: true },
      0,
      total(demoSong),
      false,
    );

    unmount();
    expect(player.stop).toHaveBeenCalled();
  });
});
