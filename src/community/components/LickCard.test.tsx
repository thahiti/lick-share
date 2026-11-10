/** 릭 카드의 재생 버튼 (swipe-play R3). 카드 본문 탭은 상세 이동, 재생 버튼은 onPlay 만. */
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { encodeSong } from '../../core/codec';
import { demoSong } from '../../core/demo-song';
import type { LickRow } from '../api/licks';
import { LickCard } from './LickCard';

const navigate = vi.fn();
vi.mock('../routing', () => ({ navigate: (path: string) => navigate(path) }));

const row: LickRow = {
  id: 'lick-1',
  title: 'Spring Sketch',
  blob: encodeSong(demoSong).replace(/^#/, ''),
  author_id: 'author-1',
  canonical_id: null,
  tags: [],
  created_at: '2026-07-17T00:00:00.000Z',
  profiles: { public_id: 'pub-1', display_name: 'Randy' },
};

describe('LickCard: 재생 버튼 (swipe-play R3)', () => {
  test('AC-5 onPlay 가 있으면 Play 버튼이 있고 누르면 onPlay 만 불린다', () => {
    const onPlay = vi.fn();
    const { container } = render(<LickCard lick={row} likeCount={0} onPlay={onPlay} />);
    const btn = container.querySelector('button[aria-label="Play"]');
    if (!btn) throw new Error('재생 버튼 없음');
    fireEvent.click(btn);
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    // 버튼 속 버튼이 아니어야 한다
    expect(btn.closest('.c-cardhit')).toBeNull();
  });

  test('AC-6 onPlay 가 없으면 Play 버튼이 없다', () => {
    const { container } = render(<LickCard lick={row} likeCount={0} />);
    expect(container.querySelector('button[aria-label="Play"]')).toBeNull();
  });
});
