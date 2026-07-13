/**
 * 골든 스냅샷 — FakeAudioSink 로그를 정답지로 고정 (설계 문서 §4 테스트 하네스 3층).
 * 대표 곡(데모) + 못갖춘마디 곡 × 반주 4종(off/pad/comp/arp) × 메트로놈 on/off.
 * 스냅샷 갱신은 반드시 diff를 확인하고 의도된 변화일 때만 (CLAUDE.md).
 */
import { describe, expect, test } from 'vitest';
import { createFakeAudioSink } from '../adapters/fakes/fake-audio-sink';
import { demoSong } from '../core/demo-song';
import { asStep, type Song } from '../core/types';
import { schedule } from './schedule';

const pickupSong: Song = {
  ...demoSong,
  pickup: 8,
  notes: demoSong.notes.map((n) => ({ ...n, s: asStep(n.s + 8) })),
  chords: { 2: 'C', 6: 'Am', 10: 'F', 14: 'G7' },
  mAcc: { 2: 'arp', 3: 'off' }, // 마디별 오버라이드 혼합 픽스처
};

const ACC = ['off', 'pad', 'comp', 'arp'] as const;

describe.each([
  ['demo', demoSong],
  ['pickup', pickupSong],
])('골든 스냅샷: %s 곡', (_name, song) => {
  for (const acc of ACC) {
    for (const metro of [false, true]) {
      test(`반주=${acc} 메트로놈=${metro ? 'on' : 'off'}`, () => {
        const target: Song = { ...song, accPat: acc, metro: metro ? 'quarter' : 'off' };
        const sink = createFakeAudioSink();
        sink.play(
          schedule(target, { melody: true, accomp: acc !== 'off', metro }, asStep(0)),
        );
        expect(sink.dumpLines().join('\n')).toMatchSnapshot();
      });
    }
  }
});
