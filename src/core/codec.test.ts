import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import hashes from '../../fixtures/prototype-hashes.json';
import { LEN_STEPS } from './constants';
import { decodeSong, encodeSong } from './codec';
import { asMidi, asStep, type Note, type Song } from './types';

/** 데모 곡 (프로토타입 초기값, IMPLEMENTATION_PLAN 수용 픽스처) */
const demoNotes: readonly (readonly [number, number, number])[] = [
  [0, 4, 64], [4, 2, 69], [6, 2, 67], [8, 4, 71], [12, 6, 69], [20, 4, 67], [24, 8, 64],
  [32, 4, 65], [36, 4, 69], [40, 8, 72], [48, 4, 71], [52, 4, 67], [56, 8, 64],
];

const makeNote = (id: number, [s, d, p]: readonly [number, number, number]): Note => ({
  id,
  s: asStep(s),
  d,
  p: asMidi(p),
});

const demoSong: Song = {
  title: '봄날의 스케치',
  tempo: 100,
  meas: 4,
  pickup: 0,
  accPat: 'pad',
  mAcc: {},
  notes: demoNotes.map((t, i) => makeNote(i + 1, t)),
  chords: { 0: 'C', 4: 'Am', 8: 'F', 12: 'G7' },
};

describe('codec (SPEC §7)', () => {
  test('encode(데모 곡) = 프로토타입이 생성한 해시와 바이트 단위 동일', () => {
    expect(encodeSong(demoSong)).toBe(hashes.normal);
  });

  test('프로토타입 해시(일반) 디코딩 → 데모 곡 복원', () => {
    expect(decodeSong(hashes.normal)).toEqual(demoSong);
  });

  test('프로토타입 해시(pickup) 디코딩', () => {
    const song = decodeSong(hashes.pickup);
    expect(song).not.toBeNull();
    expect(song?.pickup).toBe(8);
    expect(song?.notes[0]?.s).toBe(8);
    expect(song?.chords).toEqual({ 2: 'C', 6: 'Am', 10: 'F', 14: 'G7' });
  });

  test('구버전 해시: cb 없음 → 코드 키 ×4, "r" 노트 필터, 기본값 적용', () => {
    const song = decodeSong(hashes.legacy);
    expect(song).not.toBeNull();
    expect(song?.title).toBe('옛 곡');
    expect(song?.tempo).toBe(90);
    expect(song?.meas).toBe(2);
    expect(song?.pickup).toBe(0);
    expect(song?.accPat).toBe('pad');
    expect(song?.mAcc).toEqual({});
    expect(song?.notes.map((n) => [n.s, n.d, n.p])).toEqual([
      [0, 4, 60],
      [8, 4, 62],
    ]);
    expect(song?.chords).toEqual({ 0: 'C', 4: 'G7' });
  });

  test('유니코드 제목 안전 (이모지 포함)', () => {
    const song: Song = { ...demoSong, title: '봄날의 스케치 🎵 — Ⅳ악장' };
    expect(decodeSong(encodeSong(song))?.title).toBe('봄날의 스케치 🎵 — Ⅳ악장');
  });

  test('잘못된 해시 → null', () => {
    expect(decodeSong('garbage')).toBeNull();
    expect(decodeSong('v2.abc')).toBeNull();
    expect(decodeSong('v1.!!!')).toBeNull();
  });

  test('프로퍼티: 임의 Song 왕복 동일성 (deep equal)', () => {
    const songArb = fc
      .record({
        title: fc.string({ unit: 'grapheme', minLength: 1, maxLength: 20 }),
        tempo: fc.integer({ min: 40, max: 240 }),
        meas: fc.integer({ min: 1, max: 8 }),
        pickup: fc.constantFrom(0 as const, 8 as const),
        accPat: fc.constantFrom('pad' as const, 'comp' as const, 'arp' as const),
        mAcc: fc.dictionary(
          fc.nat({ max: 8 }).map(String),
          fc.constantFrom('pad' as const, 'comp' as const, 'arp' as const, 'off' as const),
          { maxKeys: 3 },
        ),
        seeds: fc.array(
          fc.record({ s: fc.nat({ max: 120 }), d: fc.constantFrom(...LEN_STEPS), p: fc.integer({ min: 53, max: 84 }) }),
          { maxLength: 20 },
        ),
        chords: fc.dictionary(
          fc.nat({ max: 35 }).map(String),
          fc.constantFrom('C', 'Am', 'F♯m7', 'Bb7', 'Gsus4'),
          { maxKeys: 6 },
        ),
      })
      .map(({ seeds, ...rest }): Song => ({
        ...rest,
        notes: seeds.map((seed, i) => makeNote(i + 1, [seed.s, seed.d, seed.p])),
      }));

    fc.assert(
      fc.property(songArb, (song) => {
        expect(decodeSong(encodeSong(song))).toEqual(song);
      }),
    );
  });
});
