/**
 * FakeAudioSink — 소리 대신 이벤트를 기록한다 (테스트/dump 계기판용).
 * dumpLines()가 골든 스냅샷의 정답지 형식.
 */
import type { AudioSink, SoundEvent, SoundKind } from '../../ports/audio-sink';
import type { Sec } from '../../core/types';

export interface FakeAudioSink extends AudioSink {
  readonly events: readonly SoundEvent[];
  dumpLines(): string[];
}

const fmt = (n: number): string => n.toFixed(3);

const line = (e: SoundEvent): string =>
  e.kind === 'metro'
    ? `t=${fmt(e.t)} metro ${e.freq}Hz vol=${e.vol}`
    : `t=${fmt(e.t)} ${e.kind} m${e.midi} dur=${fmt(e.dur)} vol=${e.vol}`;

export const createFakeAudioSink = (nowFn: () => number = () => 0): FakeAudioSink => {
  let events: SoundEvent[] = [];
  return {
    now() {
      return nowFn() as Sec;
    },
    get events() {
      return events;
    },
    play(evs: readonly SoundEvent[]) {
      events = [...events, ...evs];
    },
    cancelFrom(t: Sec, kinds?: readonly SoundKind[]) {
      events = events.filter((e) => e.t < t || (kinds !== undefined && !kinds.includes(e.kind)));
    },
    stop() {
      events = [];
    },
    dumpLines() {
      return events.map(line);
    },
  };
};
