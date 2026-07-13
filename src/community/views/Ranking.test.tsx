/** 랭킹 — offset 무한 스크롤 첫 페이지, 좋아요 내림차순 순위 (설계 §8.1, §8.5). */
import { StrictMode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '../../adapters/player';
import type { RankingRow } from '../api/licks';

const row = (over: Partial<RankingRow> & Pick<RankingRow, 'id' | 'title'>): RankingRow => ({
  blob: 'invalid-blob',
  created_at: '2026-01-02T00:00:00.000Z',
  author_public_id: 'pub-1',
  author_name: 'Author A',
  avatar_url: null,
  like_count: 0,
  ...over,
});

const first = row({ id: 'r-1', title: 'Popular lick', like_count: 9 });
const second = row({
  id: 'r-2',
  title: 'Second lick',
  like_count: 3,
  author_public_id: 'pub-2',
  author_name: 'Author B',
});

const fetchRankingPage = vi.fn<(offset: number) => Promise<RankingRow[]>>();

vi.mock('../api/licks', () => ({
  PAGE_SIZE: 20,
  fetchRankingPage: (offset: number) => fetchRankingPage(offset),
}));

// appendDeduped(../api/likes)는 실제 구현을 그대로 쓴다 — supabase는 import 시점에 지연 프록시라 안전.

import { Ranking } from './Ranking';

const fakePlayer = {
  play: vi.fn(),
  stop: vi.fn(),
  isPlaying: () => false,
  onTick: () => () => {},
  onEnded: () => () => {},
  preview: vi.fn(),
  toggleAcc: vi.fn(),
  toggleMetro: vi.fn(),
} as unknown as Player;

describe('Ranking 랭킹', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchRankingPage.mockResolvedValue([first, second]);
  });

  it('마운트 시 offset 0으로 첫 페이지를 불러와 좋아요 내림차순 순위를 보여준다', async () => {
    render(<Ranking player={fakePlayer} />);

    expect(await screen.findByText('Popular lick')).toBeTruthy();
    expect(screen.getByText('Second lick')).toBeTruthy();

    // 순위 뱃지는 숫자만 표시 (1~3위는 amber 강조 클래스)
    const badge1 = screen.getByText('1', { selector: '.c-rankbadge' });
    expect(badge1.className).toContain('top');
    expect(screen.getByText('2', { selector: '.c-rankbadge' })).toBeTruthy();
    expect(screen.getByText('♥ 9')).toBeTruthy();
    expect(screen.getByText('♥ 3')).toBeTruthy();

    expect(fetchRankingPage).toHaveBeenCalledWith(0);
  });

  it('StrictMode 이중 이펙트에서도 첫 페이지 요청은 정확히 1회', async () => {
    render(
      <StrictMode>
        <Ranking player={fakePlayer} />
      </StrictMode>,
    );

    expect(await screen.findByText('Popular lick')).toBeTruthy();
    expect(fetchRankingPage).toHaveBeenCalledTimes(1);
  });

  it('빈 목록이면 안내 문구를 보여준다', async () => {
    fetchRankingPage.mockResolvedValue([]);
    render(<Ranking player={fakePlayer} />);

    expect(await screen.findByText('No rankings yet')).toBeTruthy();
  });

  it('첫 페이지 로드 실패 시 에러 안내와 재시도 버튼을 보여주고, 재시도 성공 시 목록이 렌더된다', async () => {
    fetchRankingPage.mockRejectedValueOnce(new Error('network down'));

    render(<Ranking player={fakePlayer} />);

    expect(await screen.findByText("Couldn't load the list")).toBeTruthy();
    const retry = screen.getByRole('button', { name: 'Retry' });

    fetchRankingPage.mockResolvedValueOnce([first, second]);
    fireEvent.click(retry);

    expect(await screen.findByText('Popular lick')).toBeTruthy();
    expect(screen.queryByText("Couldn't load the list")).toBeNull();
  });
});
