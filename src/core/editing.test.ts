import { describe, expect, test } from 'vitest';
import { demoSong } from './demo-song';
import {
  addMeasure,
  addPickup,
  cycleMeasureAcc,
  deleteSel,
  padTap,
  selectDir,
  setChord,
  stepLen,
  stepPitch,
  stepPos,
  type EditCtx,
} from './editing';
import { asBar, asMidi, asStep, type Note, type Song } from './types';

const note = (id: number, s: number, d: number, p = 64): Note => ({
  id,
  s: asStep(s),
  d,
  p: asMidi(p),
});

const song = (over: Partial<Song>): Song => ({ ...demoSong, notes: [], chords: {}, ...over });

const ctx = (s: Song, sel: number | null = null, curM = 0): EditCtx => ({
  song: s,
  sel,
  curM: asBar(curM),
});

describe('padTap: 음 행 (SPEC §3.5)', () => {
  test('빈 칸 → 4분음표(d=4) 입력 + 선택 + 프리뷰', () => {
    const out = padTap(ctx(song({ meas: 1 })), asMidi(64), 0);
    expect(out.changed).toBe(true);
    expect(out.song.notes).toHaveLength(1);
    expect(out.song.notes[0]).toMatchObject({ s: 0, d: 4, p: 64 });
    expect(out.sel).toBe(out.song.notes[0]?.id);
    expect(out.preview).toBeDefined();
  });

  test('곡 끝 클램프: 마지막 칸 입력 시 d=TOTAL-abs', () => {
    const out = padTap(ctx(song({ meas: 1 })), asMidi(64), 14);
    expect(out.song.notes[0]).toMatchObject({ s: 14, d: 2 });
  });

  test('입력 시 겹침 해소', () => {
    const base = song({ meas: 1, notes: [note(1, 0, 8)] });
    const out = padTap(ctx(base), asMidi(60), 4);
    expect(out.song.notes.find((n) => n.id === 1)?.d).toBe(4);
  });

  test('켜진 칸(비선택) → 선택만, 변경 없음', () => {
    const base = song({ meas: 1, notes: [note(1, 0, 4)] });
    const out = padTap(ctx(base), asMidi(64), 2);
    expect(out.changed).toBe(false);
    expect(out.sel).toBe(1);
    expect(out.song).toBe(base);
    expect(out.preview).toBeDefined();
  });

  test('선택된 칸 재탭 → 삭제', () => {
    const base = song({ meas: 1, notes: [note(1, 0, 4)] });
    const out = padTap(ctx(base, 1), asMidi(64), 2);
    expect(out.changed).toBe(true);
    expect(out.song.notes).toHaveLength(0);
    expect(out.sel).toBeNull();
  });

  test('2번째 마디에서는 절대 스텝으로 입력', () => {
    const out = padTap(ctx(song({ meas: 2 }), null, 1), asMidi(64), 0);
    expect(out.song.notes[0]?.s).toBe(16);
  });
});

describe('padTap: 쉼표 행 (SPEC §3.5)', () => {
  test('음의 머리 탭 → 그 음 삭제', () => {
    const base = song({ meas: 1, notes: [note(1, 4, 4)] });
    const out = padTap(ctx(base, 1), 'rest', 4);
    expect(out.changed).toBe(true);
    expect(out.song.notes).toHaveLength(0);
    expect(out.sel).toBeNull();
  });

  test('음의 중간 탭 → d = 탭지점 - s 로 자르기', () => {
    const base = song({ meas: 1, notes: [note(1, 4, 8)] });
    const out = padTap(ctx(base), 'rest', 6);
    expect(out.song.notes[0]?.d).toBe(2);
  });

  test('빈 지점 탭 → no-op + "이미 쉼표입니다"', () => {
    const out = padTap(ctx(song({ meas: 1 })), 'rest', 3);
    expect(out.changed).toBe(false);
    expect(out.toast).toBe('이미 쉼표입니다');
  });
});

describe('stepPitch (SPEC §3.7)', () => {
  test('반음 이동 + 프리뷰', () => {
    const base = song({ meas: 1, notes: [note(1, 0, 4, 64)] });
    const out = stepPitch(ctx(base, 1), 1);
    expect(out.song.notes[0]?.p).toBe(65);
    expect(out.preview).toBeDefined();
  });

  test('PMIN(53)~PMAX(84) 클램프', () => {
    const hi = song({ meas: 1, notes: [note(1, 0, 4, 84)] });
    expect(stepPitch(ctx(hi, 1), 1).changed).toBe(false);
    const lo = song({ meas: 1, notes: [note(1, 0, 4, 53)] });
    expect(stepPitch(ctx(lo, 1), -1).changed).toBe(false);
  });

  test('선택 없으면 no-op', () => {
    expect(stepPitch(ctx(song({ meas: 1 })), 1).changed).toBe(false);
  });
});

describe('stepPos (SPEC §3.7)', () => {
  test('16분 이동 + curM 추적', () => {
    const base = song({ meas: 2, notes: [note(1, 15, 4)] });
    const out = stepPos(ctx(base, 1, 0), 1);
    expect(out.song.notes[0]?.s).toBe(16);
    expect(out.curM).toBe(1);
  });

  test('0 미만/곡 끝 초과는 no-op', () => {
    const first = song({ meas: 1, notes: [note(1, 0, 4)] });
    expect(stepPos(ctx(first, 1), -1).changed).toBe(false);
    const last = song({ meas: 1, notes: [note(1, 12, 4)] });
    expect(stepPos(ctx(last, 1), 1).changed).toBe(false);
  });

  test('이동 시 겹침 해소', () => {
    const base = song({ meas: 1, notes: [note(1, 0, 4), note(2, 4, 4, 60)] });
    const out = stepPos(ctx(base, 2), -1); // [3,7) — 앞 노트 [0,4)를 d=3으로
    expect(out.song.notes.find((n) => n.id === 1)?.d).toBe(3);
  });
});

describe('stepLen (SPEC §3.7)', () => {
  test('LEN_STEPS 단계 이동: 4 → 6', () => {
    const base = song({ meas: 1, notes: [note(1, 0, 4)] });
    expect(stepLen(ctx(base, 1), 1).song.notes[0]?.d).toBe(6);
  });

  test('곡 끝 클램프: 초과하는 단계는 no-op', () => {
    const base = song({ meas: 1, notes: [note(1, 12, 4)] });
    expect(stepLen(ctx(base, 1), 1).changed).toBe(false);
  });

  test('비표준 길이(겹침으로 잘린 d=5)는 인접 단계로 스냅', () => {
    const base = song({ meas: 1, notes: [{ ...note(1, 0, 4), d: 5 }] });
    expect(stepLen(ctx(base, 1), 1).song.notes[0]?.d).toBe(6);
    expect(stepLen(ctx(base, 1), -1).song.notes[0]?.d).toBe(4);
  });

  test('최소/최대 단계에서 no-op', () => {
    const base = song({ meas: 1, notes: [note(1, 0, 1)] });
    expect(stepLen(ctx(base, 1), -1).changed).toBe(false);
  });
});

describe('selectDir (SPEC §3.8)', () => {
  test('중간에서 이동: 선택만 변경 + curM 추적', () => {
    const base = song({ meas: 2, notes: [note(1, 0, 4), note(2, 20, 4)] });
    const out = selectDir(ctx(base, 1), 1);
    expect(out.changed).toBe(false);
    expect(out.sel).toBe(2);
    expect(out.curM).toBe(1);
  });

  test('duplicateNext: 마지막 노트에서 ▶ → 직전 음 복제 추가 (곡 끝 클램프)', () => {
    const base = song({ meas: 1, notes: [note(1, 8, 6, 70)] });
    const out = selectDir(ctx(base, 1), 1);
    expect(out.changed).toBe(true);
    const added = out.song.notes.find((n) => n.id === out.sel);
    expect(added).toMatchObject({ s: 14, d: 2, p: 70 }); // d=min(6, 16-14)
  });

  test('duplicateNext: 곡 끝 도달 시 차단 토스트', () => {
    const base = song({ meas: 1, notes: [note(1, 12, 4)] });
    const out = selectDir(ctx(base, 1), 1);
    expect(out.changed).toBe(false);
    expect(out.toast).toBe('곡 끝 — 마디를 추가하세요');
  });

  test('duplicatePrev: 첫 노트에서 ◀ → 앞에 복제, d=min(d,s)', () => {
    const base = song({ meas: 1, notes: [note(1, 2, 4, 70)] });
    const out = selectDir(ctx(base, 1), -1);
    const added = out.song.notes.find((n) => n.id === out.sel);
    expect(added).toMatchObject({ s: 0, d: 2, p: 70 });
  });

  test('duplicatePrev: s=0이면 "곡 처음입니다" no-op', () => {
    const base = song({ meas: 1, notes: [note(1, 0, 4)] });
    const out = selectDir(ctx(base, 1), -1);
    expect(out.changed).toBe(false);
    expect(out.toast).toBe('곡 처음입니다');
  });

  test('음표 없으면 토스트', () => {
    expect(selectDir(ctx(song({ meas: 1 })), 1).toast).toBe('음표가 없습니다');
  });
});

describe('deleteSel (SPEC §3.8)', () => {
  test('선택 삭제 후 이전 노트 자동 선택', () => {
    const base = song({ meas: 1, notes: [note(1, 0, 4), note(2, 4, 4)] });
    const out = deleteSel(ctx(base, 2));
    expect(out.song.notes.map((n) => n.id)).toEqual([1]);
    expect(out.sel).toBe(1);
  });

  test('첫 노트 삭제 시 선택 해제', () => {
    const base = song({ meas: 1, notes: [note(1, 0, 4)] });
    expect(deleteSel(ctx(base, 1)).sel).toBeNull();
  });
});

describe('addPickup / addMeasure (SPEC §3.6)', () => {
  test('addPickup: notes s+=8, chords 키+2, mAcc 키+1, curM=0', () => {
    const base: Song = { ...demoSong, mAcc: { 1: 'off' } };
    const out = addPickup(ctx(base, null, 2));
    expect(out.song.pickup).toBe(8);
    expect(out.song.notes.map((n) => n.s)).toEqual(demoSong.notes.map((n) => n.s + 8));
    expect(out.song.chords).toEqual({ 2: 'C', 6: 'Am', 10: 'F', 14: 'G7' });
    expect(out.song.mAcc).toEqual({ 2: 'off' });
    expect(out.curM).toBe(0);
  });

  test('addPickup: 이미 있으면 no-op', () => {
    const base = song({ meas: 1, pickup: 8 });
    expect(addPickup(ctx(base)).changed).toBe(false);
  });

  test('addMeasure: meas+1, 새 마지막 마디로 이동', () => {
    const out = addMeasure(ctx(demoSong, null, 3));
    expect(out.song.meas).toBe(5);
    expect(out.curM).toBe(4);
  });
});

describe('setChord / cycleMeasureAcc (SPEC §3.3~3.4)', () => {
  test('setChord: 설정과 삭제', () => {
    const withChord = setChord(ctx(song({ meas: 1 })), 2, 'F♯m7');
    expect(withChord.song.chords).toEqual({ 2: 'F♯m7' });
    const cleared = setChord(ctx(withChord.song), 2, null);
    expect(cleared.song.chords).toEqual({});
  });

  test('cycleMeasureAcc: 기본→pad→comp→arp→off→기본', () => {
    let c = ctx(song({ meas: 1 }));
    const seen: (string | undefined)[] = [];
    for (let i = 0; i < 5; i++) {
      const out = cycleMeasureAcc(c);
      seen.push(out.song.mAcc[0]);
      c = ctx(out.song);
    }
    expect(seen).toEqual(['pad', 'comp', 'arp', 'off', undefined]);
  });
});
