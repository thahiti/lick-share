/** 최신 피드 — 첫 페이지 마운트 로드, 좋아요 수는 원본 기준, 유사릭 배지 (설계 §8.2, §7). */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LickRow } from '../api/licks';

const original: LickRow = {
  id: 'orig-1',
  title: '오리지널 릭',
  blob: 'invalid-blob',
  author_id: 'author-1',
  canonical_id: null,
  created_at: '2026-01-02T00:00:00.000Z',
  profiles: { public_id: 'pub-1', display_name: '작성자A' },
};

const similar: LickRow = {
  id: 'sim-1',
  title: '유사한 릭',
  blob: 'invalid-blob',
  author_id: 'author-2',
  canonical_id: 'orig-1',
  created_at: '2026-01-01T00:00:00.000Z',
  profiles: { public_id: 'pub-2', display_name: '작성자B' },
};

const fetchFeedPage = vi.fn(async () => [original, similar]);
const deleteLick = vi.fn(async () => {});
const fetchLikeCounts = vi.fn(async () => new Map([['orig-1', 7]]));

vi.mock('../api/licks', () => ({
  PAGE_SIZE: 20,
  fetchFeedPage: (...args: unknown[]) => fetchFeedPage(...(args as [])),
  deleteLick: (...args: unknown[]) => deleteLick(...(args as [])),
}));

vi.mock('../api/likes', () => ({
  canonicalIds: (ls: readonly { id: string; canonical_id: string | null }[]): string[] => [
    ...new Set(ls.map((l) => l.canonical_id ?? l.id)),
  ],
  likeTargetId: (l: { id: string; canonical_id: string | null }): string => l.canonical_id ?? l.id,
  fetchLikeCounts: (...args: unknown[]) => fetchLikeCounts(...(args as [])),
}));

import { Feed } from './Feed';

describe('Feed 최신 피드', () => {
  it('마운트 시 첫 페이지를 로드해 카드 2개 · 원본 기준 좋아요 수 · 유사릭 배지를 보여준다', async () => {
    render(<Feed />);

    expect(await screen.findByText('오리지널 릭')).toBeTruthy();
    expect(screen.getByText('유사한 릭')).toBeTruthy();

    // 좋아요 수는 canonical(원본) 기준 — 유사릭도 원본의 카운트를 그대로 표시
    expect(screen.getAllByText('♥ 7')).toHaveLength(2);

    // 유사릭(canonical_id 존재)만 배지 표시
    expect(screen.getByText('유사릭')).toBeTruthy();

    expect(fetchFeedPage).toHaveBeenCalledWith(null, undefined);
    expect(fetchLikeCounts).toHaveBeenCalledWith(['orig-1']);
  });
});
