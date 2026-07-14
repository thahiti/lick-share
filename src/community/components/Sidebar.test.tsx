/** Sidebar — 내비 활성 표시 + 인기 태그 방어적 렌더 (community-layout §5). */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { LickRow } from '../api/licks';

const navigate = vi.fn<(path: string) => void>();
vi.mock('../routing', async (orig) => ({
  ...(await orig<typeof import('../routing')>()),
  navigate: (p: string) => navigate(p),
}));

const fetchFeedPage = vi.fn<() => Promise<LickRow[]>>();
vi.mock('../api/licks', () => ({ fetchFeedPage: () => fetchFeedPage() }));

import { Sidebar } from './Sidebar';

const fakeUser = {} as User;

beforeEach(() => {
  navigate.mockReset();
  fetchFeedPage.mockReset();
  fetchFeedPage.mockResolvedValue([]);
});

describe('Sidebar', () => {
  it('현재 라우트 내비 항목에 active 클래스를 준다', async () => {
    render(<Sidebar route={{ name: 'ranking' }} user={null} />);
    const active = screen.getByRole('link', { name: /ranking/i });
    expect(active.className).toContain('active');
  });

  it('Create는 Sidebar에 없다 (AppBar·TabBar 전용) — 나머지 순서 Latest→Ranking→My licks', () => {
    render(<Sidebar route={{ name: 'feed' }} user={fakeUser} />);
    expect(screen.queryByRole('link', { name: /create/i })).toBeNull();
    expect(
      screen.getAllByRole('link', { name: /latest|ranking|my licks/i }).map((a) => a.textContent),
    ).toEqual(['Latest', 'Ranking', 'My licks']);
  });

  it('My licks는 로그인 사용자에게만 노출된다', () => {
    const { rerender } = render(<Sidebar route={{ name: 'feed' }} user={null} />);
    expect(screen.queryByRole('link', { name: /my licks/i })).toBeNull();
    rerender(<Sidebar route={{ name: 'feed' }} user={fakeUser} />);
    expect(screen.getByRole('link', { name: /my licks/i })).toBeTruthy();
  });

  it('태그가 있는 피드 행에서 인기 태그 섹션을 렌더한다', async () => {
    fetchFeedPage.mockResolvedValue([
      { tags: ['jazz', 'bebop'] },
      { tags: ['jazz'] },
    ] as unknown as LickRow[]);
    render(<Sidebar route={{ name: 'feed' }} user={null} />);
    expect(await screen.findByText('#jazz')).toBeTruthy();
    expect(screen.getByText('#bebop')).toBeTruthy();
  });

  it('인기 태그를 클릭하면 /tag/:name 으로 이동한다', async () => {
    fetchFeedPage.mockResolvedValue([{ tags: ['jazz'] }] as unknown as LickRow[]);
    render(<Sidebar route={{ name: 'feed' }} user={null} />);
    const link = await screen.findByRole('link', { name: '#jazz' });
    expect(link.getAttribute('href')).toBe('/tag/jazz');
    fireEvent.click(link);
    expect(navigate).toHaveBeenCalledWith('/tag/jazz');
  });

  it('tags가 없는 피드 행(컬럼 미적용)이면 섹션을 렌더하지 않는다', async () => {
    fetchFeedPage.mockResolvedValue([{ id: 'a' }, { id: 'b' }] as unknown as LickRow[]);
    const { container } = render(<Sidebar route={{ name: 'feed' }} user={null} />);
    await waitFor(() => expect(fetchFeedPage).toHaveBeenCalled());
    expect(container.querySelector('.c-sidetags')).toBeNull();
  });
});
