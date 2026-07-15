/**
 * URL 해시 코덱 (SPEC §7). 인코딩은 `v2<base64url(바이너리)>` — 구분자 없음.
 * 메신저 링크 감지기의 두 제약(해시의 '.'에서 절단, URL 총 500자 초과 시 링크화 안 함) 때문에
 * 무점 + 컴팩트 바이너리(노트 델타 + varint)로 담는다. 디코딩은 v2와 무점 v1(JSON)을 수용하고,
 * 구형(v1.)·잘린·미래 버전 해시는 조용히 깨지지 않고 null로 거부(하위 호환 폐기 2026-07-15).
 * v1 페이로드 JSON 하위 호환: cb 없으면 코드 키 ×4, "r" 노트 필터, 누락 필드는 기본값.
 */
import { BPM_M } from './constants';
import {
  asMidi,
  asStep,
  type MeasureAcc,
  type MetroPattern,
  type Note,
  type Song,
} from './types';

/* base64url 문자표 — 프로토타입의 btoa 후 +→- /→_ 치환과 동일한 결과 */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** 바이너리 문자열(각 charCode가 1바이트) → base64url (패딩 없음) */
const binB64e = (bin: string): string => {
  let out = '';
  for (let i = 0; i < bin.length; i += 3) {
    const rest = bin.length - i;
    const b0 = bin.charCodeAt(i);
    const b1 = rest > 1 ? bin.charCodeAt(i + 1) : 0;
    const b2 = rest > 2 ? bin.charCodeAt(i + 2) : 0;
    out += B64.charAt(b0 >> 2);
    out += B64.charAt(((b0 & 3) << 4) | (b1 >> 4));
    if (rest > 1) out += B64.charAt(((b1 & 15) << 2) | (b2 >> 6));
    if (rest > 2) out += B64.charAt(b2 & 63);
  }
  return out;
};

/** base64url → 바이너리 문자열. 유효하지 않으면 null */
const binB64d = (s: string): string | null => {
  let bin = '';
  let buffer = 0;
  let bits = 0;
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) return null;
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bin += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return bin;
};

/** base64url → UTF-8 해석 문자열. 유효하지 않으면 null */
const b64d = (s: string): string | null => {
  const bin = binB64d(s);
  return bin === null ? null : decodeURIComponent(escape(bin));
};

/** 인코딩된 JSON 형태 (구버전 필드 포함) */
interface EncodedSong {
  t?: string;
  q?: number;
  m?: number;
  p?: number;
  ap?: string;
  mt?: string;
  am?: Record<string, string>;
  cb?: number;
  n?: (number | string)[][];
  c?: Record<string, string>;
}

/** 반주 패턴 유효값 ('off' 포함) — 전역·마디별 공용 검증 */
const MEAS_ACC: readonly MeasureAcc[] = ['pad', 'comp', 'arp', 'off'];
const METRO_PATTERNS: readonly MetroPattern[] = ['off', 'quarter'];

/* ── v2 바이너리 페이로드 ──
 * tempo(1B) · meas(varint) · flags(1B: bit0 pickup, bit1-2 accPat, bit3 metro)
 * · title(varint len + UTF-8) · am(varint n + [varint 마디, 1B acc])
 * · notes(varint n + s 정렬 [varint Δs, varint d, 1B p])
 * · chords(varint n + 키 정렬 [varint Δ키, varint len + UTF-8]) */

const pushVar = (b: number[], v: number): void => {
  let x = v;
  while (x > 127) {
    b.push((x & 127) | 128);
    x >>>= 7;
  }
  b.push(x);
};

const pushStr = (b: number[], s: string): void => {
  const u = unescape(encodeURIComponent(s));
  pushVar(b, u.length);
  for (let i = 0; i < u.length; i++) b.push(u.charCodeAt(i));
};

/** 읽기 커서. 모든 read는 EOF에서 null — 잘린 페이로드의 부분 파싱 방지 */
interface Cur {
  i: number;
}

const rByte = (bin: string, c: Cur): number | null =>
  c.i < bin.length ? bin.charCodeAt(c.i++) : null;

const rVar = (bin: string, c: Cur): number | null => {
  let v = 0;
  for (let shift = 0; shift < 35; shift += 7) {
    const b = rByte(bin, c);
    if (b === null) return null;
    v |= (b & 127) << shift;
    if ((b & 128) === 0) return v >>> 0;
  }
  return null;
};

const rStr = (bin: string, c: Cur): string | null => {
  const len = rVar(bin, c);
  if (len === null || c.i + len > bin.length) return null;
  const raw = bin.slice(c.i, c.i + len);
  c.i += len;
  return decodeURIComponent(escape(raw));
};

export const encodeSong = (song: Song): string => {
  const b: number[] = [];
  b.push(song.tempo & 0xff);
  pushVar(b, song.meas);
  b.push(
    (song.pickup === 8 ? 1 : 0) |
      (Math.max(0, MEAS_ACC.indexOf(song.accPat)) << 1) |
      (song.metro === 'quarter' ? 8 : 0),
  );
  pushStr(b, song.title);

  const am = Object.entries(song.mAcc)
    .map(([k, v]) => [+k, Math.max(0, MEAS_ACC.indexOf(v))] as const)
    .sort((x, y) => x[0] - y[0]);
  pushVar(b, am.length);
  for (const [m, a] of am) {
    pushVar(b, m);
    b.push(a);
  }

  const notes = [...song.notes].sort((x, y) => x.s - y.s);
  pushVar(b, notes.length);
  let ps = 0;
  for (const n of notes) {
    pushVar(b, n.s - ps);
    pushVar(b, n.d);
    b.push(n.p & 0x7f);
    ps = n.s;
  }

  const chords = Object.entries(song.chords)
    .map(([k, v]) => [+k, v] as const)
    .sort((x, y) => x[0] - y[0]);
  pushVar(b, chords.length);
  let pk = 0;
  for (const [k, name] of chords) {
    pushVar(b, k - pk);
    pushStr(b, name);
    pk = k;
  }

  return `v2${binB64e(String.fromCharCode(...b))}`;
};

const decodeV2 = (bin: string): Song | null => {
  const c: Cur = { i: 0 };
  const tempo = rByte(bin, c);
  const meas = rVar(bin, c);
  const flags = rByte(bin, c);
  const title = rStr(bin, c);
  if (tempo === null || meas === null || flags === null || title === null) return null;

  const amN = rVar(bin, c);
  if (amN === null) return null;
  const mAcc: Record<number, MeasureAcc> = {};
  for (let j = 0; j < amN; j++) {
    const m = rVar(bin, c);
    const a = rByte(bin, c);
    if (m === null || a === null || a >= MEAS_ACC.length) return null;
    mAcc[m] = MEAS_ACC[a] as MeasureAcc;
  }

  const noteN = rVar(bin, c);
  if (noteN === null) return null;
  const notes: Note[] = [];
  let s = 0;
  for (let j = 0; j < noteN; j++) {
    const ds = rVar(bin, c);
    const d = rVar(bin, c);
    const p = rByte(bin, c);
    if (ds === null || d === null || p === null) return null;
    s += ds;
    notes.push({ id: j + 1, s: asStep(s), d, p: asMidi(p) });
  }

  const chordN = rVar(bin, c);
  if (chordN === null) return null;
  const chords: Record<number, string> = {};
  let k = 0;
  for (let j = 0; j < chordN; j++) {
    const dk = rVar(bin, c);
    const name = rStr(bin, c);
    if (dk === null || name === null) return null;
    k += dk;
    chords[k] = name;
  }

  if (c.i !== bin.length) return null; // 여분 바이트 거부 — 손상 감지

  return {
    title: title || '제목 없음',
    tempo: tempo || 100,
    meas: meas || 4,
    pickup: (flags & 1) === 1 ? 8 : 0,
    accPat: MEAS_ACC[(flags >> 1) & 3] as MeasureAcc,
    metro: (flags & 8) === 8 ? 'quarter' : 'off',
    mAcc,
    notes,
    chords,
  };
};

/** 무점 v1 페이로드(JSON) 디코딩 — 오늘 이전에 공유된 링크 수용 */
const decodeV1 = (payload: string): Song | null => {
  try {
    const json = b64d(payload);
    if (json === null) return null;
    const o = JSON.parse(json) as EncodedSong;

    const rawChords = o.c ?? {};
    const chords: Record<number, string> = {};
    for (const [k, v] of Object.entries(rawChords)) {
      chords[o.cb ? +k : +k * BPM_M] = v;
    }

    const notes: Note[] = (o.n ?? [])
      .filter((a) => a[2] !== 'r')
      .map((a, i) => ({
        id: i + 1,
        s: asStep(Number(a[0])),
        d: Number(a[1]),
        p: asMidi(Number(a[2])),
      }));

    const mAcc: Record<number, MeasureAcc> = {};
    for (const [k, v] of Object.entries(o.am ?? {})) {
      if (MEAS_ACC.includes(v as MeasureAcc)) mAcc[+k] = v as MeasureAcc;
    }

    return {
      title: o.t || '제목 없음',
      tempo: o.q || 100,
      meas: o.m || 4,
      pickup: o.p === 8 ? 8 : 0,
      accPat: MEAS_ACC.includes(o.ap as MeasureAcc) ? (o.ap as MeasureAcc) : 'pad',
      metro: METRO_PATTERNS.includes(o.mt as MetroPattern) ? (o.mt as MetroPattern) : 'off',
      mAcc,
      notes,
      chords,
    };
  } catch {
    return null;
  }
};

export const decodeSong = (hash: string): Song | null => {
  try {
    if (hash.startsWith('v2')) {
      const bin = binB64d(hash.slice(2));
      return bin === null ? null : decodeV2(bin);
    }
    if (hash.startsWith('v1')) return decodeV1(hash.slice(2));
    return null;
  } catch {
    return null;
  }
};
