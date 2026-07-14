/** 게시 화면 — 에디터 Share→Publish로 진입(URL 해시에 곡 blob). 미리보기 → 게시/중복 판정. */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { Player } from '../../adapters/player';
import { encodeSong } from '../../core/codec';
import { demoSong } from '../../core/demo-song';
import type { PublishResult } from '../api/licks';

const publishLick =
  vi.fn<
    (title: string, blob: string, hash: string, tags: readonly string[]) => Promise<PublishResult>
  >();
vi.mock('../api/licks', () => ({
  publishLick: (title: string, blob: string, hash: string, tags: readonly string[]) =>
    publishLick(title, blob, hash, tags),
}));

const navigate = vi.fn<(path: string) => void>();
vi.mock('../routing', () => ({
  navigate: (path: string) => navigate(path),
}));

import { Publish } from './Publish';

const fakeUser = { id: 'user-1' } as unknown as User;
const validHash = encodeSong(demoSong);
// 유효하게 디코딩되지만 notes가 빈 v1. 해시
const emptyHash = encodeSong({ ...demoSong, title: 'Empty lick', notes: [] });

const fakePlayer = (): Player =>
  ({
    play: vi.fn(),
    stop: vi.fn(),
    isPlaying: vi.fn(() => false),
    onTick: vi.fn(() => () => {}),
    onEnded: vi.fn(() => () => {}),
    setLoop: vi.fn(),
    preview: vi.fn(),
    toggleAcc: vi.fn(),
    toggleMetro: vi.fn(),
  }) as unknown as Player;

const renderAt = (hash: string, user: User | null = fakeUser, player: Player = fakePlayer()) => {
  window.history.pushState(null, '', '/publish' + hash);
  return { ...render(<Publish user={user} player={player} />), player };
};

afterEach(() => {
  window.history.pushState(null, '', '/publish');
});

describe('Publish 게시 화면 (해시 기반)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('비로그인: 미리보기·Copy link는 보이고 Publish 자리에 로그인 안내', () => {
    renderAt('#' + validHash, null);
    expect(document.querySelector('svg')).toBeTruthy();
    expect(screen.getByText('Copy link')).toBeTruthy();
    expect(screen.getByText('Sign in to publish')).toBeTruthy();
    expect(screen.queryByText('Publish')).toBeNull();
    expect(publishLick).not.toHaveBeenCalled();
  });

  it('해시가 없으면 빈 상태 안내 + 에디터 링크 클릭 시 이동', () => {
    renderAt('');
    expect(screen.getByText(/No score to publish/)).toBeTruthy();
    fireEvent.click(screen.getByText('Go to the editor'));
    expect(navigate).toHaveBeenCalledWith('/edit');
  });

  it('디코드할 수 없는 해시는 오류 문구 (미리보기 없음)', () => {
    renderAt('#v1.@@@');
    expect(screen.getByText("Couldn't read this score")).toBeTruthy();
    expect(document.querySelector('svg')).toBeNull();
  });

  it('음표 없는 유효 해시는 안내 문구 + 게시 버튼 없음 + publishLick 미호출', () => {
    renderAt('#' + emptyHash);
    expect(screen.getByText('This lick has no notes')).toBeTruthy();
    expect(screen.queryByText('Publish')).toBeNull();
    expect(document.querySelector('svg')).toBeNull();
    expect(publishLick).not.toHaveBeenCalled();
  });

  it('유효 해시는 미리보기(svg)·제목·게시 버튼을 보이고 인코딩 문자열은 노출하지 않는다', () => {
    const { container } = renderAt('#' + validHash);
    expect(document.querySelector('svg')).toBeTruthy();
    expect((screen.getByDisplayValue(demoSong.title) as HTMLInputElement).value).toBe(
      demoSong.title,
    );
    expect(screen.getByText('Publish')).toBeTruthy();
    // 인코딩 blob(v1.…)이 화면에 노출되지 않는다
    expect(container.textContent).not.toContain('v1.');
    expect(screen.queryByPlaceholderText('Paste a share URL or hash')).toBeNull();
  });

  it('게시 클릭 → ok면 /lick/:id로 이동한다', async () => {
    publishLick.mockResolvedValue({ ok: true, id: 'abc' });
    renderAt('#' + validHash);
    fireEvent.click(screen.getByText('Publish'));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/lick/abc'));
    expect(publishLick).toHaveBeenCalledTimes(1);
  });

  it('제목을 편집하면 그 제목으로 게시한다', async () => {
    publishLick.mockResolvedValue({ ok: true, id: 'xyz' });
    renderAt('#' + validHash);
    fireEvent.change(screen.getByDisplayValue(demoSong.title), { target: { value: 'My title' } });
    fireEvent.click(screen.getByText('Publish'));
    await vi.waitFor(() => expect(publishLick).toHaveBeenCalledTimes(1));
    expect(publishLick).toHaveBeenCalledWith('My title', validHash, expect.any(String), []);
  });

  it('태그를 커밋해 게시하면 정규화된 태그가 함께 전달된다', async () => {
    publishLick.mockResolvedValue({ ok: true, id: 'tagged' });
    renderAt('#' + validHash);
    const field = screen.getByLabelText('Add tags');
    fireEvent.change(field, { target: { value: '#Jazz Blues' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    fireEvent.change(field, { target: { value: 'bebop' } });
    fireEvent.keyDown(field, { key: ',' });
    fireEvent.click(screen.getByText('Publish'));
    await vi.waitFor(() => expect(publishLick).toHaveBeenCalledTimes(1));
    expect(publishLick).toHaveBeenCalledWith(
      demoSong.title,
      validHash,
      expect.any(String),
      ['jazz-blues', 'bebop'],
    );
  });

  it('태그 없이도 정상 게시된다 (빈 배열)', async () => {
    publishLick.mockResolvedValue({ ok: true, id: 'plain' });
    renderAt('#' + validHash);
    fireEvent.click(screen.getByText('Publish'));
    await vi.waitFor(() => expect(publishLick).toHaveBeenCalledTimes(1));
    expect(publishLick).toHaveBeenCalledWith(demoSong.title, validHash, expect.any(String), []);
  });

  it('publishLick이 duplicate를 반환하면 안내 문구를 보여준다', async () => {
    publishLick.mockResolvedValue({ ok: false, reason: 'duplicate' });
    renderAt('#' + validHash);
    fireEvent.click(screen.getByText('Publish'));
    expect(await screen.findByText('You already published this lick')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('재생 토글: Play 클릭 → player.play (멜로디+반주+메트로놈 옵션)', () => {
    const { player } = renderAt('#' + validHash);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(player.play).toHaveBeenCalledTimes(1);
    expect((player.play as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]).toEqual({
      melody: true,
      accomp: true,
      metro: true,
    });
  });

  it('Copy link → /?mode=view#hash 클립보드 복사 + Link copied 토스트', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    renderAt('#' + validHash);
    fireEvent.click(screen.getByText('Copy link'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('?mode=view#' + validHash));
    expect(await screen.findByText('Link copied')).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it('Back to editor → /edit#hash로 이동', () => {
    renderAt('#' + validHash);
    fireEvent.click(screen.getByText(/Back to editor/));
    expect(navigate).toHaveBeenCalledWith('/edit#' + validHash);
  });
});
