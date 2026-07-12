import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api/auth', () => ({
  getSessionUser: () => Promise.resolve(null),
  onAuthChange: () => () => {},
  signInWithGoogle: () => {},
  signOut: () => Promise.resolve(),
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

  it('/ 는 피드 스텁', () => {
    renderAt('/');
    expect(screen.getByText(/최신 — 준비 중/)).toBeTruthy();
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
