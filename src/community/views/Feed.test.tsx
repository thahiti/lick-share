/** 최신 피드 — 첫 페이지 마운트 로드, 좋아요 수는 원본 기준, 유사릭 배지 (설계 §8.2, §7). */
import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { createFakeAudioSink } from '../../adapters/fakes/fake-audio-sink';
import { createFakeClock } from '../../adapters/fakes/fake-clock';
import { createPlayer } from '../../adapters/player';
import { encodeSong } from '../../core/codec';
import { demoSong } from '../../core/demo-song';
import type { LickRow } from '../api/licks';
import { feedStore, type FeedSnapshot } from '../feed-store';
import type { NavKind } from '../routing';

// 오버레이가 실제로 재생하므로 가짜 싱크와 시계로 만든 진짜 player 를 쓴다
const fakePlayer = createPlayer({ sink: createFakeAudioSink(), clock: createFakeClock() });

const lick = (over: Partial<LickRow> & Pick<LickRow, 'id' | 'title'>): LickRow => ({
  blob: 'invalid-blob',
  author_id: 'author-1',
  canonical_id: null,
  tags: [],
  created_at: '2026-01-02T00:00:00.000Z',
  profiles: { public_id: 'pub-1', display_name: 'Author A' },
  ...over,
});

const original = lick({ id: 'orig-1', title: 'Original lick' });
const similar = lick({
  id: 'sim-1',
  title: 'Similar lick',
  author_id: 'author-2',
  canonical_id: 'orig-1',
  created_at: '2026-01-01T00:00:00.000Z',
  profiles: { public_id: 'pub-2', display_name: 'Author B' },
});

type FeedFilter = { authorId?: string; tag?: string };
const fetchFeedPage = vi.fn<(cursor: string | null, filter?: FeedFilter) => Promise<LickRow[]>>();
const countLicks = vi.fn<(filter?: FeedFilter) => Promise<number>>();
const deleteLick = vi.fn(async (_id: string) => {});
const fetchLikeCounts = vi.fn(async (_ids: readonly string[]) => new Map<string, number>());

vi.mock('../api/licks', () => ({
  PAGE_SIZE: 20,
  fetchFeedPage: (cursor: string | null, filter?: FeedFilter) => fetchFeedPage(cursor, filter),
  countLicks: (filter?: FeedFilter) => countLicks(filter),
  deleteLick: (id: string) => deleteLick(id),
}));

const addLike = vi.fn(async (_id: string) => {});
vi.mock('../api/likes', () => ({
  canonicalIds: (ls: readonly { id: string; canonical_id: string | null }[]): string[] => [
    ...new Set(ls.map((l) => l.canonical_id ?? l.id)),
  ],
  likeTargetId: (l: { id: string; canonical_id: string | null }): string => l.canonical_id ?? l.id,
  fetchLikeCounts: (ids: readonly string[]) => fetchLikeCounts(ids),
  fetchMyLikedSet: async (_uid: string) => new Set<string>(),
  addLike: (id: string) => addLike(id),
  removeLike: async (_id: string) => {},
}));

// 전환 종류는 테스트마다 정한다 (feed-cache R3, R5)
const navKind = vi.fn<() => NavKind>();
vi.mock('../routing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../routing')>()),
  lastNavKind: () => navKind(),
}));

import { Feed } from './Feed';

// 저장소는 모듈 수준이라 앞 테스트의 언마운트가 남긴 스냅샷을 지운다
beforeEach(() => {
  feedStore.clear();
  navKind.mockReturnValue('history');
});

describe('Feed 최신 피드', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchFeedPage.mockResolvedValue([original, similar]);
    fetchLikeCounts.mockResolvedValue(new Map([['orig-1', 7]]));
  });

  it('마운트 시 첫 페이지를 로드해 카드 2개 · 원본 기준 좋아요 수 · 유사릭 배지를 보여준다', async () => {
    render(<Feed player={fakePlayer} user={null} />);

    expect(await screen.findByText('Original lick')).toBeTruthy();
    expect(screen.getByText('Similar lick')).toBeTruthy();

    // 좋아요 수는 canonical(원본) 기준 — 유사릭도 원본의 카운트를 그대로 표시
    expect(screen.getAllByText('♥ 7')).toHaveLength(2);

    // 유사릭(canonical_id 존재)만 배지 표시
    expect(screen.getByText('similar')).toBeTruthy();

    expect(fetchFeedPage).toHaveBeenCalledWith(null, { authorId: undefined });
    expect(fetchLikeCounts).toHaveBeenCalledWith(['orig-1']);
  });

  it('태그가 있는 카드는 칩을 렌더하고, 없는 카드는 칩을 렌더하지 않는다', async () => {
    const tagged = lick({ id: 'tag-1', title: 'Tagged lick', tags: ['jazz', 'blues'] });
    fetchFeedPage.mockResolvedValue([tagged, original]);

    render(<Feed player={fakePlayer} user={null} />);

    expect(await screen.findByText('#jazz')).toBeTruthy();
    expect(screen.getByText('#blues')).toBeTruthy();
    // original(tags: [])은 칩이 없으므로 칩은 tagged의 2개뿐
    expect(document.querySelectorAll('.c-tag')).toHaveLength(2);
  });

  it('정렬 pill(Latest/Popular)이 없다 — Ranking은 내비 메뉴 전용', async () => {
    render(<Feed player={fakePlayer} user={null} />);
    await screen.findByText('Original lick');
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByText('Popular')).toBeNull();
  });

  it('StrictMode 이중 이펙트에서도 첫 페이지 요청은 정확히 1회', async () => {
    render(
      <StrictMode>
        <Feed player={fakePlayer} user={null} />
      </StrictMode>,
    );

    expect(await screen.findByText('Original lick')).toBeTruthy();
    expect(screen.getAllByText('Original lick')).toHaveLength(1);
    expect(fetchFeedPage).toHaveBeenCalledTimes(1);
  });

  it('authorId가 바뀌면 상태를 초기화하고 새 작성자의 첫 페이지만 보여준다', async () => {
    const a1Lick = lick({ id: 'a1-1', title: "A1's lick", author_id: 'a1' });
    const a2Lick = lick({ id: 'a2-1', title: "A2's lick", author_id: 'a2' });
    fetchFeedPage.mockImplementation(async (_cursor, filter) =>
      filter?.authorId === 'a2' ? [a2Lick] : [a1Lick],
    );

    const { rerender } = render(<Feed player={fakePlayer} user={null} authorId="a1" />);
    expect(await screen.findByText("A1's lick")).toBeTruthy();

    rerender(<Feed player={fakePlayer} user={null} authorId="a2" />);
    expect(await screen.findByText("A2's lick")).toBeTruthy();

    // 이전 작성자 목록에 append되지 않고 완전히 교체됨
    expect(screen.queryByText("A1's lick")).toBeNull();

    // 새 작성자의 첫 페이지는 커서 null부터 다시 시작
    expect(fetchFeedPage).toHaveBeenLastCalledWith(null, { authorId: 'a2' });
  });

  it('tag prop이 있으면 fetch 필터로 전달하고 #tag 헤더와 릭 개수를 렌더한다', async () => {
    fetchFeedPage.mockResolvedValue([original]);
    countLicks.mockResolvedValue(3);

    render(<Feed player={fakePlayer} user={null} tag="bebop" />);

    expect(await screen.findByRole('heading', { name: '#bebop' })).toBeTruthy();
    expect(await screen.findByText('3 licks')).toBeTruthy();
    expect(fetchFeedPage).toHaveBeenCalledWith(null, { authorId: undefined, tag: 'bebop' });
    expect(countLicks).toHaveBeenCalledWith({ tag: 'bebop' });
  });

  it('tag 개수 조회가 실패해도 헤더는 뜨고 개수만 생략한다', async () => {
    fetchFeedPage.mockResolvedValue([original]);
    countLicks.mockRejectedValue(new Error('down'));

    render(<Feed player={fakePlayer} user={null} tag="bebop" />);

    expect(await screen.findByRole('heading', { name: '#bebop' })).toBeTruthy();
    await screen.findByText('Original lick');
    expect(screen.queryByText(/licks$/)).toBeNull();
  });

  it('tag prop이 없으면 태그 헤더도 개수 조회도 없다', async () => {
    render(<Feed player={fakePlayer} user={null} />);
    await screen.findByText('Original lick');
    expect(countLicks).not.toHaveBeenCalled();
    expect(document.querySelector('.c-tagfeed')).toBeNull();
  });

  it('deletable: 빨간 Delete 버튼 대신 오버플로(⋯) 메뉴로 삭제 진입한다', async () => {
    fetchFeedPage.mockResolvedValue([original]);
    render(<Feed player={fakePlayer} user={null} authorId="author-1" deletable />);
    await screen.findByText('Original lick');

    // 인라인 Delete 버튼은 없다 — 상세 페이지와 동일한 ⋯ 패턴
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('menuitem', { name: 'Delete lick' })).toBeTruthy();
  });

  it('deletable: Delete lick → 확인 다이얼로그 → Delete 확정 시 삭제·카드 제거', async () => {
    fetchFeedPage.mockResolvedValue([original]);
    render(<Feed player={fakePlayer} user={null} authorId="author-1" deletable />);
    await screen.findByText('Original lick');

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete lick' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(deleteLick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await vi.waitFor(() => expect(deleteLick).toHaveBeenCalledWith('orig-1'));
    await vi.waitFor(() => expect(screen.queryByText('Original lick')).toBeNull());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('deletable: 다이얼로그 Cancel은 삭제하지 않고 닫는다', async () => {
    fetchFeedPage.mockResolvedValue([original]);
    render(<Feed player={fakePlayer} user={null} authorId="author-1" deletable />);
    await screen.findByText('Original lick');

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete lick' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(deleteLick).not.toHaveBeenCalled();
    expect(screen.getByText('Original lick')).toBeTruthy();
  });

  it('첫 페이지 로드 실패 시 에러 안내와 재시도 버튼을 보여주고, 재시도 성공 시 카드가 렌더된다', async () => {
    fetchFeedPage.mockRejectedValueOnce(new Error('network down'));

    render(<Feed player={fakePlayer} user={null} />);

    expect(await screen.findByText("Couldn't load the list")).toBeTruthy();
    const retry = screen.getByRole('button', { name: 'Retry' });

    fetchFeedPage.mockResolvedValueOnce([original, similar]);
    fireEvent.click(retry);

    expect(await screen.findByText('Original lick')).toBeTruthy();
    expect(screen.queryByText("Couldn't load the list")).toBeNull();
  });
});

describe('Feed: 넘기기 재생 오버레이 (swipe-play R4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchLikeCounts.mockResolvedValue(new Map());
  });

  it('AC-19 카드 재생 버튼을 누르면 오버레이가 그 카드로 열리고 닫으면 목록 DOM 이 그대로다', async () => {
    const playable = lick({
      id: 'p-1',
      title: 'Playable lick',
      blob: encodeSong(demoSong).replace(/^#/, ''),
    });
    fetchFeedPage.mockResolvedValue([original, playable]);
    render(<Feed player={fakePlayer} user={null} />);
    await screen.findByText('Playable lick');
    const cardBefore = document.querySelector('.c-card');

    // 읽을 수 없는 blob(original)에는 버튼이 없어 Play 는 하나뿐
    fireEvent.click(screen.getByLabelText('Play'));
    expect(document.querySelector('.c-play')).not.toBeNull();
    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(fakePlayer.isPlaying()).toBe(true);

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(document.querySelector('.c-play')).toBeNull();
    expect(fakePlayer.isPlaying()).toBe(false);
    expect(document.querySelector('.c-card')).toBe(cardBefore);
  });

  it('AC-19 오버레이의 좋아요가 카드의 좋아요 수에 반영된다', async () => {
    const playable = lick({
      id: 'p-2',
      title: 'Playable lick',
      blob: encodeSong(demoSong).replace(/^#/, ''),
    });
    fetchFeedPage.mockResolvedValue([playable]);
    fetchLikeCounts.mockResolvedValue(new Map([['p-2', 4]]));
    render(<Feed player={fakePlayer} user={{ id: 'u1' } as never} />);
    await screen.findByText('Playable lick');
    fireEvent.click(screen.getByLabelText('Play'));
    const overlayLike = document.querySelector('.c-play .c-like');
    if (!overlayLike) throw new Error('오버레이 좋아요 버튼 없음');
    await act(async () => {
      fireEvent.click(overlayLike);
    });
    expect(addLike).toHaveBeenCalledWith('p-2');
    expect(document.querySelector('.c-card .c-meta')?.textContent).toContain('♥ 5');
  });

  it('AC-17 출처 라벨: Latest, 태그 피드는 #태그, 작성자 피드는 표시 이름', async () => {
    const playable = lick({
      id: 'p-3',
      title: 'Playable lick',
      blob: encodeSong(demoSong).replace(/^#/, ''),
      profiles: { public_id: 'pub-9', display_name: 'Author Z' },
    });
    fetchFeedPage.mockResolvedValue([playable]);
    for (const [props, label] of [
      [{}, 'Latest'],
      [{ tag: 'bebop' }, '#bebop'],
      [{ authorId: 'author-1' }, 'Author Z'],
    ] as const) {
      const view = render(<Feed player={fakePlayer} user={null} {...props} />);
      await screen.findByText('Playable lick');
      fireEvent.click(screen.getByLabelText('Play'));
      expect(document.querySelector('.c-play-source')?.textContent).toBe(label);
      act(() => {
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      view.unmount();
    }
  });
});

describe('Feed: 목록 복원 (feed-cache)', () => {
  let scrollTo: MockInstance<typeof window.scrollTo>;
  let raf: MockInstance<typeof window.requestAnimationFrame>;

  const stored = (over: Partial<FeedSnapshot> = {}): FeedSnapshot => ({
    rows: [original, similar],
    counts: new Map([['orig-1', 7]]),
    cursor: similar.created_at,
    done: false,
    total: null,
    scrollY: 1200,
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    fetchFeedPage.mockResolvedValue([original, similar]);
    fetchLikeCounts.mockResolvedValue(new Map([['orig-1', 7]]));
    scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
  });

  afterEach(() => {
    scrollTo.mockRestore();
    raf.mockRestore();
    vi.unstubAllGlobals();
  });

  it('AC-8 history 전환에 스냅샷이 있으면 첫 렌더에 행을 그리고 요청 없이 스크롤을 되살린다', () => {
    feedStore.set('|', stored());
    navKind.mockReturnValue('history');

    render(<Feed player={fakePlayer} user={null} />);

    expect(document.querySelectorAll('.c-card')).toHaveLength(2);
    expect(screen.getAllByText('♥ 7')).toHaveLength(2);
    expect(fetchFeedPage).not.toHaveBeenCalled();
    expect(countLicks).not.toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenLastCalledWith(0, 1200);

    // 카드 악보 폭이 실측으로 다시 그려진 뒤의 보정 (E1)
    for (const [cb] of raf.mock.calls) cb(0);
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenLastCalledWith(0, 1200);
  });

  it('AC-9 navigate 전환이면 스냅샷이 있어도 첫 페이지를 새로 받고 스크롤을 건드리지 않는다', async () => {
    feedStore.set('|', stored());
    navKind.mockReturnValue('navigate');

    render(<Feed player={fakePlayer} user={null} />);
    await screen.findByText('Original lick');

    expect(fetchFeedPage).toHaveBeenCalledTimes(1);
    expect(fetchFeedPage.mock.calls[0]?.[0]).toBeNull();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('AC-10 언마운트하면 행, counts, 커서, done, total, 떠나는 순간의 scrollY 를 저장한다', async () => {
    navKind.mockReturnValue('navigate');
    const view = render(<Feed player={fakePlayer} user={null} />);
    await screen.findByText('Original lick');
    Object.defineProperty(window, 'scrollY', { value: 777, configurable: true });

    view.unmount();

    expect(feedStore.get('|')).toEqual({
      rows: [original, similar],
      counts: new Map([['orig-1', 7]]),
      cursor: similar.created_at,
      done: true,
      total: null,
      scrollY: 777,
    });
  });

  it('AC-11 태그 피드의 총 개수를 저장하고 복원 때 countLicks 없이 바로 보인다', async () => {
    countLicks.mockResolvedValue(12);
    navKind.mockReturnValue('navigate');
    const first = render(<Feed player={fakePlayer} user={null} tag="jazz" />);
    expect(await screen.findByText('12 licks')).toBeTruthy();
    await screen.findByText('Original lick');
    first.unmount();

    navKind.mockReturnValue('history');
    render(<Feed player={fakePlayer} user={null} tag="jazz" />);

    expect(feedStore.get('|jazz')?.total).toBe(12);
    expect(screen.getByText('12 licks')).toBeTruthy();
    expect(countLicks).toHaveBeenCalledTimes(1);
  });

  it('AC-12 첫 페이지가 실패한 채 언마운트하면 그 키의 옛 스냅샷을 지운다', async () => {
    feedStore.set('|', stored());
    navKind.mockReturnValue('navigate');
    fetchFeedPage.mockRejectedValueOnce(new Error('network down'));
    const view = render(<Feed player={fakePlayer} user={null} />);
    expect(await screen.findByText("Couldn't load the list")).toBeTruthy();

    view.unmount();

    expect(feedStore.get('|')).toBeUndefined();
  });

  it('AC-14 done 이 false 인 스냅샷을 복원하면 센티널을 그리고 에러 문구가 없다', () => {
    feedStore.set('|', stored({ done: false }));
    navKind.mockReturnValue('history');

    render(<Feed player={fakePlayer} user={null} />);

    expect(document.querySelector('.c-sentinel')).not.toBeNull();
    expect(screen.queryByText("Couldn't load the list")).toBeNull();
  });

  it('AC-15 deletable 목록에서 삭제가 끝나면 저장소에서도 그 릭을 뺀다', async () => {
    const remove = vi.spyOn(feedStore, 'remove');
    fetchFeedPage.mockResolvedValue([original]);
    navKind.mockReturnValue('navigate');
    render(<Feed player={fakePlayer} user={null} authorId="author-1" deletable />);
    await screen.findByText('Original lick');

    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete lick' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await vi.waitFor(() => expect(deleteLick).toHaveBeenCalledWith('orig-1'));
    await vi.waitFor(() => expect(remove).toHaveBeenCalledWith('orig-1'));
    remove.mockRestore();
  });

  it('AC-13 떠날 때 진행 중이던 다음 페이지는 버리고 복원 뒤 센티널이 같은 커서로 다시 받는다', async () => {
    // 센티널 관찰자의 콜백을 꺼내 수동으로 부른다 (PlayOverlay.test.tsx 와 같은 방식)
    type IoCb = (entries: IntersectionObserverEntry[]) => void;
    const observers: IoCb[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IoCb) {
          observers.push(cb);
        }
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
        takeRecords(): IntersectionObserverEntry[] {
          return [];
        }
      },
    );
    const sentinelSeen = async (): Promise<void> => {
      await act(async () => {
        observers.at(-1)?.([{ isIntersecting: true } as IntersectionObserverEntry]);
      });
    };
    const at = (sec: number): string => `2026-01-01T00:00:${String(sec).padStart(2, '0')}.000Z`;
    const page1 = Array.from({ length: 20 }, (_, i) =>
      lick({ id: 'p1-' + i, title: 'First ' + i, created_at: at(59 - i) }),
    );
    const page2 = Array.from({ length: 20 }, (_, i) =>
      lick({ id: 'p2-' + i, title: 'Second ' + i, created_at: at(39 - i) }),
    );
    const cursorAfterPage1 = page1[19]?.created_at;
    let resolveSecond: (rows: LickRow[]) => void = () => {};
    fetchFeedPage
      .mockResolvedValueOnce(page1)
      .mockReturnValueOnce(new Promise((resolve) => (resolveSecond = resolve)));
    fetchLikeCounts.mockResolvedValue(new Map());
    navKind.mockReturnValue('navigate');

    const first = render(<Feed player={fakePlayer} user={null} />);
    await screen.findByText('First 19');
    await vi.waitFor(() => expect(document.querySelector('.c-sentinel')).not.toBeNull());
    await sentinelSeen();
    expect(fetchFeedPage).toHaveBeenCalledTimes(2);

    first.unmount();
    await act(async () => resolveSecond(page2));

    const snap = feedStore.get('|');
    expect(snap?.rows).toHaveLength(20);
    expect(snap?.cursor).toBe(cursorAfterPage1);

    navKind.mockReturnValue('history');
    fetchFeedPage.mockResolvedValueOnce(page2);
    render(<Feed player={fakePlayer} user={null} />);
    await sentinelSeen();

    expect(fetchFeedPage).toHaveBeenCalledTimes(3);
    expect(fetchFeedPage.mock.calls[2]?.[0]).toBe(cursorAfterPage1);
    const titles = [...document.querySelectorAll('.c-card .c-title')].map((e) => e.textContent);
    expect(titles).toHaveLength(40);
    expect(new Set(titles).size).toBe(40);
  });
});
