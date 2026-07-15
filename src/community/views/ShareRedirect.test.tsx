/** 단축 공유(/s/:id) — blob 조회 후 자체 완결 열람 URL로 리다이렉트. */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeSong } from '../../core/codec';
import { demoSong } from '../../core/demo-song';
import type { LickRow } from '../api/licks';

const blob = encodeSong(demoSong);

const lick: LickRow = {
  id: 'orig-1',
  title: 'Original lick',
  blob,
  author_id: 'author-1',
  canonical_id: null,
  tags: [],
  created_at: '2026-01-02T00:00:00.000Z',
  profiles: { public_id: 'pub-1', display_name: 'Author A' },
};

const fetchLick = vi.fn<(id: string) => Promise<LickRow | null>>();

vi.mock('../api/licks', () => ({
  fetchLick: (id: string) => fetchLick(id),
}));

import { ShareRedirect } from './ShareRedirect';

afterEach(cleanup);

describe('ShareRedirect', () => {
  beforeEach(() => vi.clearAllMocks());

  it('릭을 찾으면 현재 형식으로 재인코딩한 열람 URL로 리다이렉트', async () => {
    fetchLick.mockResolvedValue(lick);
    const redirect = vi.fn();
    render(<ShareRedirect id="orig-1" redirect={redirect} />);
    await waitFor(() => expect(redirect).toHaveBeenCalledWith(`/?mode=view#${blob}`));
  });

  it('없는 릭이면 에러 상태 표시, 리다이렉트 없음', async () => {
    fetchLick.mockResolvedValue(null);
    const redirect = vi.fn();
    render(<ShareRedirect id="gone" redirect={redirect} />);
    await screen.findByText('Lick not found');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('blob이 깨졌으면 에러 상태 표시, 리다이렉트 없음', async () => {
    fetchLick.mockResolvedValue({ ...lick, blob: 'v1.corrupted' });
    const redirect = vi.fn();
    render(<ShareRedirect id="orig-1" redirect={redirect} />);
    await screen.findByText("Couldn't read this score");
    expect(redirect).not.toHaveBeenCalled();
  });
});
