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

/** 프로토타입 픽스처(구형 v1.)를 새 무점 형식으로 변환 — 페이로드 바이트는 동일 */
const noDot = (h: string): string => `v1${h.slice(3)}`;

describe('codec (SPEC §7)', () => {
  test('encode: v2 무점 바이너리 — 메신저 링크 한도(500자) 대비 컴팩트', () => {
    const h = encodeSong(prototypeDemo);
    expect(h.startsWith('v2')).toBe(true);
    expect(h).not.toContain('.');
    expect(h.length).toBeLessThan(350);
  });

  test('v2 왕복: 데모 곡 인코딩 → 디코딩 동일', () => {
    expect(decodeSong(encodeSong(prototypeDemo))).toEqual(prototypeDemo);
  });

  test('v2 잘린 페이로드 → null (부분 파싱 금지)', () => {
    const h = encodeSong(prototypeDemo);
    expect(decodeSong(h.slice(0, h.length - 4))).toBeNull();
    expect(decodeSong(h.slice(0, 8))).toBeNull();
    expect(decodeSong('v2')).toBeNull();
  });

  test('v2 뒤에 여분 바이트 → null (전체 소비 강제)', () => {
    expect(decodeSong(`${encodeSong(prototypeDemo)}AAAA`)).toBeNull();
  });

  test('해시(일반) 디코딩 → 원본 곡 복원', () => {
    expect(decodeSong(noDot(hashes.normal))).toEqual(prototypeDemo);
  });

  test('해시(pickup) 디코딩', () => {
    const song = decodeSong(noDot(hashes.pickup));
    expect(song).not.toBeNull();
    expect(song?.pickup).toBe(8);
    expect(song?.notes[0]?.s).toBe(8);
    expect(song?.chords).toEqual({ 2: 'C', 6: 'Am', 10: 'F', 14: 'G7' });
  });

  test('페이로드 하위 필드: cb 없음 → 코드 키 ×4, "r" 노트 필터, 기본값 적용', () => {
    const song = decodeSong(noDot(hashes.legacy));
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
    expect(decodeSong('v2abc')).toBeNull();
    expect(decodeSong('v1!!!')).toBeNull();
  });

  test('구형(v1.) 해시는 명시적으로 거부 → null', () => {
    expect(decodeSong(hashes.normal)).toBeNull();
  });

  test('잘린 해시(접두사만 남음) → null', () => {
    expect(decodeSong('v1')).toBeNull();
    expect(decodeSong('v1.')).toBeNull();
  });

  test('프로퍼티: 임의 Song 왕복 동일성 (deep equal)', () => {
    const songArb = fc
      .record({
        title: fc.string({ unit: 'grapheme', minLength: 1, maxLength: 20 }),
        tempo: fc.integer({ min: 40, max: 240 }),
        meas: fc.integer({ min: 1, max: 8 }),
        pickup: fc.constantFrom(0 as const, 8 as const),
        accPat: fc.constantFrom('pad' as const, 'comp' as const, 'arp' as const, 'off' as const),
        metro: fc.constantFrom('off' as const, 'quarter' as const),
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
      .map(({ seeds, ...rest }): Song => {
        // v2는 s 정렬 순서로 id를 재부여하므로 s 중복 제거 + 정렬로 정규형을 만든다
        const uniq = [...new Map(seeds.map((sd) => [sd.s, sd])).values()].sort(
          (a, b) => a.s - b.s,
        );
        return { ...rest, notes: uniq.map((seed, i) => makeNote(i + 1, [seed.s, seed.d, seed.p])) };
      });

    fc.assert(
      fc.property(songArb, (song) => {
        expect(decodeSong(encodeSong(song))).toEqual(song);
      }),
    );
  });
});
