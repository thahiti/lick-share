import { describe, expect, test } from 'vitest';
import { demoSong } from '../core/demo-song';
import { asStep, type Song } from '../core/types';
import { schedule, secPerStep, type PlayOpts } from './schedule';

const opts = (over: Partial<PlayOpts> = {}): PlayOpts => ({
  melody: true,
  accomp: false,
  metro: false,
  ...over,
});

const withAcc = (s: Song, accPat: Song['accPat']): Song => ({ ...s, accPat });
const withMetro = (s: Song): Song => ({ ...s, metro: 'quarter' });

/** osc 수 = pianoAt 1회당 2 (트라이앵글+사인). 메트로놈 클릭은 1 */
const oscCount = (evs: readonly { kind: string }[]): number =>
  evs.filter((e) => e.kind !== 'metro').length * 2;

describe('schedule: 멜로디 (SPEC §6.2)', () => {
  test('데모 곡 전체: 노트 13개 → melody 이벤트 13개, 무반주 osc N=26', () => {
    const evs = schedule(demoSong, opts(), asStep(0));
    expect(evs).toHaveLength(13);
    expect(oscCount(evs)).toBe(26);
  });

  test('타이밍: t=(st-from)*sps, dur=길이*sps*0.96, vol=0.24', () => {
    const sps = secPerStep(demoSong.tempo);
    const evs = schedule(demoSong, opts(), asStep(0));
    expect(evs[0]).toMatchObject({ kind: 'melody', midi: 64, t: 0, vol: 0.24 });
    expect(evs[0]?.kind === 'melody' && evs[0].dur).toBeCloseTo(4 * sps * 0.96);
    expect(evs[1]?.t).toBeCloseTo(4 * sps);
  });

  test('범위 클리핑: fromStep에 걸친 노트는 잘려서 연주', () => {
    const sps = secPerStep(demoSong.tempo);
    // 데모 노트 [12,18) — from=14부터: st=14, 길이 4
    const evs = schedule(demoSong, opts(), asStep(14), asStep(20));
    const first = evs[0];
    expect(first?.t).toBe(0);
    expect(first?.kind === 'melody' && first.dur).toBeCloseTo(4 * sps * 0.96);
  });

  test('마디 재생 범위: 마디 밖 노트 제외', () => {
    const evs = schedule(demoSong, opts(), asStep(16), asStep(32));
    // 마디 1과 겹치는 노트: [12,18), [20,24), [24,32)
    expect(evs).toHaveLength(3);
  });
});

describe('schedule: 반주 osc 카운트 DoD (handoff P6)', () => {
  test('pad = N+26', () => {
    const evs = schedule(withAcc(demoSong, 'pad'), opts({ accomp: true }), asStep(0));
    expect(oscCount(evs)).toBe(26 + 26);
  });
  test('comp = N+104', () => {
    const evs = schedule(withAcc(demoSong, 'comp'), opts({ accomp: true }), asStep(0));
    expect(oscCount(evs)).toBe(26 + 104);
  });
  test('arp = N+64', () => {
    const evs = schedule(withAcc(demoSong, 'arp'), opts({ accomp: true }), asStep(0));
    expect(oscCount(evs)).toBe(26 + 64);
  });

  test('반주 음량·길이: pad 0.075/구간0.98, comp 0.07/2.3스텝, arp 0.09/1.9스텝', () => {
    const sps = secPerStep(demoSong.tempo);
    const padEv = schedule(withAcc(demoSong, 'pad'), opts({ accomp: true }), asStep(0)).find(
      (e) => e.kind === 'acc',
    );
    expect(padEv?.kind === 'acc' && padEv.vol).toBe(0.075);
    expect(padEv?.kind === 'acc' && padEv.dur).toBeCloseTo(16 * sps * 0.98);
    const hitEv = schedule(withAcc(demoSong, 'comp'), opts({ accomp: true }), asStep(0)).find(
      (e) => e.kind === 'acc',
    );
    expect(hitEv?.kind === 'acc' && hitEv.vol).toBe(0.07);
    expect(hitEv?.kind === 'acc' && hitEv.dur).toBeCloseTo(2.3 * sps);
    const oneEv = schedule(withAcc(demoSong, 'arp'), opts({ accomp: true }), asStep(0)).find(
      (e) => e.kind === 'acc',
    );
    expect(oneEv?.kind === 'acc' && oneEv.vol).toBe(0.09);
    expect(oneEv?.kind === 'acc' && oneEv.dur).toBeCloseTo(1.9 * sps);
  });
});

describe('schedule: 메트로놈 (SPEC §6.3)', () => {
  test('4박 클릭 × 4마디 = 16개, 정박 액센트 1568/일반 1047', () => {
    const evs = schedule(withMetro(demoSong), opts({ melody: false, metro: true }), asStep(0));
    expect(evs).toHaveLength(16);
    const accents = evs.filter((e) => e.kind === 'metro' && e.freq === 1568);
    expect(accents).toHaveLength(4);
    expect(accents.map((e) => e.t)).toEqual(
      [0, 16, 32, 48].map((st) => st * secPerStep(demoSong.tempo)),
    );
  });

  test('pickup 박은 무액센트', () => {
    const song: Song = {
      ...demoSong,
      pickup: 8,
      metro: 'quarter',
      notes: demoSong.notes.map((n) => ({ ...n, s: asStep(n.s + 8) })),
      chords: { 2: 'C', 6: 'Am', 10: 'F', 14: 'G7' },
    };
    const evs = schedule(song, opts({ melody: false, metro: true }), asStep(0));
    expect(evs).toHaveLength(18); // 2 + 16박
    expect(evs[0]?.kind === 'metro' && evs[0].freq).toBe(1047);
    expect(evs[1]?.kind === 'metro' && evs[1].freq).toBe(1047);
    expect(evs[2]?.kind === 'metro' && evs[2].freq).toBe(1568); // 첫 일반 마디 정박
  });

  test('중간 시작: fromStep 이후 클릭만', () => {
    const evs = schedule(withMetro(demoSong), opts({ melody: false, metro: true }), asStep(20));
    expect(evs).toHaveLength(11); // st=20,24,...,60
    expect(evs[0]?.t).toBe(0);
  });

  test("song.metro='off'면 opts.metro=true여도 클릭 0건 (데이터가 결정)", () => {
    const evs = schedule(demoSong, opts({ melody: false, metro: true }), asStep(0));
    expect(evs).toHaveLength(0);
  });

  test('멜로디만: 반주·메트로놈 0건', () => {
    const evs = schedule(withAcc(demoSong, 'arp'), opts(), asStep(0));
    expect(evs.every((e) => e.kind === 'melody')).toBe(true);
  });
});
