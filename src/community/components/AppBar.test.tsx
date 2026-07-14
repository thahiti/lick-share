/** AppBar — 로고·검색(SearchBox)·Create·아바타 드롭다운 (community-layout §5). */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

const navigate = vi.fn<(path: string) => void>();
vi.mock('../routing', () => ({ navigate: (p: string) => navigate(p) }));

import { AppBar } from './AppBar';

const fakeUser = { user_metadata: { name: 'Randy' }, email: 'r@x.io' } as unknown as User;

describe('AppBar', () => {
  it('Create 버튼은 /edit로 이동한다', () => {
    render(<AppBar user={null} onSignIn={vi.fn()} onSignOut={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /create/i }));
    expect(navigate).toHaveBeenCalledWith('/edit');
  });

  it('검색창은 활성 상태이고 placeholder는 실제 검색 대상을 안내한다', () => {
    render(<AppBar user={null} onSignIn={vi.fn()} onSignOut={vi.fn()} />);
    const box = screen.getByRole('searchbox');
    expect(box).toHaveProperty('disabled', false);
    expect(box.getAttribute('placeholder')).toBe('Search licks, tags, users');
  });

  it('로그인 시 아바타는 이니셜을 표시하고, 드롭다운에 My licks/Sign out이 있다', () => {
    const onSignOut = vi.fn();
    render(<AppBar user={fakeUser} onSignIn={vi.fn()} onSignOut={onSignOut} />);
    const avatar = screen.getByRole('button', { name: 'R' });
    expect(avatar).toBeTruthy();
    fireEvent.click(avatar);
    fireEvent.click(screen.getByRole('menuitem', { name: 'My licks' }));
    expect(navigate).toHaveBeenCalledWith('/me');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalled();
  });

  it('비로그인 시 드롭다운은 Sign in을 제공한다', () => {
    const onSignIn = vi.fn();
    render(<AppBar user={null} onSignIn={onSignIn} onSignOut={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '?' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /sign in/i }));
    expect(onSignIn).toHaveBeenCalled();
  });
});
