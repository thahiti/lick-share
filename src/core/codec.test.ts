import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import hashes from '../../fixtures/prototype-hashes.json';
import { LEN_STEPS } from './constants';
import { decodeSong, encodeSong } from './codec';
import { demoSong } from './demo-song';
import { asMidi, asStep, type Note, type Song } from './types';

const makeNote = (id: number, [s, d, p]: readonly [number, number, number]): Note => ({
  id,
  s: asStep(s),
  d,
  p: asMidi(p),
});

/**
 * 프로토타입 데모 곡: demoSong과 동일하되 제목만 원본(한국어)이다.
 * demoSong의 표시 제목은 영어화됐지만, 프로토타입 해시와의 바이트/디코딩
 * 호환은 원본 콘텐츠 기준으로 계속 검증한다.
 */
const prototypeDemo: Song = { ...demoSong, title: '봄날의 스케치' };

describe('codec (SPEC §7)', () => {
  test('encode(프로토타입 데모 곡) = 프로토타입이 생성한 해시와 바이트 단위 동일', () => {
    expect(encodeSong(prototypeDemo)).toBe(hashes.normal);
  });

  test('프로토타입 해시(일반) 디코딩 → 원본 곡 복원', () => {
    expect(decodeSong(hashes.normal)).toEqual(prototypeDemo);
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
