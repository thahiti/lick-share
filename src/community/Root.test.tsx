import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api/auth', () => ({
  getSessionUser: () => Promise.resolve(null),
  onAuthChange: () => () => {},
  signInWithGoogle: () => {},
  signOut: () => Promise.resolve(),
}));

// Feed(views/Feed.tsx)의 '../api/…' 임포트와 같은 모듈로 해석됨 — 실제 네트워크 차단
// 주의: Feed·Publish·LickDetail·Ranking이 쓰는 export만 구현 — 다른 뷰가 이 모듈을 임포트하게 되면 해당 export를 추가할 것
vi.mock('./api/licks', () => ({
  PAGE_SIZE: 20,
  fetchFeedPage: () => Promise.resolve([]),
  countLicks: () => Promise.resolve(0),
  fetchLick: () => Promise.resolve(null),
  deleteLick: () => Promise.resolve(),
  publishLick: vi.fn(),
  fetchRankingPage: () => Promise.resolve([]),
}));

// 주의: Feed·LickDetail·Ranking이 쓰는 export만 구현 — 다른 뷰가 이 모듈을 임포트하게 되면 해당 export를 추가할 것
vi.mock('./api/likes', () => ({
  canonicalIds: () => [],
  likeTargetId: (l: { id: string; canonical_id: string | null }): string => l.canonical_id ?? l.id,
  fetchLikeCounts: () => Promise.resolve(new Map<string, number>()),
  fetchMyLikedSet: () => Promise.resolve(new Set<string>()),
  addLike: () => Promise.resolve(),
  removeLike: () => Promise.resolve(),
  appendDeduped: <T extends { id: string }>(cur: readonly T[], next: readonly T[]): T[] => [
    ...cur,
    ...next.filter((x) => !cur.some((c) => c.id === x.id)),
  ],
}));

// SearchBox·SearchResults가 쓰는 검색 API — 네트워크 차단
vi.mock('./api/search', () => ({
  searchLicks: () => Promise.resolve([]),
  searchUsers: () => Promise.resolve([]),
}));

import { Root } from './Root';

const fakePlayer = {
  play: vi.fn(),
  stop: vi.fn(),
  isPlaying: () => false,
  onTick: () => () => {},
  onEnded: () => () => {},
  preview: vi.fn(),
  toggleAcc: vi.fn(),
  toggleMetro: vi.fn(),
} as unknown as import('../adapters/player').Player;
const fakeHashStore = { read: () => '', write: () => {} };

const renderAt = (path: string): void => {
  window.history.pushState(null, '', path);
  render(<Root player={fakePlayer} hashStore={fakeHashStore} />);
};

describe('Root 라우팅', () => {
  beforeEach(() => {
    window.history.pushState(null, '', '/');
  });

  it('/ 는 피드 (빈 목록이면 빈 상태 문구)', async () => {
    renderAt('/');
    expect(await screen.findByText(/No licks yet/)).toBeTruthy();
  });

  it('/ranking 은 랭킹 (빈 목록이면 빈 상태 문구)', async () => {
    renderAt('/ranking');
    expect(await screen.findByText(/No rankings yet/)).toBeTruthy();
  });

  it('/tag/:name 은 해당 태그 피드 (#tag 헤더)', async () => {
    renderAt('/tag/bebop');
    expect(await screen.findByRole('heading', { name: '#bebop' })).toBeTruthy();
  });

  it('/search?q= 는 검색 결과 페이지', async () => {
    renderAt('/search?q=zzz');
    expect(await screen.findByText(/No results for/)).toBeTruthy();
  });

  it('알 수 없는 경로는 NotFound', () => {
    renderAt('/zzz');
    expect(screen.getByText(/Page not found/)).toBeTruthy();
  });

  it('모바일 셸: TabBar·MobileAppBar가 있고 구 CommunityHeader가 없다', () => {
    renderAt('/');
    expect(document.querySelector('.c-tabbar')).toBeTruthy();
    expect(document.querySelector('.c-mappbar')).toBeTruthy();
    expect(document.querySelector('.c-header')).toBeNull();
  });

  it('상단 네비에 Publish 링크가 없다 (게시는 에디터 Share에서만)', () => {
    renderAt('/');
    expect(screen.queryByText('Publish')).toBeNull();
  });
});
