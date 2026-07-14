/** SearchBox — 디바운스 제안 + 키보드 내비 + /search 이동 (tag-search 설계 §3~4). */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LickRow } from '../api/licks';
import type { ProfileHit } from '../api/search';

const navigate = vi.fn<(path: string) => void>();
vi.mock('../routing', async (orig) => ({
  ...(await orig<typeof import('../routing')>()),
  navigate: (p: string) => navigate(p),
}));

const searchLicks = vi.fn<(q: string, opts: { limit: number }) => Promise<LickRow[]>>();
const searchUsers = vi.fn<(q: string, limit: number) => Promise<ProfileHit[]>>();
vi.mock('../api/search', () => ({
  searchLicks: (q: string, opts: { limit: number }) => searchLicks(q, opts),
  searchUsers: (q: string, limit: number) => searchUsers(q, limit),
}));

import { SearchBox } from './SearchBox';

const lickHit = (id: string, title: string): LickRow =>
  ({ id, title, tags: [], canonical_id: null }) as unknown as LickRow;
const userHit = (publicId: string, name: string): ProfileHit => ({
  public_id: publicId,
  display_name: name,
  avatar_url: null,
});

const type = (value: string): void => {
  fireEvent.change(screen.getByRole('searchbox'), { target: { value } });
};

/** 디바운스 경과 + 마이크로태스크 플러시 */
const settle = async (ms = 300): Promise<void> => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
    await Promise.resolve();
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  navigate.mockReset();
  searchLicks.mockReset().mockResolvedValue([]);
  searchUsers.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('SearchBox', () => {
  it('2자 미만이면 질의하지 않는다', async () => {
    render(<SearchBox />);
    type('b');
    await settle();
    expect(searchLicks).not.toHaveBeenCalled();
    expect(searchUsers).not.toHaveBeenCalled();
  });

  it('디바운스 300ms — 연속 타이핑은 마지막 값으로 1회만 질의한다', async () => {
    render(<SearchBox />);
    type('bl');
    await settle(150);
    type('blu');
    await settle(150);
    expect(searchLicks).not.toHaveBeenCalled();
    await settle(150);
    expect(searchLicks).toHaveBeenCalledTimes(1);
    expect(searchLicks).toHaveBeenCalledWith('blu', { limit: 5 });
    expect(searchUsers).toHaveBeenCalledWith('blu', 5);
  });

  it('제안을 Licks/Users 섹션으로 렌더한다', async () => {
    searchLicks.mockResolvedValue([lickHit('l1', 'Blue Bossa')]);
    searchUsers.mockResolvedValue([userHit('u1', 'blue note')]);
    render(<SearchBox />);
    type('blue');
    await settle();
    expect(screen.getByText('Blue Bossa')).toBeTruthy();
    expect(screen.getByText('blue note')).toBeTruthy();
  });

  it('제안 클릭 → 해당 릭/유저로 직행하고 드롭다운이 닫힌다', async () => {
    searchLicks.mockResolvedValue([lickHit('l1', 'Blue Bossa')]);
    searchUsers.mockResolvedValue([userHit('u1', 'blue note')]);
    render(<SearchBox />);
    type('blue');
    await settle();
    fireEvent.click(screen.getByText('Blue Bossa'));
    expect(navigate).toHaveBeenCalledWith('/lick/l1');
    expect(screen.queryByText('blue note')).toBeNull();

    type('blues');
    await settle();
    fireEvent.click(screen.getByText('blue note'));
    expect(navigate).toHaveBeenCalledWith('/user/u1');
  });

  it('Enter → /search?q= 로 이동하고 드롭다운을 닫는다', async () => {
    searchLicks.mockResolvedValue([lickHit('l1', 'Blue Bossa')]);
    render(<SearchBox />);
    type('blue note');
    await settle();
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' });
    expect(navigate).toHaveBeenCalledWith('/search?q=' + encodeURIComponent('blue note'));
    expect(screen.queryByText('Blue Bossa')).toBeNull();
  });

  it('↓로 항목을 선택한 뒤 Enter → 선택 항목으로 이동한다', async () => {
    searchLicks.mockResolvedValue([lickHit('l1', 'Blue Bossa')]);
    searchUsers.mockResolvedValue([userHit('u1', 'blue note')]);
    render(<SearchBox />);
    type('blue');
    await settle();
    const input = screen.getByRole('searchbox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(navigate).toHaveBeenCalledWith('/user/u1');
  });

  it('입력을 지워 2자 미만이 되면 드롭다운이 닫힌다', async () => {
    searchLicks.mockResolvedValue([lickHit('l1', 'Blue Bossa')]);
    render(<SearchBox />);
    type('blue');
    await settle();
    expect(screen.getByText('Blue Bossa')).toBeTruthy();
    type('b');
    expect(screen.queryByText('Blue Bossa')).toBeNull();
  });

  it('Escape → 드롭다운만 닫는다 (열려 있으면 네이티브 텍스트 클리어를 막는다)', async () => {
    searchLicks.mockResolvedValue([lickHit('l1', 'Blue Bossa')]);
    render(<SearchBox />);
    type('blue');
    await settle();
    // 드롭다운 열림 → preventDefault로 Chrome의 search input 클리어를 차단
    const notPrevented = fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
    expect(notPrevented).toBe(false);
    expect(screen.queryByText('Blue Bossa')).toBeNull();
    // 드롭다운이 이미 닫혀 있으면 네이티브 동작(텍스트 클리어)에 맡긴다
    expect(fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })).toBe(true);
  });

  it('이동이 일어나면 onNavigated를 호출한다 (모바일 오버레이 닫기용)', async () => {
    const onNavigated = vi.fn();
    render(<SearchBox onNavigated={onNavigated} />);
    type('blue');
    await settle();
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' });
    expect(navigate).toHaveBeenCalledWith('/search?q=blue');
    expect(onNavigated).toHaveBeenCalledTimes(1);
  });

  it('늦게 도착한 이전 질의 응답은 무시한다 (역전 가드)', async () => {
    let resolveOld: (rows: LickRow[]) => void = () => {};
    searchLicks.mockImplementationOnce(
      () => new Promise<LickRow[]>((r) => (resolveOld = r)),
    );
    render(<SearchBox />);
    type('old');
    await settle();
    searchLicks.mockResolvedValue([lickHit('l2', 'New Hit')]);
    type('new query');
    await settle();
    expect(screen.getByText('New Hit')).toBeTruthy();
    await act(async () => {
      resolveOld([lickHit('l1', 'Stale Hit')]);
      await Promise.resolve();
    });
    expect(screen.queryByText('Stale Hit')).toBeNull();
    expect(screen.getByText('New Hit')).toBeTruthy();
  });
});
