/** 유저 페이지 — 프로필 조회 후 이름·피드 렌더, 없으면 안내 문구 (설계 §8.3). */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '../../adapters/player';
import type { Profile } from '../api/profiles';

const fetchProfileByPublicId = vi.fn<(publicId: string) => Promise<Profile | null>>();

vi.mock('../api/profiles', () => ({
  fetchProfileByPublicId: (publicId: string) => fetchProfileByPublicId(publicId),
}));

vi.mock('../api/licks', () => ({
  PAGE_SIZE: 20,
  fetchFeedPage: () => Promise.resolve([]),
}));

vi.mock('../api/likes', () => ({
  canonicalIds: () => [],
  likeTargetId: (l: { id: string; canonical_id: string | null }): string => l.canonical_id ?? l.id,
  fetchLikeCounts: () => Promise.resolve(new Map<string, number>()),
}));

import { UserPage } from './UserPage';

const fakePlayer = {
  play: vi.fn(),
  stop: vi.fn(),
  isPlaying: () => false,
  onTick: () => () => {},
  onEnded: () => () => {},
  preview: vi.fn(),
  toggleAcc: vi.fn(),
  toggleMetro: vi.fn(),
} as unknown as Player;

describe('UserPage 유저 페이지', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('프로필을 찾으면 이름과 피드를 보여준다', async () => {
    fetchProfileByPublicId.mockResolvedValue({
      id: 'u-1',
      public_id: 'pub-1',
      display_name: 'Author A',
      avatar_url: null,
    });

    render(<UserPage publicId="pub-1" player={fakePlayer} />);

    expect(await screen.findByText('Author A')).toBeTruthy();
    expect(fetchProfileByPublicId).toHaveBeenCalledWith('pub-1');
    expect(await screen.findByText('No licks yet')).toBeTruthy();
  });

  it('프로필이 없으면 안내 문구를 보여준다', async () => {
    fetchProfileByPublicId.mockResolvedValue(null);

    render(<UserPage publicId="ghost" player={fakePlayer} />);

    expect(await screen.findByText('User not found')).toBeTruthy();
  });
});
