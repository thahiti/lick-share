/**
 * URL 해시 코덱 (SPEC §7). 형식: `v1<base64url 페이로드>` — 구분자 없음.
 * 메신저 링크 감지기가 '.'에서 URL을 절단해 해시가 유실되는 문제로 무점 형식만 사용하고,
 * 구형(v1.) 해시는 하위 호환 폐기(2026-07-15 결정)로 다른 잘못된 해시와 함께 null로 거부.
 * 페이로드 JSON 하위 호환: cb 없으면 코드 키 ×4, "r" 노트 필터, 누락 필드는 기본값.
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

/** 문자열 → UTF-8 바이트열의 base64url (패딩 없음) */
const b64e = (s: string): string => {
  const bin = unescape(encodeURIComponent(s));
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

/** base64url → 문자열. 유효하지 않으면 null */
const b64d = (s: string): string | null => {
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
  return decodeURIComponent(escape(bin));
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

export const encodeSong = (song: Song): string => {
  const o = {
    t: song.title,
    q: song.tempo,
    m: song.meas,
    p: song.pickup,
    ap: song.accPat,
    // 메트로놈이 'off'면 필드 자체를 생략 — 프로토타입 해시(메트로놈 이전)와 바이트 호환 유지
    ...(song.metro !== 'off' ? { mt: song.metro } : {}),
    am: song.mAcc,
    cb: 1,
    n: song.notes.map((n) => [n.s, n.d, n.p]),
    c: song.chords,
  };
  return `v1${b64e(JSON.stringify(o))}`;
};

export const decodeSong = (hash: string): Song | null => {
  try {
    if (!hash.startsWith('v1')) return null;
    const json = b64d(hash.slice(2));
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
