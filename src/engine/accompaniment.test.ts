import { describe, expect, test } from 'vitest';
import { demoSong } from '../core/demo-song';
import { chordTones } from '../core/chords';
import { buildAccEvents } from './accompaniment';
import type { Song } from '../core/types';

const pad = (s: Song): Song => ({ ...s, accPat: 'pad' });
const comp = (s: Song): Song => ({ ...s, accPat: 'comp' });
const arp = (s: Song): Song => ({ ...s, accPat: 'arp' });

describe('buildAccEvents (SPEC §5.5)', () => {
  test('pad: 코드 4개 → pad 이벤트 4개, 지속=다음 코드까지', () => {
    const evs = buildAccEvents(pad(demoSong), 0, 64);
    expect(evs).toHaveLength(4);
    expect(evs.map((e) => (e.type === 'pad' ? [e.st, e.en] : null))).toEqual([
      [0, 16],
      [16, 32],
      [32, 48],
      [48, 64],
    ]);
    const first = evs[0];
    if (first?.type !== 'pad') throw new Error('pad 이벤트가 아님');
    expect(first.tones).toEqual(chordTones('C'));
  });

  test('comp: 박마다 hit (16박, G7 구간은 4음)', () => {
    const evs = buildAccEvents(comp(demoSong), 0, 64);
    expect(evs).toHaveLength(16);
    expect(evs.every((e) => e.type === 'hit')).toBe(true);
    const tones = evs.map((e) => (e.type === 'hit' ? e.tones.length : 0));
    expect(tones).toEqual([3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4]);
  });

  test('arp: 8분음표마다 one, 세그먼트 시작 시 인덱스 리셋', () => {
    const evs = buildAccEvents(arp(demoSong), 0, 64);
    expect(evs).toHaveLength(32);
    expect(evs.every((e) => e.type === 'one')).toBe(true);
    const cTones = chordTones('C');
    const amTones = chordTones('Am');
    if (!cTones || !amTones) throw new Error('코드 파싱 실패');
    // 세그먼트 시작(st=0, st=16)마다 tones[0]부터 다시 순환
    expect(evs[0]).toMatchObject({ st: 0, tone: cTones[0] });
    expect(evs[1]).toMatchObject({ st: 2, tone: cTones[1] });
    expect(evs[8]).toMatchObject({ st: 16, tone: amTones[0] });
  });

  test('첫 코드 이전 구간은 완전 무음 (SPEC §5.5 무코드 규칙)', () => {
    const song: Song = { ...demoSong, chords: { 8: 'F' } }; // 마디 2(step 32)부터
    const evs = buildAccEvents(pad(song), 0, 64);
    expect(evs).toHaveLength(1);
    expect(evs[0]).toMatchObject({ st: 32, en: 64 });
  });

  test('mAcc off 마디는 무이벤트, 이후 재타건', () => {
    const song: Song = { ...demoSong, chords: { 0: 'C' }, mAcc: { 1: 'off' }, meas: 3 };
    const evs = buildAccEvents(pad(song), 0, 48);
    expect(evs.map((e) => (e.type === 'pad' ? [e.st, e.en] : null))).toEqual([
      [0, 16], // 마디 0
      [32, 48], // 마디 1(off) 건너뛰고 마디 2에서 재타건
    ]);
  });

  test('마디별 오버라이드로 패턴이 바뀌면 세그먼트 분리', () => {
    const song: Song = { ...demoSong, chords: { 0: 'C' }, mAcc: { 1: 'arp' }, meas: 2 };
    const evs = buildAccEvents(pad(song), 0, 32);
    expect(evs[0]).toMatchObject({ type: 'pad', st: 0, en: 16 });
    expect(evs.filter((e) => e.type === 'one')).toHaveLength(8);
  });

  test('fromStep 중간 시작: 다음 박부터 전개', () => {
    const evs = buildAccEvents(comp(demoSong), 6, 64);
    expect(evs[0]).toMatchObject({ st: 8 });
  });
});
