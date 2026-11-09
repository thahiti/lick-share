/** 내 릭 — 표시 이름 머리글 + 내 피드. 이름을 바꾸면 카드의 작성자 이름도 맞도록 피드를 다시 불러온다. */
import { StrictMode, useEffect } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { Player } from '../../adapters/player';
import type { Profile, RenameResult } from '../api/profiles';

const fetchProfileById = vi.fn<(id: string) => Promise<Profile | null>>();
const updateDisplayName = vi.fn<(id: string, name: string) => Promise<RenameResult>>();
vi.mock('../api/profiles', () => ({
  fetchProfileById: (id: string) => fetchProfileById(id),
  updateDisplayName: (id: string, name: string) => updateDisplayName(id, name),
}));

// Feed는 자체 테스트가 있다 — 여기서는 어떤 authorId로 몇 번 마운트되는지만 본다
let feedMounts = 0;
vi.mock('./Feed', () => ({
  Feed: ({ authorId }: { authorId: string }) => {
    useEffect(() => {
      feedMounts += 1;
    }, []);
    return <div data-testid="feed">{authorId}</div>;
  },
}));

import { MyLicks } from './MyLicks';

const fakeUser = { id: 'user-1' } as unknown as User;
const fakePlayer = {} as unknown as Player;
const profile: Profile = {
  id: 'user-1',
  public_id: 'pub-1',
  display_name: 'Old Name',
  avatar_url: null,
};

describe('MyLicks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    feedMounts = 0;
    fetchProfileById.mockResolvedValue(profile);
    updateDisplayName.mockResolvedValue({ ok: true });
  });

  it('비로그인: 로그인 안내만', () => {
    render(<MyLicks user={null} player={fakePlayer} />);
    expect(screen.getByText('Sign in required')).toBeTruthy();
    expect(screen.queryByTestId('feed')).toBeNull();
    expect(fetchProfileById).not.toHaveBeenCalled();
  });

  it('로그인: 내 프로필 이름을 머리글에, 피드는 내 id로 (StrictMode에서도 프로필 조회 1회)', async () => {
    render(
      <StrictMode>
        <MyLicks user={fakeUser} player={fakePlayer} />
      </StrictMode>,
    );
    expect(await screen.findByText('Old Name')).toBeTruthy();
    expect(screen.getByTestId('feed').textContent).toBe('user-1');
    expect(fetchProfileById).toHaveBeenCalledTimes(1);
    expect(fetchProfileById).toHaveBeenCalledWith('user-1');
  });

  it('이름을 저장하면 내 id로 updateDisplayName을 부르고 머리글이 바뀌며 피드를 다시 마운트한다', async () => {
    render(<MyLicks user={fakeUser} player={fakePlayer} />);
    await screen.findByText('Old Name');
    const mountsBefore = feedMounts;

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New Name' } });
    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText('New Name')).toBeTruthy();
    expect(updateDisplayName).toHaveBeenCalledWith('user-1', 'New Name');
    expect(feedMounts).toBe(mountsBefore + 1);
  });

  it('저장이 거절되면 머리글 이름은 그대로고 피드도 다시 마운트하지 않는다', async () => {
    updateDisplayName.mockResolvedValue({ ok: false, reason: 'taken' });
    render(<MyLicks user={fakeUser} player={fakePlayer} />);
    await screen.findByText('Old Name');
    const mountsBefore = feedMounts;

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Dup' } });
    fireEvent.click(screen.getByText('Save'));

    expect(await screen.findByText('Already taken')).toBeTruthy();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.getByText('Old Name')).toBeTruthy();
    expect(feedMounts).toBe(mountsBefore);
  });
});
