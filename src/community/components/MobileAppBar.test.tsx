import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

const navigate = vi.fn<(path: string) => void>();
vi.mock('../routing', () => ({ navigate: (p: string) => navigate(p) }));

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
});
