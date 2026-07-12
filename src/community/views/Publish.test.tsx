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

describe('Publish 게시 화면', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('로그인하지 않았으면 안내 문구만 보여주고 텍스트에어리어는 없다', () => {
    render(<Publish user={null} />);
    expect(screen.getByText('게시하려면 로그인이 필요해요')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('해석할 수 없는 텍스트를 붙여넣으면 오류 문구만 뜨고 게시 버튼은 없다', () => {
    render(<Publish user={fakeUser} />);
    const textarea = screen.getByPlaceholderText('공유 URL 또는 해시를 붙여넣으세요');
    fireEvent.change(textarea, { target: { value: '그냥 아무 텍스트' } });
    expect(screen.getByText('해석할 수 없는 링크이거나 음표가 없어요')).toBeTruthy();
    expect(screen.queryByText('게시')).toBeNull();
  });

  it('유효한 해시를 붙여넣으면 미리보기(svg)와 제목·게시 버튼이 나타난다', () => {
    render(<Publish user={fakeUser} />);
    const textarea = screen.getByPlaceholderText('공유 URL 또는 해시를 붙여넣으세요');
    fireEvent.change(textarea, { target: { value: validHash } });

    expect(document.querySelector('svg')).toBeTruthy();
    const titleInput = screen.getByDisplayValue(demoSong.title);
    expect((titleInput as HTMLInputElement).value).toBe(demoSong.title);
    expect(screen.getByText('게시')).toBeTruthy();
  });

  it('게시 클릭 → publishLick ok면 /lick/:id로 이동한다', async () => {
    publishLick.mockResolvedValue({ ok: true, id: 'abc' });
    render(<Publish user={fakeUser} />);
    const textarea = screen.getByPlaceholderText('공유 URL 또는 해시를 붙여넣으세요');
    fireEvent.change(textarea, { target: { value: validHash } });

    fireEvent.click(screen.getByText('게시'));

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/lick/abc'));
    expect(publishLick).toHaveBeenCalledTimes(1);
  });

  it('publishLick이 duplicate를 반환하면 "이미 게시한 릭이에요"를 보여준다', async () => {
    publishLick.mockResolvedValue({ ok: false, reason: 'duplicate' });
    render(<Publish user={fakeUser} />);
    const textarea = screen.getByPlaceholderText('공유 URL 또는 해시를 붙여넣으세요');
    fireEvent.change(textarea, { target: { value: validHash } });

    fireEvent.click(screen.getByText('게시'));

    expect(await screen.findByText('이미 게시한 릭이에요')).toBeTruthy();
    expect(navigate).not.toHaveBeenCalled();
  });
});
