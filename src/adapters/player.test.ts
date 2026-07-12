import { beforeEach, describe, expect, test } from 'vitest';
import { demoSong } from '../core/demo-song';
import { secPerStep } from '../engine/schedule';
import { asStep } from '../core/types';
import { createFakeAudioSink, type FakeAudioSink } from './fakes/fake-audio-sink';
import { createFakeClock, type FakeClock } from './fakes/fake-clock';
import { createPlayer, type Player } from './player';

const SPS = secPerStep(demoSong.tempo); // 0.15
const EPOCH = 0.06;

let time: { t: number };
let sink: FakeAudioSink;
let clock: FakeClock;
let player: Player;

beforeEach(() => {
  time = { t: 0 };
  sink = createFakeAudioSink(() => time.t);
  clock = createFakeClock();
  player = createPlayer({ sink, clock });
});

const kinds = (): string[] => [...new Set(sink.events.map((e) => e.kind))].sort();

describe('player: 재생 세션', () => {
  test('play → melody+acc+metro 스케줄, isPlaying', () => {
    player.play(demoSong, { melody: true, accomp: true, metro: true }, asStep(0));
    expect(kinds()).toEqual(['acc', 'melody', 'metro']);
    expect(player.isPlaying()).toBe(true);
  });

  test('onTick: 진행 스텝 전달', () => {
    const ticks: number[] = [];
    player.onTick((el) => ticks.push(el));
    player.play(demoSong, { melody: true, accomp: false, metro: false }, asStep(0));
    time.t = EPOCH + 4 * SPS;
    clock.frame();
    expect(ticks[0]).toBeCloseTo(4);
  });

  test('el 시작 클램프: t0 이전 tick에서 fromStep 밑으로 내려가지 않음', () => {
    const ticks: number[] = [];
    player.onTick((el) => ticks.push(el));
    player.play(demoSong, { melody: true, accomp: false, metro: false }, asStep(16), asStep(32));
    time.t = 0; // epoch(0.06) 이전
    clock.frame();
    expect(ticks[0]).toBe(16); // measOf(16)=1 ≥ 0
  });

  test('toStep 도달 → 자동 정지 + 이벤트 클리어', () => {
    player.play(demoSong, { melody: true, accomp: false, metro: false }, asStep(0), asStep(16));
    time.t = EPOCH + 16 * SPS + 0.01;
    clock.frame();
    expect(player.isPlaying()).toBe(false);
    expect(sink.events).toHaveLength(0);
  });

  test('stop → 전부 정지 + onTick 중단', () => {
    const ticks: number[] = [];
    player.onTick((el) => ticks.push(el));
    player.play(demoSong, { melody: true, accomp: true, metro: true }, asStep(0));
    player.stop();
    expect(sink.events).toHaveLength(0);
    expect(player.isPlaying()).toBe(false);
    time.t = EPOCH + 4 * SPS;
    clock.frame();
    expect(ticks).toHaveLength(0);
    expect(clock.frameSubscriberCount()).toBe(0);
  });
});

describe('player: 재생 중 실시간 토글 (SPEC §3.1, §6.2~6.3 DoD)', () => {
  test('메트로놈 off → 클릭만 제거, 멜로디 유지', () => {
    player.play(demoSong, { melody: true, accomp: false, metro: true }, asStep(0));
    player.toggleMetro(false);
    expect(kinds()).toEqual(['melody']);
    expect(player.isPlaying()).toBe(true);
  });

  test('메트로놈 on → 현재 이후 박만 스케줄', () => {
    player.play(demoSong, { melody: true, accomp: false, metro: false }, asStep(0));
    time.t = EPOCH + 20 * SPS; // el ≈ step 20
    player.toggleMetro(true);
    const metros = sink.events.filter((e) => e.kind === 'metro');
    expect(metros).toHaveLength(11); // st=20,24,…,60
    expect(metros[0]?.t).toBeCloseTo(20 * SPS);
  });

  test('반주 off → acc만 제거', () => {
    player.play(demoSong, { melody: true, accomp: true, metro: true }, asStep(0));
    player.toggleAcc(false);
    expect(kinds()).toEqual(['melody', 'metro']);
  });

  test('반주 on(패턴 변경 포함) → 현재 이후만, 새 패턴으로', () => {
    player.play(demoSong, { melody: true, accomp: false, metro: false }, asStep(0));
    time.t = EPOCH + 32 * SPS; // 마디 2 시작
    player.toggleAcc(true, { ...demoSong, accPat: 'arp' });
    const accs = sink.events.filter((e) => e.kind === 'acc');
    expect(accs).toHaveLength(16); // st 32~62 8분 단위 arp
    expect(accs[0]?.t).toBeCloseTo(32 * SPS);
    expect(accs.every((e) => e.kind === 'acc' && e.vol === 0.09)).toBe(true);
  });

  test('정지 상태에서 토글은 no-op', () => {
    player.toggleMetro(true);
    player.toggleAcc(true);
    expect(sink.events).toHaveLength(0);
  });
});
