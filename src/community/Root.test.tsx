import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api/auth', () => ({
  getSessionUser: () => Promise.resolve(null),
  onAuthChange: () => () => {},
  signInWithGoogle: () => {},
  signOut: () => Promise.resolve(),
}));

// Feed(views/Feed.tsx)의 '../api/…' 임포트와 같은 모듈로 해석됨 — 실제 네트워크 차단
// 주의: Feed·Publish가 쓰는 export만 구현 — 다른 뷰가 이 모듈을 임포트하게 되면 해당 export를 추가할 것
vi.mock('./api/licks', () => ({
  PAGE_SIZE: 20,
  fetchFeedPage: () => Promise.resolve([]),
  deleteLick: () => Promise.resolve(),
  publishLick: vi.fn(),
}));

// 주의: Feed가 쓰는 export만 구현 — 다른 뷰가 이 모듈을 임포트하게 되면 해당 export를 추가할 것
vi.mock('./api/likes', () => ({
  canonicalIds: () => [],
  likeTargetId: (l: { id: string; canonical_id: string | null }): string => l.canonical_id ?? l.id,
  fetchLikeCounts: () => Promise.resolve(new Map<string, number>()),
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
    expect(await screen.findByText(/아직 게시된 릭이 없어요/)).toBeTruthy();
  });

  it('/ranking 은 랭킹 스텁', () => {
    renderAt('/ranking');
    expect(screen.getByText(/랭킹 — 준비 중/)).toBeTruthy();
  });

  it('알 수 없는 경로는 NotFound', () => {
    renderAt('/zzz');
    expect(screen.getByText(/없는 페이지/)).toBeTruthy();
  });
});
