/** 아바타 드롭다운 — 항목을 고르거나 메뉴 밖을 누르면 닫힌다. 앱바는 화면이 바뀌어도 남아 있어 메뉴가 스스로 닫혀야 한다. */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

const navigate = vi.fn<(path: string) => void>();
vi.mock('../routing', () => ({ navigate: (p: string) => navigate(p) }));

import { AvatarMenu } from './AvatarMenu';

const fakeUser = { user_metadata: { name: 'Randy' }, email: 'r@x.io' } as unknown as User;

const openMenu = (user: User | null = fakeUser, onSignOut = vi.fn(), onSignIn = vi.fn()) => {
  render(<AvatarMenu user={user} onSignIn={onSignIn} onSignOut={onSignOut} />);
  fireEvent.click(screen.getByRole('button', { name: user ? 'R' : '?' }));
  expect(screen.getByRole('menu')).toBeTruthy();
};

describe('AvatarMenu', () => {
  beforeEach(() => vi.clearAllMocks());

  it('My licks를 누르면 /me로 이동하고 메뉴가 닫힌다', () => {
    openMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'My licks' }));
    expect(navigate).toHaveBeenCalledWith('/me');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Sign out을 누르면 onSignOut이 불리고 메뉴가 닫힌다', () => {
    const onSignOut = vi.fn();
    openMenu(fakeUser, onSignOut);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Sign in을 누르면 onSignIn이 불리고 메뉴가 닫힌다', () => {
    const onSignIn = vi.fn();
    openMenu(null, vi.fn(), onSignIn);
    fireEvent.click(screen.getByRole('menuitem', { name: /sign in/i }));
    expect(onSignIn).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('메뉴 밖을 누르면 닫힌다', () => {
    openMenu();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('메뉴 안을 눌러도 닫히지 않는다', () => {
    openMenu();
    fireEvent.pointerDown(screen.getByRole('menu'));
    expect(screen.getByRole('menu')).toBeTruthy();
  });
});
