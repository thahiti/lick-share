import { describe, expect, test } from 'vitest';
import { chordAtBeat, chordTones, parseChord } from './chords';

describe('chordTones (SPEC §5.3)', () => {
  test('C → [48,55,64]', () => {
    expect(chordTones('C')).toEqual([48, 55, 64]);
  });
  test('Am7 → [45,52,60,67]', () => {
    expect(chordTones('Am7')).toEqual([45, 52, 60, 67]);
  });
  test('F♯dim → [54,60,69]', () => {
    expect(chordTones('F♯dim')).toEqual([54, 60, 69]);
  });
  test('Bb7 → ♭ 처리 (B♭2 루트)', () => {
    expect(chordTones('Bb7')).toEqual([46, 53, 62, 68]);
  });
  test('알 수 없는 성질 접미는 maj로 처리', () => {
    expect(chordTones('Cxyz')).toEqual([48, 55, 64]);
  });
  test('잘못된 루트 → null', () => {
    expect(chordTones('H')).toBeNull();
    expect(chordTones('')).toBeNull();
  });
});

describe('parseChord', () => {
  test('F♯m7 분해', () => {
    expect(parseChord('F♯m7')).toEqual({ root: 'F', acc: '♯', qual: 'm7' });
  });
  test('ASCII # / b 는 ♯ / ♭ 로 정규화', () => {
    expect(parseChord('C#')).toEqual({ root: 'C', acc: '♯', qual: '' });
    expect(parseChord('Bbm')).toEqual({ root: 'B', acc: '♭', qual: 'm' });
  });
  test('잘못된 문자열 → C 기본값', () => {
    expect(parseChord('')).toEqual({ root: 'C', acc: '', qual: '' });
  });
});

describe('chordAtBeat (SPEC §5.4: 다음 코드까지 지속)', () => {
  const chords = { 0: 'C', 4: 'F' };
  test('beat 3 → C', () => {
    expect(chordAtBeat(chords, 3)).toEqual({ key: 0, str: 'C' });
  });
  test('beat 4 → F', () => {
    expect(chordAtBeat(chords, 4)).toEqual({ key: 4, str: 'F' });
  });
  test('beat 7 → F', () => {
    expect(chordAtBeat(chords, 7)).toEqual({ key: 4, str: 'F' });
  });
  test('첫 코드 이전 → null', () => {
    expect(chordAtBeat({ 4: 'F' }, 3)).toBeNull();
  });
});
