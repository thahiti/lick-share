import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

const navigate = vi.fn<(path: string) => void>();
vi.mock('../routing', async (orig) => ({
  ...(await orig<typeof import('../routing')>()),
  navigate: (p: string) => navigate(p),
}));

import { TabBar } from './TabBar';

const fakeUser = {} as User;

describe('TabBar', () => {
  it('로그인 시 탭 순서: Latest · Create · Ranking · My licks', () => {
    render(<TabBar route={{ name: 'feed' }} user={fakeUser} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Latest',
      'Create',
      'Ranking',
      'My licks',
    ]);
  });

  it('비로그인 시 My licks 탭이 없다', () => {
    render(<TabBar route={{ name: 'feed' }} user={null} />);
    expect(screen.queryByText('My licks')).toBeNull();
  });

  it('현재 라우트 탭에 active + aria-current=page', () => {
    render(<TabBar route={{ name: 'ranking' }} user={null} />);
    const tab = screen.getByRole('button', { name: 'Ranking' });
    expect(tab.className).toContain('active');
    expect(tab.getAttribute('aria-current')).toBe('page');
  });

  it('탭 클릭 → navigate', () => {
    render(<TabBar route={{ name: 'feed' }} user={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(navigate).toHaveBeenCalledWith('/edit');
  });
});
