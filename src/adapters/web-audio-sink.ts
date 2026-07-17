/**
 * WebAudioSink — SPEC §6.1 신스 수치 그대로. 게인 불연속(감쇠 중 setValueAtTime) 절대 금지.
 * 이벤트의 상대 t는 첫 play() 시점의 epoch(now+0.06)에 고정된다.
 */
import { asSec, type Sec } from '../core/types';
import type { AudioSink, SoundEvent, SoundKind } from '../ports/audio-sink';

/* AudioContext 구조적 부분집합 — 테스트 목과 실제 컨텍스트 모두 만족 */
export interface AudioParamLike {
  value: number;
  setValueAtTime(v: number, t: number): unknown;
  linearRampToValueAtTime(v: number, t: number): unknown;
  exponentialRampToValueAtTime(v: number, t: number): unknown;
  setTargetAtTime(v: number, t: number, tc: number): unknown;
}
export interface AudioNodeLike {
  connect(dest: AudioNodeLike): unknown;
}
export interface OscillatorLike extends AudioNodeLike {
  type: string;
  frequency: AudioParamLike;
  detune: AudioParamLike;
  start(t: number): void;
  stop(t: number): void;
}
export interface GainLike extends AudioNodeLike {
  gain: AudioParamLike;
}
export interface BiquadFilterLike extends AudioNodeLike {
  type: string;
  Q: AudioParamLike;
  frequency: AudioParamLike;
}
export interface CompressorLike extends AudioNodeLike {
  threshold: AudioParamLike;
  knee: AudioParamLike;
  ratio: AudioParamLike;
  attack: AudioParamLike;
  release: AudioParamLike;
}
export interface AudioCtxLike {
  readonly currentTime: number;
  readonly destination: AudioNodeLike;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  createBiquadFilter(): BiquadFilterLike;
  createDynamicsCompressor(): CompressorLike;
}

const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

interface Scheduled {
  readonly kind: SoundKind;
  /** epoch 기준 상대 시각 */
  readonly t: number;
  readonly oscs: readonly OscillatorLike[];
}

export const createWebAudioSink = (ctx: AudioCtxLike): AudioSink => {
  let master: AudioNodeLike | null = null;
  let epoch: number | null = null;
  let nodes: Scheduled[] = [];
  /** noteOn으로 울리는 중인 지속음 (midi → 보이스) */
  const held = new Map<number, { oscs: readonly OscillatorLike[]; gain: GainLike }>();

  const releaseHeld = (midi: number): void => {
    const v = held.get(midi);
    if (!v) return;
    const now = ctx.currentTime;
    /* 현재 값에서 이어지는 릴리즈 — setValueAtTime 점프 금지 */
    v.gain.gain.setTargetAtTime(0.0001, now, 0.045);
    v.oscs.forEach((o) => o.stop(now + 0.35));
    held.delete(midi);
  };

  const getMaster = (): AudioNodeLike => {
    if (master) return master;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 18;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    const g = ctx.createGain();
    g.gain.value = 0.9;
    comp.connect(g);
    g.connect(ctx.destination);
    master = comp;
    return master;
  };

  /** 피아노 보이스 그래프(osc 2 + 배음 게인 + 로우패스) — 엔벨로프·시작·정지는 호출부 책임 */
  const makeVoice = (m: number, t: number, dur: number): { oscs: readonly OscillatorLike[]; gain: GainLike } => {
    const f = midiHz(m);
    const o1 = ctx.createOscillator();
    o1.type = 'triangle';
    o1.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = f * 2;
    o2.detune.value = 3;
    const g = ctx.createGain();
    const g2 = ctx.createGain();
    g2.gain.value = 0.2;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.3;
    lp.frequency.setValueAtTime(Math.min(f * 7, 7500), t);
    lp.frequency.exponentialRampToValueAtTime(
      Math.max(Math.min(f * 3, 3200), 400),
      t + Math.min(Math.max(dur, 0.1), 1),
    );
    o1.connect(g);
    o2.connect(g2);
    g2.connect(g);
    g.connect(lp);
    lp.connect(getMaster());
    return { oscs: [o1, o2], gain: g };
  };

  const pianoAt = (kind: SoundKind, relT: number, m: number, t: number, dur: number, vol: number): void => {
    const { oscs, gain: g } = makeVoice(m, t, dur);
    const end = t + Math.max(dur, 0.06);
    /* 불연속 없는 엔벨로프: 어택 → 자연 감쇠 → 릴리즈 (팝 노이즈 제거) */
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.setTargetAtTime(vol * 0.28, t + 0.005, 0.3);
    g.gain.setTargetAtTime(0.0001, end, 0.045);
    const tail = end + 0.35;
    oscs.forEach((o) => {
      o.start(t);
      o.stop(tail);
    });
    nodes.push({ kind, t: relT, oscs });
  };

  const clickAt = (relT: number, t: number, freq: number, vol: number): void => {
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const g = ctx.createGain();
    o.connect(g);
    g.connect(getMaster());
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.001);
    g.gain.setTargetAtTime(0.0001, t + 0.012, 0.01);
    o.start(t);
    o.stop(t + 0.09);
    nodes.push({ kind: 'metro', t: relT, oscs: [o] });
  };

  return {
    now: () => asSec(ctx.currentTime),

    play(events: readonly SoundEvent[]) {
      if (epoch === null) epoch = ctx.currentTime + 0.06;
      for (const e of events) {
        const at = epoch + e.t;
        if (e.kind === 'metro') clickAt(e.t, at, e.freq, e.vol);
        else pianoAt(e.kind, e.t, e.midi, at, e.dur, e.vol);
      }
    },

    playNow(events: readonly SoundEvent[]) {
      const base = ctx.currentTime + 0.01;
      for (const e of events) {
        const at = base + e.t;
        if (e.kind === 'metro') clickAt(0, at, e.freq, e.vol);
        else pianoAt(e.kind, 0, e.midi, at, e.dur, e.vol);
      }
    },

    noteOn(midi, vol) {
      releaseHeld(midi); // 같은 음 재타건 — 기존 보이스는 릴리즈
      const t = ctx.currentTime + 0.01;
      const v = makeVoice(midi, t, 1);
      /* 어택 → 서스테인(자연 감쇠 목표) — 릴리즈는 noteOff에서 */
      v.gain.gain.setValueAtTime(0, t);
      v.gain.gain.linearRampToValueAtTime(vol, t + 0.005);
      v.gain.gain.setTargetAtTime(vol * 0.28, t + 0.005, 0.3);
      v.oscs.forEach((o) => o.start(t));
      held.set(midi, v);
    },

    noteOff: releaseHeld,

    cancelFrom(t: Sec, kinds?: readonly SoundKind[]) {
      const now = ctx.currentTime;
      nodes = nodes.filter((n) => {
        if (n.t < t || (kinds !== undefined && !kinds.includes(n.kind))) return true;
        n.oscs.forEach((o) => o.stop(now));
        return false;
      });
    },

    stop() {
      const now = ctx.currentTime;
      nodes.forEach((n) => n.oscs.forEach((o) => o.stop(now)));
      nodes = [];
      held.forEach((v) => v.oscs.forEach((o) => o.stop(now)));
      held.clear();
      epoch = null;
    },
  };
};
