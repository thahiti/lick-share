/** TopLicks — ranking 상위 5, 실패/빈 목록 시 숨김 (community-layout §5.5). */
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RankingRow } from '../api/licks';

const navigate = vi.fn<(path: string) => void>();
vi.mock('../routing', () => ({ navigate: (p: string) => navigate(p) }));

const fetchRankingPage = vi.fn<(offset: number) => Promise<RankingRow[]>>();
vi.mock('../api/licks', () => ({ fetchRankingPage: (o: number) => fetchRankingPage(o) }));

import { TopLicks } from './TopLicks';

const mk = (n: number): RankingRow[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `r-${i}`,
    title: `Lick ${i}`,
    blob: 'x',
    tags: [],
    created_at: '2026-01-01T00:00:00.000Z',
    author_public_id: 'p',
    author_name: 'A',
    avatar_url: null,
    like_count: 10 - i,
  }));

beforeEach(() => {
  navigate.mockReset();
  fetchRankingPage.mockReset();
});

describe('TopLicks', () => {
  it('상위 5건만 렌더한다', async () => {
    fetchRankingPage.mockResolvedValue(mk(8));
    render(<TopLicks />);
    expect(await screen.findByText('Lick 0')).toBeTruthy();
    expect(screen.getByText('Lick 4')).toBeTruthy();
    expect(screen.queryByText('Lick 5')).toBeNull();
  });

  it('빈 목록이면 위젯을 숨긴다', async () => {
    fetchRankingPage.mockResolvedValue([]);
    const { container } = render(<TopLicks />);
    await waitFor(() => expect(fetchRankingPage).toHaveBeenCalled());
    expect(container.querySelector('.c-toplicks')).toBeNull();
  });

  it('로드 실패 시 위젯을 숨긴다', async () => {
    fetchRankingPage.mockRejectedValue(new Error('nope'));
    const { container } = render(<TopLicks />);
    await waitFor(() => expect(fetchRankingPage).toHaveBeenCalled());
    expect(container.querySelector('.c-toplicks')).toBeNull();
  });

  it('항목 클릭 시 상세로 이동한다', async () => {
    fetchRankingPage.mockResolvedValue(mk(3));
    render(<TopLicks />);
    (await screen.findByText('Lick 1')).click();
    expect(navigate).toHaveBeenCalledWith('/lick/r-1');
  });
});
