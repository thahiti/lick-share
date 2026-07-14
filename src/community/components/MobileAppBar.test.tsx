import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

const navigate = vi.fn<(path: string) => void>();
vi.mock('../routing', () => ({ navigate: (p: string) => navigate(p) }));

// SearchBox가 쓰는 검색 API — 네트워크 차단
vi.mock('../api/search', () => ({
  searchLicks: () => Promise.resolve([]),
  searchUsers: () => Promise.resolve([]),
}));

import { MobileAppBar } from './MobileAppBar';

const fakeUser = { user_metadata: { name: 'Randy' }, email: 'r@x.io' } as unknown as User;

describe('MobileAppBar', () => {
  it('로고 클릭 → / 로 이동', () => {
    render(<MobileAppBar user={null} onSignIn={vi.fn()} onSignOut={vi.fn()} />);
    fireEvent.click(screen.getByText('Lick Share'));
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('아바타 메뉴 항목은 데스크톱과 동일 (My licks / Sign out)', () => {
    render(<MobileAppBar user={fakeUser} onSignIn={vi.fn()} onSignOut={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'R' }));
    expect(screen.getByRole('menuitem', { name: 'My licks' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeTruthy();
  });

  it('돋보기를 탭하면 전체 화면 검색 오버레이가 열리고 입력창에 포커스된다', () => {
    render(<MobileAppBar user={null} onSignIn={vi.fn()} onSignOut={vi.fn()} />);
    expect(screen.queryByRole('searchbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    const box = screen.getByRole('searchbox');
    expect(box).toBeTruthy();
    expect(document.activeElement).toBe(box);
  });

  it('Cancel을 탭하면 오버레이가 닫힌다', () => {
    render(<MobileAppBar user={null} onSignIn={vi.fn()} onSignOut={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('검색으로 이동하면 오버레이가 닫힌다', () => {
    render(<MobileAppBar user={null} onSignIn={vi.fn()} onSignOut={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'blue' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(navigate).toHaveBeenCalledWith('/search?q=blue');
    expect(screen.queryByRole('searchbox')).toBeNull();
  });
});
