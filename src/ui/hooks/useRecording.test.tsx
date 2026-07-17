/**
 * useRecording 훅 테스트 (piano-recording-design §2).
 * FakeClock의 now를 sink에도 공유해 player.record의 시각 기준을 제어한다.
 * demoSong: 템포 100(sps=0.15), 4마디 → 예비박 2.4초, 본편 9.6초. epoch 오프셋 0.06.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createFakeAudioSink } from '../../adapters/fakes/fake-audio-sink';
import { createFakeClock, type FakeClock } from '../../adapters/fakes/fake-clock';
import { createPlayer } from '../../adapters/player';
import { asMidi } from '../../core/types';
import { createSongStore } from '../store/songStore';
import { useRecording } from './useRecording';

const setup = () => {
  const clock = createFakeClock();
  const sink = createFakeAudioSink(() => clock.now());
  const player = createPlayer({ sink, clock });
  const store = createSongStore();
  const hook = renderHook(() => useRecording(store, player));
  return { clock, sink, player, store, hook };
};

/** 절대 시각 t로 이동 후 프레임 1회 발화 */
const frameAt = (clock: FakeClock, t: number): void => {
  clock.advance(t - clock.now());
  clock.frame();
};

describe('useRecording', () => {
  it('start → countIn → recording → 곡 끝 자동 종료', () => {
    const { clock, store, hook } = setup();
    act(() => hook.result.current.start());
    expect(hook.result.current.phase).toBe('countIn');
    expect(store.getState().recTake).toBe('clean');

    act(() => frameAt(clock, 0.1)); // 예비박 초반
    expect(hook.result.current.countBeat).toBe(4);

    act(() => frameAt(clock, 0.06 + 2.5)); // 본편 0.04초 지점
    expect(hook.result.current.phase).toBe('recording');
    expect(hook.result.current.recEl).not.toBeNull();

    const endT = 0.06 + 2.4 + 4 * 16 * 0.15; // 본편 9.6초 후
    act(() => frameAt(clock, endT + 0.01));
    expect(hook.result.current.phase).toBe('idle');
    expect(store.getState().recTake).toBe('off');
  });

  it('keyDown/keyUp이 양자화된 노트를 스토어에 커밋', () => {
    const { clock, store, hook } = setup();
    act(() => hook.result.current.start());
    act(() => frameAt(clock, 0.06 + 2.4)); // 본편 t=0
    act(() => hook.result.current.keyDown(asMidi(61)));
    act(() => frameAt(clock, 0.06 + 2.4 + 0.6)); // t=0.6 (4스텝)
    act(() => hook.result.current.keyUp(asMidi(61)));
    // demoSong 스텝 0의 기존 노트는 겹침 해소로 대체된다 — 존재 단언
    expect(store.getState().song.notes.some((n) => n.p === 61 && n.s === 0 && n.d === 4)).toBe(true);
  });

  it('수동 stop 시 held를 잘라 커밋하고 정리', () => {
    const { clock, store, hook } = setup();
    act(() => hook.result.current.start());
    act(() => frameAt(clock, 0.06 + 2.4));
    act(() => hook.result.current.keyDown(asMidi(73)));
    act(() => frameAt(clock, 0.06 + 2.4 + 0.3)); // 2스텝 홀드
    act(() => hook.result.current.stop());
    expect(hook.result.current.phase).toBe('idle');
    expect(store.getState().song.notes.some((n) => n.p === 73 && n.d === 2)).toBe(true);
    expect(store.getState().recTake).toBe('off');
  });

  it('마디 경계를 넘으면 curM이 따라간다', () => {
    const { clock, store, hook } = setup();
    act(() => hook.result.current.start());
    act(() => frameAt(clock, 0.06 + 2.4 + 17 * 0.15)); // 스텝 17 = 마디 1
    expect(store.getState().curM).toBe(1);
  });

  it('idle에서 keyDown은 no-op', () => {
    const { store, hook } = setup();
    const before = store.getState().song;
    act(() => hook.result.current.keyDown(asMidi(60)));
    expect(store.getState().song).toBe(before);
  });

  it('keyDown은 프리뷰 사운드를 즉시 발음', () => {
    const { clock, sink, hook } = setup();
    act(() => hook.result.current.start());
    act(() => frameAt(clock, 0.06 + 2.4));
    act(() => hook.result.current.keyDown(asMidi(60)));
    expect(sink.playNowCount).toBe(1);
  });
});

describe('keyAbort (스크롤 취소)', () => {
  it('held를 커밋 없이 버린다', () => {
    const { clock, store, hook } = setup();
    const before = store.getState().song.notes.length;
    act(() => hook.result.current.start());
    act(() => frameAt(clock, 0.06 + 2.4));
    act(() => hook.result.current.keyDown(asMidi(75)));
    act(() => frameAt(clock, 0.06 + 2.4 + 0.3));
    act(() => hook.result.current.keyAbort(asMidi(75)));
    act(() => hook.result.current.stop());
    expect(store.getState().song.notes.some((n) => n.p === 75)).toBe(false);
    expect(store.getState().song.notes.length).toBe(before);
  });
});
