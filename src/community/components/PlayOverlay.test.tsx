/**
 * 전체 화면 넘기기 재생 오버레이 (swipe-play 명세 AC-7 ~ AC-18).
 * player 는 가짜 시계와 가짜 싱크로 만든 실제 player 다. IntersectionObserver 는 콜백을 꺼내 수동으로 부른다.
 */
import { useState, type JSX } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createFakeAudioSink, type FakeAudioSink } from '../../adapters/fakes/fake-audio-sink';
import { createFakeClock, type FakeClock } from '../../adapters/fakes/fake-clock';
import { createPlayer, type Player } from '../../adapters/player';
import { encodeSong } from '../../core/codec';
import { demoSong } from '../../core/demo-song';
import { asMidi, type Song } from '../../core/types';
import type { User } from '@supabase/supabase-js';
import type { LickRow } from '../api/licks';
import { PlayOverlay } from './PlayOverlay';

const addLike = vi.fn(async (_id: string) => {});
const removeLike = vi.fn(async (_id: string) => {});
const fetchMyLikedSet = vi.fn(async (_uid: string) => new Set<string>());
vi.mock('../api/likes', async () => {
  const actual = await vi.importActual<typeof import('../api/likes')>('../api/likes');
  return {
    ...actual,
    addLike: (id: string) => addLike(id),
    removeLike: (id: string) => removeLike(id),
    fetchMyLikedSet: (uid: string) => fetchMyLikedSet(uid),
  };
});

/** 첫 음이 서로 다른 세 곡: 어느 곡이 재생되는지 sink 의 첫 melody 로 구분한다 */
const shifted = (semi: number): Song => ({
  ...demoSong,
  notes: demoSong.notes.map((n) => ({ ...n, p: asMidi(n.p + semi) })),
});
const row = (id: string, song: Song, over: Partial<LickRow> = {}): LickRow => ({
  id,
  title: `Lick ${id}`,
  blob: encodeSong(song).replace(/^#/, ''),
  author_id: 'author-1',
  canonical_id: null,
  tags: ['jazz'],
  created_at: '2026-07-17T00:00:00.000Z',
  profiles: { public_id: 'pub-1', display_name: 'Randy' },
  ...over,
});
const rows = [row('a', shifted(0)), row('b', shifted(12)), row('c', shifted(-12))];

type IoCb = (entries: IntersectionObserverEntry[]) => void;
const observers: { cb: IoCb }[] = [];
class IoMock {
  constructor(public cb: IoCb) {
    observers.push(this);
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}
globalThis.IntersectionObserver = IoMock as unknown as typeof IntersectionObserver;

/** i 번째 장이 60% 이상 보이게 됐다고 알린다 (R6) */
const settle = (i: number): void => {
  const page = document.querySelectorAll('.c-play-page')[i];
  if (!page) throw new Error(`장 ${i} 없음`);
  act(() => {
    for (const o of observers)
      o.cb([{ target: page, isIntersecting: true, intersectionRatio: 0.8 } as IntersectionObserverEntry]);
  });
  act(() => {
    vi.advanceTimersByTime(200); // SETTLE_MS 를 넘긴다
  });
};

const SPS = 60 / demoSong.tempo / 4;
const EPOCH = 0.06;

let time: { t: number };
let sink: FakeAudioSink;
let clock: FakeClock;
let player: Player;
let pushState: ReturnType<typeof vi.spyOn>;
let back: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  time = { t: 0 };
  sink = createFakeAudioSink(() => time.t);
  clock = createFakeClock();
  player = createPlayer({ sink, clock });
  pushState = vi.spyOn(window.history, 'pushState');
  back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
  observers.length = 0;
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  addLike.mockClear();
  removeLike.mockClear();
  fetchMyLikedSet.mockClear();
  try {
    localStorage.clear();
  } catch {
    /* jsdom 에서는 항상 된다 */
  }
});
afterEach(() => {
  vi.useRealTimers();
  pushState.mockRestore();
  back.mockRestore();
});

const firstMelodyMidi = (): number | undefined => {
  const e = sink.events.find((ev) => ev.kind === 'melody');
  return e && 'midi' in e ? e.midi : undefined;
};

const mount = (over: Partial<Parameters<typeof PlayOverlay>[0]> = {}) => {
  const onClose = vi.fn();
  const onCount = vi.fn();
  const loadMore = vi.fn(async () => false);
  const utils = render(
    <PlayOverlay
      licks={rows}
      counts={new Map([['a', 3]])}
      startIndex={1}
      hasMore={false}
      loadError={false}
      loadMore={loadMore}
      source="Latest"
      player={player}
      user={null}
      onClose={onClose}
      onCount={onCount}
      {...over}
    />,
  );
  return { ...utils, onClose, onCount, loadMore };
};

describe('PlayOverlay: 열기와 닫기 (swipe-play R4, R5)', () => {
  test('AC-7 마운트하면 history 항목 하나, 시작 인덱스 곡이 0 부터 재생, 카운터', () => {
    mount();
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(player.isPlaying()).toBe(true);
    expect(firstMelodyMidi()).toBe(64 + 12);
    expect(sink.events.find((e) => e.kind === 'melody')?.t).toBe(0);
    expect(screen.getByText('2 / 3')).toBeTruthy();
    expect(screen.getByText('Latest')).toBeTruthy();
  });

  test('AC-11 popstate 가 오면 onClose 와 정지, 닫기 버튼은 history.back', () => {
    const { onClose } = mount();
    fireEvent.click(screen.getByLabelText('Close'));
    expect(back).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(player.isPlaying()).toBe(false);
  });
});

describe('PlayOverlay: 현재 장과 재생 (swipe-play R6 ~ R10)', () => {
  test('AC-8 악보 탭은 멈춤, 다시 탭하면 마지막 tick 의 스텝부터 재개', () => {
    mount();
    time.t = EPOCH + 4 * SPS + 0.01; // 스텝 4 를 지나는 중
    act(() => clock.frame());
    const frame = document.querySelectorAll('.c-play-frame')[1];
    if (!frame) throw new Error('프레임 없음');
    fireEvent.click(frame);
    expect(player.isPlaying()).toBe(false);
    expect(document.querySelector('.c-play-paused')).not.toBeNull();
    fireEvent.click(frame);
    expect(player.isPlaying()).toBe(true);
    // 둘째 곡(+12)의 스텝 4 음은 69+12 이고 세션 시작(t=0)에 온다
    expect(firstMelodyMidi()).toBe(81);
    expect(sink.events.find((e) => e.kind === 'melody')?.t).toBe(0);
    expect(document.querySelector('.c-play-paused')).toBeNull();
  });

  test('AC-9 현재 장이 바뀌면 재생 중일 때만 그 곡을 0 부터 재생', () => {
    mount();
    settle(2);
    expect(screen.getByText('3 / 3')).toBeTruthy();
    expect(firstMelodyMidi()).toBe(64 - 12);
    const frame = document.querySelectorAll('.c-play-frame')[2];
    if (!frame) throw new Error('프레임 없음');
    fireEvent.click(frame); // 멈춤
    settle(0);
    expect(screen.getByText('1 / 3')).toBeTruthy();
    expect(player.isPlaying()).toBe(false);
    expect(sink.events).toHaveLength(0);
  });

  test('AC-10 뒤에서 두 번째 장에 이르면 loadMore 한 번, 진행 중에는 다시 부르지 않음', () => {
    let resolve: ((v: boolean) => void) | null = null;
    const loadMore = vi.fn(() => new Promise<boolean>((r) => (resolve = r)));
    mount({ startIndex: 0, hasMore: true, loadMore });
    expect(loadMore).not.toHaveBeenCalled();
    settle(1);
    expect(loadMore).toHaveBeenCalledTimes(1);
    settle(2);
    expect(loadMore).toHaveBeenCalledTimes(1);
    expect(resolve).not.toBeNull();
  });

  test('E2 불러오기 실패는 마지막 장에 Couldn\'t load more 와 Retry', () => {
    const { loadMore } = mount({ startIndex: 2, hasMore: true, loadError: true });
    expect(screen.getByText("Couldn't load more")).toBeTruthy();
    const calls = loadMore.mock.calls.length;
    fireEvent.click(screen.getByText('Retry'));
    expect(loadMore.mock.calls.length).toBe(calls + 1);
  });

  test('R9 hasMore 가 false 인 마지막 장에는 끝 캡션', () => {
    mount({ startIndex: 2 });
    expect(screen.getByText('This is the last lick in Latest')).toBeTruthy();
  });

  test('AC-13 힌트는 처음 한 번, 장이 바뀌면 사라지고 기록된다', () => {
    const first = mount();
    expect(screen.getByText('Swipe up for the next lick')).toBeTruthy();
    settle(2);
    expect(screen.queryByText('Swipe up for the next lick')).toBeNull();
    expect(localStorage.getItem('swipe-play-hint')).toBe('1');
    first.unmount();
    mount();
    expect(screen.queryByText('Swipe up for the next lick')).toBeNull();
  });

  test('AC-18 읽을 수 없는 blob 의 장은 안내문을 보이고 재생하지 않는다', () => {
    const broken = rows.map((r, i) => (i === 1 ? row('x', shifted(0), { blob: 'not-a-blob' }) : r));
    mount({ licks: broken, startIndex: 0 });
    settle(1);
    expect(screen.getByText("Couldn't read this score")).toBeTruthy();
    expect(player.isPlaying()).toBe(false);
    expect(sink.events).toHaveLength(0);
  });
});

describe('PlayOverlay: 카운트다운 (swipe-play R8)', () => {
  test('AC-16 간격 중에는 남은 박 수와 Again in 이 보이고 끝나면 사라진다', () => {
    mount();
    // 둘째 곡(4마디, 64스텝)이 끝나는 시각
    time.t = EPOCH + 64 * SPS + 0.01;
    act(() => clock.frame());
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('Again in')).toBeTruthy();
    time.t += 4 * SPS; // 한 박
    act(() => clock.frame());
    expect(screen.getByText('3')).toBeTruthy();
    expect(document.querySelectorAll('.c-play-count .on')).toHaveLength(1);
    time.t += 3 * 4 * SPS + 0.01; // 간격 끝
    act(() => clock.frame());
    expect(screen.queryByText('Again in')).toBeNull();
    expect(player.isPlaying()).toBe(true);
  });

  test('R7 카운트다운 중 탭하면 멈추고 재개는 0 부터', () => {
    mount();
    time.t = EPOCH + 64 * SPS + 0.01;
    act(() => clock.frame());
    const frame = document.querySelectorAll('.c-play-frame')[1];
    if (!frame) throw new Error('프레임 없음');
    fireEvent.click(frame);
    expect(player.isPlaying()).toBe(false);
    expect(screen.queryByText('Again in')).toBeNull();
    fireEvent.click(frame);
    expect(firstMelodyMidi()).toBe(76);
  });
});

describe('PlayOverlay: 액션 (swipe-play R11, R12)', () => {
  const likeOn = (i: number): Element => {
    const btn = document.querySelectorAll('.c-play-page')[i]?.querySelector('.c-like');
    if (!btn) throw new Error('좋아요 버튼 없음');
    return btn;
  };

  test('AC-14 비로그인 좋아요는 Sign in to like 토스트만', () => {
    mount();
    fireEvent.click(likeOn(1));
    expect(screen.getByText('Sign in to like')).toBeTruthy();
    expect(addLike).not.toHaveBeenCalled();
  });

  test('AC-14 로그인 좋아요는 addLike 와 onCount, 실패하면 되돌리고 Like failed', async () => {
    const user = { id: 'u1' } as unknown as User;
    const onCount = vi.fn();
    // FeedList 처럼 onCount 결과를 counts 로 되돌려 준다
    const Host = (): JSX.Element => {
      const [counts, setCounts] = useState(new Map([['b', 2]]));
      return (
        <PlayOverlay
          licks={rows}
          counts={counts}
          startIndex={1}
          hasMore={false}
          loadError={false}
          loadMore={async () => false}
          source="Latest"
          player={player}
          user={user}
          onClose={() => {}}
          onCount={(t, c) => {
            onCount(t, c);
            setCounts((prev) => new Map(prev).set(t, c));
          }}
        />
      );
    };
    render(<Host />);
    await act(async () => {});
    expect(fetchMyLikedSet).toHaveBeenCalledWith('u1');
    await act(async () => {
      fireEvent.click(likeOn(1));
    });
    expect(addLike).toHaveBeenCalledWith('b');
    expect(onCount).toHaveBeenCalledWith('b', 3);

    removeLike.mockRejectedValueOnce(new Error('network'));
    await act(async () => {
      fireEvent.click(likeOn(1));
    });
    expect(removeLike).toHaveBeenCalledWith('b');
    expect(screen.getByText('Like failed')).toBeTruthy();
    expect(onCount).toHaveBeenLastCalledWith('b', 3); // 2 로 내렸다가 되돌림
  });

  test('R11 공유는 /s/:id 를 클립보드에 넣고 Link copied', async () => {
    const writeText = vi.fn(async (_t: string) => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    mount();
    const share = document.querySelectorAll('.c-play-page')[1]?.querySelector('.c-play-share');
    if (!share) throw new Error('공유 버튼 없음');
    await act(async () => {
      fireEvent.click(share);
    });
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/s/b`);
    expect(screen.getByText('Link copied')).toBeTruthy();
  });

  test('AC-15 복제 편집은 정지하고 오버레이 항목을 /edit 로 바꾼다', () => {
    const replace = vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    const { onClose } = mount();
    const dup = document.querySelectorAll('.c-play-page')[1]?.querySelector('.c-play-dup');
    if (!dup) throw new Error('복제 버튼 없음');
    fireEvent.click(dup);
    expect(player.isPlaying()).toBe(false);
    expect(replace).toHaveBeenCalledWith(null, '', '/edit#' + rows[1]?.blob);
    expect(pushState).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled(); // 라우트 전환이 언마운트한다
    replace.mockRestore();
  });

  test('R12 작성자와 태그는 링크가 아니다', () => {
    mount();
    expect(document.querySelector('.c-play-meta a')).toBeNull();
    expect(document.querySelector('.c-play-tags a, .c-play-tags button')).toBeNull();
  });
});

describe('PlayOverlay: 키보드와 데스크톱 (swipe-play R4, R13)', () => {
  const root = (): Element => {
    const el = document.querySelector('.c-play');
    if (!el) throw new Error('오버레이 없음');
    return el;
  };

  test('AC-12 Esc 는 history.back, 방향키는 페이저를 장 높이만큼 스크롤, Space 는 토글', () => {
    const scrollBy = vi.fn();
    Element.prototype.scrollBy = scrollBy as unknown as Element['scrollBy'];
    mount();
    fireEvent.keyDown(root(), { key: 'Escape' });
    expect(back).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(root(), { key: 'ArrowDown' });
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ behavior: 'smooth' }));
    fireEvent.keyDown(root(), { key: 'ArrowUp' });
    expect(scrollBy).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(root(), { key: ' ' });
    expect(player.isPlaying()).toBe(false);
    fireEvent.keyDown(root(), { key: ' ' });
    expect(player.isPlaying()).toBe(true);
  });

  test('R13 열리면 닫기 버튼에 포커스', () => {
    mount();
    expect(document.activeElement).toBe(screen.getByLabelText('Close'));
  });

  test('R4 스크림(배경 자체) 클릭은 history.back, 패널 안 클릭은 아니다', () => {
    mount();
    fireEvent.click(root());
    expect(back).toHaveBeenCalledTimes(1);
    const panel = document.querySelector('.c-play-panel');
    if (!panel) throw new Error('패널 없음');
    fireEvent.click(panel);
    expect(back).toHaveBeenCalledTimes(1);
  });
});
