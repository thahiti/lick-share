/**
 * 코드 파싱·구성음·지속 규칙 (SPEC §3.4, §5.3, §5.4).
 */
import { asMidi, type Midi } from './types';

const ROOT_PC: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC_INT: Readonly<Record<string, readonly number[]>> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus4: [0, 5, 7],
};

const CHORD_RE = /^([A-G])([♯♭#b]?)(.*)$/;

export interface ParsedChord {
  readonly root: string;
  readonly acc: '' | '♯' | '♭';
  readonly qual: string;
}

/** 코드 문자열 분해 (실패 시 C 기본값) */
export const parseChord = (str: string): ParsedChord => {
  const m = CHORD_RE.exec(str);
  if (!m) return { root: 'C', acc: '', qual: '' };
  const acc = m[2] === '#' ? '♯' : m[2] === 'b' ? '♭' : (m[2] as '' | '♯' | '♭');
  return { root: m[1] as string, acc, qual: m[3] ?? '' };
};

/** 코드 → 반주 보이싱 구성음 (루트·5음 저역 + 3음·7음 옥타브 위, A2~G♯3 루트) */
export const chordTones = (str: string): Midi[] | null => {
  const m = CHORD_RE.exec(str);
  if (!m) return null;
  const base = ROOT_PC[m[1] as string];
  if (base === undefined) return null;
  const shift = m[2] === '♯' || m[2] === '#' ? 1 : m[2] === '♭' || m[2] === 'b' ? -1 : 0;
  const pc = (base + shift + 12) % 12;
  const iv = ACC_INT[m[3] ?? ''] ?? ACC_INT[''];
  if (!iv) return null;
  const root = 45 + ((pc - 9 + 12) % 12);
  const tones = [root, root + (iv[2] ?? 0), root + 12 + (iv[1] ?? 0)];
  const seventh = iv[3];
  if (seventh !== undefined) tones.push(root + 12 + seventh);
  return tones.map(asMidi);
};

export interface ChordAt {
  /** 절대 박 인덱스 키 */
  readonly key: number;
  readonly str: string;
}

/** 해당 박에 유효한 코드 = 키 ≤ beat 인 최대 키 (다음 코드까지 지속) */
export const chordAtBeat = (
  chords: Readonly<Record<number, string>>,
  beat: number,
): ChordAt | null => {
  let best: number | null = null;
  for (const k of Object.keys(chords)) {
    const kk = +k;
    if (kk <= beat && (best === null || kk > best)) best = kk;
  }
  return best === null ? null : { key: best, str: chords[best] as string };
};
