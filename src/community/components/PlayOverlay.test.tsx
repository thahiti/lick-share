/**
 * 전체 화면 넘기기 재생 오버레이 (swipe-play 명세 AC-7 ~ AC-18).
 * player 는 가짜 시계와 가짜 싱크로 만든 실제 player 다. IntersectionObserver 는 콜백을 꺼내 수동으로 부른다.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createFakeAudioSink, type FakeAudioSink } from '../../adapters/fakes/fake-audio-sink';
import { createFakeClock, type FakeClock } from '../../adapters/fakes/fake-clock';
import { createPlayer, type Player } from '../../adapters/player';
import { encodeSong } from '../../core/codec';
import { demoSong } from '../../core/demo-song';
import { asMidi, type Song } from '../../core/types';
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
