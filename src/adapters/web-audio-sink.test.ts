import { describe, expect, test } from 'vitest';
import { asMidi, asSec } from '../core/types';
import type { SoundEvent } from '../ports/audio-sink';
import { createWebAudioSink, type AudioCtxLike } from './web-audio-sink';

/* ── AudioContext 목: 파라미터 호출을 전부 기록 ── */
interface ParamCall {
  readonly method: string;
  readonly args: readonly number[];
}

const makeParam = (calls: ParamCall[]) => ({
  value: 0,
  setValueAtTime: (v: number, t: number) => calls.push({ method: 'setValueAtTime', args: [v, t] }),
  linearRampToValueAtTime: (v: number, t: number) =>
    calls.push({ method: 'linearRampToValueAtTime', args: [v, t] }),
  exponentialRampToValueAtTime: (v: number, t: number) =>
    calls.push({ method: 'exponentialRampToValueAtTime', args: [v, t] }),
  setTargetAtTime: (v: number, t: number, tc: number) =>
    calls.push({ method: 'setTargetAtTime', args: [v, t, tc] }),
});

interface MockOsc {
  type: string;
  freqCalls: ParamCall[];
  started: number[];
  stopped: number[];
}
interface MockGain {
  gainCalls: ParamCall[];
}

const createMockCtx = () => {
  const oscs: MockOsc[] = [];
  const gains: MockGain[] = [];
  let now = 0;
  const ctx: AudioCtxLike & { advance(dt: number): void } = {
    get currentTime() {
      return now;
    },
    destination: { connect: () => undefined },
    advance(dt: number) {
      now += dt;
    },
    createOscillator() {
      const rec: MockOsc = { type: '', freqCalls: [], started: [], stopped: [] };
      oscs.push(rec);
      return {
        get type() {
          return rec.type;
        },
        set type(v: string) {
          rec.type = v;
        },
        frequency: makeParam(rec.freqCalls),
        detune: makeParam([]),
        connect: () => undefined,
        start: (t: number) => rec.started.push(t),
        stop: (t: number) => rec.stopped.push(t),
      };
    },
    createGain() {
      const rec: MockGain = { gainCalls: [] };
      gains.push(rec);
      return { gain: makeParam(rec.gainCalls), connect: () => undefined };
    },
    createBiquadFilter() {
      return { type: '', Q: makeParam([]), frequency: makeParam([]), connect: () => undefined };
    },
    createDynamicsCompressor() {
      return {
        threshold: makeParam([]),
        knee: makeParam([]),
        ratio: makeParam([]),
        attack: makeParam([]),
        release: makeParam([]),
        connect: () => undefined,
      };
    },
  };
  return { ctx, oscs, gains };
};

const melody = (over: Partial<Extract<SoundEvent, { kind: 'melody' | 'acc' }>> = {}): SoundEvent => ({
  kind: 'melody',
  midi: asMidi(69),
  t: asSec(0),
  dur: asSec(0.6),
  vol: 0.24,
  ...over,
});

const metro: SoundEvent = { kind: 'metro', t: asSec(0), freq: 1568, vol: 0.16 };

describe('WebAudioSink: pianoAt 게인 시퀀스 (SPEC §6.1 DoD)', () => {
  test('엔벨로프 = [setValue(0), linearRamp(vol), setTarget(vol*0.28), setTarget(0.0001)]', () => {
    const { ctx, gains } = createMockCtx();
    const sink = createWebAudioSink(ctx);
    sink.play([melody()]);
    const env = gains.find((g) => g.gainCalls.length >= 4);
    expect(env).toBeDefined();
    const seq = env?.gainCalls.map((c) => c.method);
    expect(seq).toEqual([
      'setValueAtTime',
      'linearRampToValueAtTime',
      'setTargetAtTime',
      'setTargetAtTime',
    ]);
    const [zero, attack, decay, release] = env?.gainCalls ?? [];
    expect(zero?.args[0]).toBe(0);
    expect(attack?.args[0]).toBe(0.24);
    expect(decay?.args[0]).toBeCloseTo(0.24 * 0.28);
    expect(release?.args[0]).toBe(0.0001);
  });

  test('게인에 0.01 초과 setValueAtTime 없음 (팝 노이즈 금지)', () => {
    const { ctx, gains } = createMockCtx();
    const sink = createWebAudioSink(ctx);
    sink.play([melody(), metro]);
    const offenders = gains.flatMap((g) =>
      g.gainCalls.filter((c) => c.method === 'setValueAtTime' && (c.args[0] ?? 0) > 0.01),
    );
    expect(offenders).toEqual([]);
  });

  test('piano 1회 = osc 2개(triangle+sine), 클릭 = square 1개', () => {
    const { ctx, oscs } = createMockCtx();
    const sink = createWebAudioSink(ctx);
    sink.play([melody(), metro]);
    expect(oscs.map((o) => o.type).sort()).toEqual(['sine', 'square', 'triangle']);
  });

  test('스케줄 시각 = epoch(now+0.06) + 상대 t', () => {
    const { ctx, oscs } = createMockCtx();
    const sink = createWebAudioSink(ctx);
    sink.play([melody({ t: asSec(1.2) })]);
    expect(oscs[0]?.started[0]).toBeCloseTo(0.06 + 1.2);
  });
});

describe('WebAudioSink: noteOn/noteOff 지속음 (건반 홀드)', () => {
  test('noteOn 엔벨로프 = 어택→서스테인, 릴리즈·정지 예약 없음', () => {
    const { ctx, gains, oscs } = createMockCtx();
    const sink = createWebAudioSink(ctx);
    sink.noteOn(asMidi(60), 0.22);
    const env = gains.find((g) => g.gainCalls.length >= 3);
    expect(env?.gainCalls.map((c) => c.method)).toEqual([
      'setValueAtTime',
      'linearRampToValueAtTime',
      'setTargetAtTime',
    ]);
    expect(env?.gainCalls[1]?.args[0]).toBe(0.22);
    /* 홀드 중에는 osc.stop이 예약되지 않는다 */
    expect(oscs.flatMap((o) => o.stopped)).toEqual([]);
  });

  test('noteOff → setTargetAtTime 릴리즈 후 osc 정지 (게인 점프 없음)', () => {
    const { ctx, gains, oscs } = createMockCtx();
    const sink = createWebAudioSink(ctx);
    sink.noteOn(asMidi(60), 0.22);
    ctx.advance(1);
    sink.noteOff(asMidi(60));
    const env = gains.find((g) => g.gainCalls.length >= 4);
    const release = env?.gainCalls[3];
    expect(release?.method).toBe('setTargetAtTime');
    expect(release?.args[0]).toBe(0.0001);
    /* 릴리즈 여유 후 정지 — 즉시 stop(now)이면 팝 노이즈 */
    const stops = oscs.flatMap((o) => o.stopped);
    expect(stops).toHaveLength(2);
    for (const s of stops) expect(s).toBeGreaterThan(1);
  });

  test('noteOff는 누르지 않은 음이면 no-op', () => {
    const { ctx, oscs } = createMockCtx();
    const sink = createWebAudioSink(ctx);
    expect(() => sink.noteOff(asMidi(60))).not.toThrow();
    expect(oscs).toHaveLength(0);
  });

  test('같은 음 재-noteOn → 기존 노트 릴리즈 후 새 노트 시작', () => {
    const { ctx, oscs } = createMockCtx();
    const sink = createWebAudioSink(ctx);
    sink.noteOn(asMidi(60), 0.22);
    sink.noteOn(asMidi(60), 0.22);
    expect(oscs).toHaveLength(4);
    /* 첫 노트의 osc 2개는 정지 예약됨 */
    expect(oscs.filter((o) => o.stopped.length > 0)).toHaveLength(2);
  });

  test('stop() → 홀드 중 노트도 정지', () => {
    const { ctx, oscs } = createMockCtx();
    const sink = createWebAudioSink(ctx);
    sink.noteOn(asMidi(60), 0.22);
    sink.stop();
    expect(oscs.every((o) => o.stopped.length > 0)).toBe(true);
  });
});

describe('WebAudioSink: 노드군 취소 (SPEC §6.2~6.3 DoD)', () => {
  test('cancelFrom(0, [metro]) → 클릭만 정지, 멜로디 유지', () => {
    const { ctx, oscs } = createMockCtx();
    const sink = createWebAudioSink(ctx);
    sink.play([melody(), metro]);
    sink.cancelFrom(asSec(0), ['metro']);
    const square = oscs.find((o) => o.type === 'square');
    const triangle = oscs.find((o) => o.type === 'triangle');
    expect(square?.stopped.length).toBeGreaterThan(1); // 자연 stop + 취소 stop
    expect(triangle?.stopped).toHaveLength(1); // 자연 stop만
  });

  test('cancelFrom(t): t 이전에 시작한 이벤트는 유지', () => {
    const { ctx, oscs } = createMockCtx();
    const sink = createWebAudioSink(ctx);
    sink.play([melody({ t: asSec(0) }), melody({ t: asSec(2) })]);
    sink.cancelFrom(asSec(1));
    const stoppedTwice = oscs.filter((o) => o.stopped.length > 1);
    expect(stoppedTwice).toHaveLength(2); // t=2 이벤트의 osc 2개만
  });

  test('stop() → 전 노드군 정지, epoch 리셋', () => {
    const { ctx, oscs } = createMockCtx();
    const sink = createWebAudioSink(ctx);
    sink.play([melody(), metro]);
    sink.stop();
    expect(oscs.every((o) => o.stopped.length > 1)).toBe(true);
    ctx.advance(10);
    sink.play([melody()]);
    const last = oscs[oscs.length - 1];
    expect(last?.started[0]).toBeCloseTo(10.06); // 새 epoch
  });

  test('now()는 오디오 시계를 반환', () => {
    const { ctx } = createMockCtx();
    const sink = createWebAudioSink(ctx);
    ctx.advance(3);
    expect(sink.now()).toBe(3);
  });
});

describe('WebAudioSink: playNow (스테일 epoch 무음 버그 회귀)', () => {
  test('playNow는 세션 epoch과 무관하게 현재 시각 기준으로 스케줄', () => {
    const { ctx, oscs } = createMockCtx();
    const sink = createWebAudioSink(ctx);
    sink.play([melody()]); // epoch = 0.06 고정
    ctx.advance(10); // 시간이 흐름 — epoch은 스테일
    sink.playNow([melody()]);
    const last = oscs[oscs.length - 1];
    expect(last?.started[0]).toBeGreaterThanOrEqual(10); // 과거 스케줄 금지
  });
});
