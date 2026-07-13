/** 데스크톱 워크스페이스용 편집 연산 (editor-workspace-design §6·§7). */
import { describe, expect, test } from 'vitest';
import { PMAX, PMIN } from './constants';
import { demoSong } from './demo-song';
import {
  insertAtFreeBeat,
  letterPitch,
  renoteSel,
  setNoteLen,
  updateNote,
  type EditCtx,
} from './editing';
import { total } from './geometry';
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

describe('letterPitch: 음이름 → 기준 피치에서 가장 가까운 옥타브', () => {
  test('같은 음이름이면 기준을 그대로 반환', () => {
    expect(letterPitch(asMidi(72), 'C')).toBe(72); // C5
  });
  test('가장 가까운 옥타브를 고른다 (G: C5 기준 → G4=67)', () => {
    expect(letterPitch(asMidi(72), 'G')).toBe(67);
  });
  test('가장 가까운 옥타브를 고른다 (F: C5 기준 → F5=77)', () => {
    expect(letterPitch(asMidi(72), 'F')).toBe(77);
  });
  test('거리 동률이면 아래쪽 (F♯=66 기준, C → 60/72 중 60)', () => {
    expect(letterPitch(asMidi(66), 'C')).toBe(60);
  });
  test('소문자 허용', () => {
    expect(letterPitch(asMidi(72), 'a')).toBe(69); // A4
  });
  test('범위를 벗어나면 클램프 (PMIN 근처 아래 옥타브 없음)', () => {
    const p = letterPitch(asMidi(PMIN), 'C');
    expect(p).toBeGreaterThanOrEqual(PMIN);
    expect(p).toBeLessThanOrEqual(PMAX);
  });
});

describe('renoteSel: 선택 노트를 음이름으로 재배치', () => {
  test('선택 노트의 피치를 해당 음이름 최근접 옥타브로 바꾼다', () => {
    const s = song({ meas: 1, notes: [note(1, 0, 4, 72)] }); // C5
    const out = renoteSel(ctx(s, 1), 'G');
    expect(out.changed).toBe(true);
    expect(out.song.notes[0]?.p).toBe(67); // G4
    expect(out.preview?.p).toBe(67);
  });
  test('선택이 없으면 변화 없음', () => {
    const s = song({ meas: 1, notes: [note(1, 0, 4, 72)] });
    expect(renoteSel(ctx(s, null), 'G').changed).toBe(false);
  });
  test('이미 같은 피치면 변화 없음(undo 미발생)', () => {
    const s = song({ meas: 1, notes: [note(1, 0, 4, 72)] });
    expect(renoteSel(ctx(s, 1), 'C').changed).toBe(false);
  });
});

describe('insertAtFreeBeat: 현재 마디의 다음 빈 박에 입력', () => {
  test('빈 마디면 첫 박(스텝 0)에 입력하고 선택한다', () => {
    const s = song({ meas: 1 });
    const out = insertAtFreeBeat(ctx(s), asMidi(60), 4);
    expect(out.changed).toBe(true);
    expect(out.song.notes).toHaveLength(1);
    expect(out.song.notes[0]).toMatchObject({ s: 0, d: 4, p: 60 });
    expect(out.sel).toBe(out.song.notes[0]?.id);
  });
  test('첫 박이 차 있으면 다음 빈 박(스텝 4)에 입력', () => {
    const s = song({ meas: 1, notes: [note(1, 0, 4, 64)] });
    const out = insertAtFreeBeat(ctx(s, 1), asMidi(60), 4);
    expect(out.song.notes).toHaveLength(2);
    expect(out.song.notes.some((n) => n.s === 4 && n.p === 60)).toBe(true);
  });
  test('마디가 가득 차면 토스트 + 변화 없음', () => {
    const notes = [note(1, 0, 4), note(2, 4, 4), note(3, 8, 4), note(4, 12, 4)];
    const s = song({ meas: 1, notes });
    const out = insertAtFreeBeat(ctx(s), asMidi(60), 4);
    expect(out.changed).toBe(false);
    expect(out.toast).toBeDefined();
  });
});

describe('setNoteLen: 선택 노트 길이 직접 설정', () => {
  test('선택 노트의 d를 지정값으로 바꾼다', () => {
    const s = song({ meas: 1, notes: [note(1, 0, 4, 64)] });
    const out = setNoteLen(ctx(s, 1), 8);
    expect(out.changed).toBe(true);
    expect(out.song.notes[0]?.d).toBe(8);
  });
  test('곡 끝을 넘지 않도록 클램프', () => {
    const s = song({ meas: 1, notes: [note(1, 12, 4, 64)] }); // total=16
    const out = setNoteLen(ctx(s, 1), 16);
    expect(out.song.notes[0]?.d).toBe(total(s) - 12);
  });
  test('선택 없으면 변화 없음', () => {
    expect(setNoteLen(ctx(song({ meas: 1 }), null), 8).changed).toBe(false);
  });
});

describe('updateNote: 드래그 편집 (이동·리사이즈)', () => {
  test('시작 위치 이동', () => {
    const s = song({ meas: 2, notes: [note(1, 0, 4, 64)] });
    const out = updateNote(ctx(s, 1), 1, { s: 8 });
    expect(out.changed).toBe(true);
    expect(out.song.notes[0]).toMatchObject({ s: 8, d: 4, p: 64 });
  });
  test('음높이 이동 + 프리뷰', () => {
    const s = song({ meas: 1, notes: [note(1, 0, 4, 64)] });
    const out = updateNote(ctx(s, 1), 1, { p: asMidi(67) });
    expect(out.song.notes[0]?.p).toBe(67);
    expect(out.preview?.p).toBe(67);
  });
  test('길이 리사이즈', () => {
    const s = song({ meas: 1, notes: [note(1, 0, 4, 64)] });
    expect(updateNote(ctx(s, 1), 1, { d: 8 }).song.notes[0]?.d).toBe(8);
  });
  test('범위 밖 값은 클램프 (s<0, p>PMAX)', () => {
    const s = song({ meas: 1, notes: [note(1, 4, 4, 64)] });
    const out = updateNote(ctx(s, 1), 1, { s: -5, p: asMidi(200) });
    expect(out.song.notes[0]?.s).toBe(0);
    expect(out.song.notes[0]?.p).toBe(PMAX);
  });
  test('없는 id면 변화 없음', () => {
    const s = song({ meas: 1, notes: [note(1, 0, 4)] });
    expect(updateNote(ctx(s, 1), 99, { s: 8 }).changed).toBe(false);
  });
});
