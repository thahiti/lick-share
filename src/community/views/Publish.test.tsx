/** 게시 화면 (설계 §10) — 해시 붙여넣기 → 미리보기 → 게시/중복 판정. */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import { encodeSong } from '../../core/codec';
import { demoSong } from '../../core/demo-song';
import type { PublishResult } from '../api/licks';

const publishLick = vi.fn<(title: string, blob: string, hash: string) => Promise<PublishResult>>();
vi.mock('../api/licks', () => ({
  publishLick: (title: string, blob: string, hash: string) => publishLick(title, blob, hash),
}));

const navigate = vi.fn<(path: string) => void>();
vi.mock('../routing', () => ({
  navigate: (path: string) => navigate(path),
}));

import { Publish } from './Publish';

const fakeUser = { id: 'user-1' } as unknown as User;
const validHash = encodeSong(demoSong);

// 해시 교체 회귀 테스트용 두 번째 곡 — 제목·멜로디 모두 다름
const otherSong = { ...demoSong, title: 'Other lick', notes: demoSong.notes.slice(0, 3) };
const otherHash = encodeSong(otherSong);

// 빈 곡 회귀 테스트용 — 유효하게 디코딩되지만 notes가 빈 v1. 해시
const emptyHash = encodeSong({ ...demoSong, title: 'Empty lick', notes: [] });

describe('Publish 게시 화면', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('로그인하지 않았으면 안내 문구만 보여주고 텍스트에어리어는 없다', () => {
    render(<Publish user={null} />);
    expect(screen.getByText('Sign in to publish')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('해석할 수 없는 텍스트를 붙여넣으면 오류 문구만 뜨고 게시 버튼은 없다', () => {
    render(<Publish user={fakeUser} />);
    const textarea = screen.getByPlaceholderText('Paste a share URL or hash');
    fireEvent.change(textarea, { target: { value: 'just some random text' } });
    expect(screen.getByText('Invalid link or no notes')).toBeTruthy();
    expect(screen.queryByText('Publish')).toBeNull();
  });

  it('음표가 없는 유효 해시는 오류 문구만 뜨고 게시 버튼이 없으며 publishLick도 호출되지 않는다', () => {
    render(<Publish user={fakeUser} />);
    const textarea = screen.getByPlaceholderText('Paste a share URL or hash');
    fireEvent.change(textarea, { target: { value: emptyHash } });

    expect(screen.getByText('Invalid link or no notes')).toBeTruthy();
    expect(screen.queryByText('Publish')).toBeNull();
    expect(document.querySelector('svg')).toBeNull();
    expect(publishLick).not.toHaveBeenCalled();
  });

  it('유효한 해시를 붙여넣으면 미리보기(svg)와 제목·게시 버튼이 나타난다', () => {
    render(<Publish user={fakeUser} />);
    const textarea = screen.getByPlaceholderText('Paste a share URL or hash');
    fireEvent.change(textarea, { target: { value: validHash } });

    expect(document.querySelector('svg')).toBeTruthy();
    const titleInput = screen.getByDisplayValue(demoSong.title);
    expect((titleInput as HTMLInputElement).value).toBe(demoSong.title);
    expect(screen.getByText('Publish')).toBeTruthy();
  });

  it('게시 클릭 → publishLick ok면 /lick/:id로 이동한다', async () => {
    publishLick.mockResolvedValue({ ok: true, id: 'abc' });
    render(<Publish user={fakeUser} />);
    const textarea = screen.getByPlaceholderText('Paste a share URL or hash');
    fireEvent.change(textarea, { target: { value: validHash } });

    fireEvent.click(screen.getByText('Publish'));

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/lick/abc'));
    expect(publishLick).toHaveBeenCalledTimes(1);
  });

  it('해시 A에 제목을 타이핑한 뒤 해시 B로 교체하면 B의 곡 제목으로 게시한다 (stale title 회귀)', async () => {
    publishLick.mockResolvedValue({ ok: true, id: 'xyz' });
    render(<Publish user={fakeUser} />);
    const textarea = screen.getByPlaceholderText('Paste a share URL or hash');

    // 해시 A 붙여넣기 → 커스텀 제목 타이핑
    fireEvent.change(textarea, { target: { value: validHash } });
    const titleA = screen.getByDisplayValue(demoSong.title);
    fireEvent.change(titleA, { target: { value: 'My custom title' } });
    expect((screen.getByDisplayValue('My custom title') as HTMLInputElement).value).toBe(
      'My custom title',
    );

    // 해시 B로 교체 → 제목 입력이 B의 곡 제목으로 리셋됨
    fireEvent.change(textarea, { target: { value: otherHash } });
    expect(screen.getByDisplayValue(otherSong.title)).toBeTruthy();

    fireEvent.click(screen.getByText('Publish'));

    await vi.waitFor(() => expect(publishLick).toHaveBeenCalledTimes(1));
    // 이전 곡에 타이핑한 제목이 아니라 B의 곡 제목으로 게시
    expect(publishLick).toHaveBeenCalledWith(otherSong.title, otherHash, expect.any(String));
  });

  it('같은 해시를 다시 붙여넣으면(공백 차이) 타이핑한 제목을 유지한 채 게시한다', async () => {
    publishLick.mockResolvedValue({ ok: true, id: 'xyz' });
    render(<Publish user={fakeUser} />);
    const textarea = screen.getByPlaceholderText('Paste a share URL or hash');

    // 해시 A 붙여넣기 → 커스텀 제목 타이핑
    fireEvent.change(textarea, { target: { value: validHash } });
    fireEvent.change(screen.getByDisplayValue(demoSong.title), {
      target: { value: 'My custom title' },
    });

    // 추출 결과가 여전히 A인 재입력 (앞 공백만 다른 같은 해시) — 제목 입력은 그대로
    fireEvent.change(textarea, { target: { value: '  ' + validHash } });
    expect(screen.getByDisplayValue('My custom title')).toBeTruthy();

    fireEvent.click(screen.getByText('Publish'));

    await vi.waitFor(() => expect(publishLick).toHaveBeenCalledTimes(1));
    // 화면에 남아 있는 커스텀 제목 그대로 게시 (song.title로 후퇴하지 않음)
    expect(publishLick).toHaveBeenCalledWith('My custom title', validHash, expect.any(String));
  });

  it('publishLick이 duplicate를 반환하면 "You already published this lick"를 보여준다', async () => {
    publishLick.mockResolvedValue({ ok: false, reason: 'duplicate' });
    render(<Publish user={fakeUser} />);
    const textarea = screen.getByPlaceholderText('Paste a share URL or hash');
    fireEvent.change(textarea, { target: { value: validHash } });

    fireEvent.click(screen.getByText('Publish'));

    expect(await screen.findByText('You already published this lick')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });
});
