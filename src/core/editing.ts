/**
 * 편집 연산 (SPEC §3.3~§3.8). 전부 (ctx) => ctx' 순수 함수.
 * changed=true인 결과만 스토어가 undo 스냅샷을 쌓는다.
 */
import { INPUT_LEN, LEN_STEPS, PMAX, PMIN } from './constants';
import { measLen, measOf, measStart, measCountAll, total } from './geometry';
import { resolveOverlap } from './overlap';
import {
  asBar,
  asMidi,
  asStep,
  type BarIndex,
  type MeasureAcc,
  type Midi,
  type Note,
  type Song,
} from './types';

export interface EditCtx {
  readonly song: Song;
  readonly sel: number | null;
  readonly curM: BarIndex;
}

export interface EditOut extends EditCtx {
  /** true면 파괴적 조작 — 스토어가 이전 Song을 undo 스택에 push */
  readonly changed: boolean;
  readonly toast?: string;
  /** 프리뷰 사운드 대상 (소리 피드백은 입력·선택·음높이 변경에만) */
  readonly preview?: Note;
}

const keep = (ctx: EditCtx, toast?: string): EditOut =>
  toast === undefined ? { ...ctx, changed: false } : { ...ctx, changed: false, toast };

const notesSorted = (song: Song): Note[] => [...song.notes].sort((a, b) => a.s - b.s);

const getSel = (ctx: EditCtx): Note | null => ctx.song.notes.find((n) => n.id === ctx.sel) ?? null;

const nextId = (song: Song): number => song.notes.reduce((m, n) => Math.max(m, n.id), 0) + 1;

/** 셀 상태: 해당 피치(p)가 그 스텝을 점유하는 노트. p=null이면 아무 노트나 */
export const noteAt = (song: Song, abs: number, p: Midi | null = null): Note | null =>
  song.notes.find((n) => (p === null || n.p === p) && n.s <= abs && abs < n.s + n.d) ?? null;

/** 빈 지점 입력 길이: 뒤 노트를 덮지 않도록 다음 노트 시작·곡 끝까지로 클램프 */
const freeLen = (song: Song, abs: number, len: number): number => {
  const next = song.notes.reduce((m, n) => (n.s > abs && n.s < m ? n.s : m), total(song));
  return Math.max(1, Math.min(len, next - abs));
};

/** 패드 셀 탭. pv='rest'는 쉼표 행 */
export const padTap = (ctx: EditCtx, pv: Midi | 'rest', st: number): EditOut => {
  const { song, sel, curM } = ctx;
  const abs = measStart(song, curM) + st;

  if (pv === 'rest') {
    const n = noteAt(song, abs);
    if (!n) return keep(ctx, '이미 쉼표입니다');
    if (abs === n.s) {
      return {
        song: { ...song, notes: song.notes.filter((x) => x.id !== n.id) },
        sel: sel === n.id ? null : sel,
        curM,
        changed: true,
        toast: '쉼표로 변경',
      };
    }
    return {
      song: {
        ...song,
        notes: song.notes.map((x) => (x.id === n.id ? { ...x, d: abs - x.s } : x)),
      },
      sel,
      curM,
      changed: true,
      toast: '쉼표로 변경',
    };
  }

  const hit = noteAt(song, abs, pv);
  if (hit) {
    if (hit.id === sel) {
      return {
        song: { ...song, notes: song.notes.filter((n) => n.id !== sel) },
        sel: null,
        curM,
        changed: true,
        toast: '삭제됨',
      };
    }
    return { ...keep(ctx), sel: hit.id, preview: hit };
  }

  // 그 지점을 점유한 노트는 덮어쓰되(겹침 해소), 다음 노트는 침범하지 않도록 클램프
  const n: Note = {
    id: nextId(song),
    s: asStep(abs),
    d: freeLen(song, abs, INPUT_LEN),
    p: pv,
  };
  return {
    song: { ...song, notes: resolveOverlap([...song.notes, n], n) },
    sel: n.id,
    curM,
    changed: true,
    preview: n,
  };
};

/** 음높이 스테퍼: 반음 이동, 53~84 클램프 */
export const stepPitch = (ctx: EditCtx, dir: 1 | -1): EditOut => {
  const n = getSel(ctx);
  if (!n) return keep(ctx);
  const np = n.p + dir;
  if (np < PMIN || np > PMAX) return keep(ctx);
  const moved = { ...n, p: asMidi(np) };
  return {
    song: { ...ctx.song, notes: ctx.song.notes.map((x) => (x.id === n.id ? moved : x)) },
    sel: ctx.sel,
    curM: ctx.curM,
    changed: true,
    preview: moved,
  };
};

/** 위치 스테퍼: 16분 이동, 0~TOTAL 클램프 + curM 추적 + 겹침 해소 */
export const stepPos = (ctx: EditCtx, dir: 1 | -1): EditOut => {
  const n = getSel(ctx);
  if (!n) return keep(ctx);
  const ns = n.s + dir;
  if (ns < 0 || ns + n.d > total(ctx.song)) return keep(ctx);
  const moved = { ...n, s: asStep(ns) };
  return {
    song: {
      ...ctx.song,
      notes: resolveOverlap(
        ctx.song.notes.map((x) => (x.id === n.id ? moved : x)),
        moved,
      ),
    },
    sel: ctx.sel,
    curM: measOf(ctx.song, moved.s),
    changed: true,
  };
};

/** 길이 스테퍼: LEN_STEPS 단계 이동, 곡 끝 클램프 + 겹침 해소 */
export const stepLen = (ctx: EditCtx, dir: 1 | -1): EditOut => {
  const n = getSel(ctx);
  if (!n) return keep(ctx);
  let li = LEN_STEPS.indexOf(n.d);
  if (li < 0) {
    li = LEN_STEPS.findIndex((v) => v > n.d);
    if (li < 0) li = LEN_STEPS.length - 1;
    if (dir < 0) li--;
  } else {
    li += dir;
  }
  if (li < 0 || li >= LEN_STEPS.length) return keep(ctx);
  const nd = LEN_STEPS[li] as number;
  if (n.s + nd > total(ctx.song)) return keep(ctx);
  const resized = { ...n, d: nd };
  return {
    song: {
      ...ctx.song,
      notes: resolveOverlap(
        ctx.song.notes.map((x) => (x.id === n.id ? resized : x)),
        resized,
      ),
    },
    sel: ctx.sel,
    curM: ctx.curM,
    changed: true,
  };
};

/** 음이 걸친 마지막 마디 */
const lastMeasOf = (song: Song, n: Note): BarIndex => measOf(song, asStep(n.s + n.d - 1));

/** 이전/다음 선택. 끝에서는 복제 추가로 전환 (SPEC §3.8) */
export const selectDir = (ctx: EditCtx, dir: 1 | -1): EditOut => {
  const { song, curM } = ctx;
  const sorted = notesSorted(song);
  if (sorted.length === 0) return keep(ctx, '음표가 없습니다');
  const cur = getSel(ctx);
  const i = sorted.findIndex((n) => n.id === ctx.sel);

  if (dir > 0) {
    // 마디에 걸친 음: 아직 마지막 마디를 안 봤으면 같은 음의 다음 마디 뷰로만 이동
    if (cur && curM < lastMeasOf(song, cur)) return { ...keep(ctx), curM: asBar(curM + 1) };
    if (i === sorted.length - 1) {
      const last = sorted[sorted.length - 1] as Note;
      const ns = last.s + last.d;
      if (ns >= total(song)) return keep(ctx, '곡 끝 — 마디를 추가하세요');
      const n: Note = {
        id: nextId(song),
        s: asStep(ns),
        d: Math.min(last.d, total(song) - ns),
        p: last.p,
      };
      return {
        song: { ...song, notes: resolveOverlap([...song.notes, n], n) },
        sel: n.id,
        curM: measOf(song, n.s),
        changed: true,
        preview: n,
        toast: '직전 음 복제 추가',
      };
    }
    const n = sorted[i < 0 ? 0 : i + 1] as Note;
    return { ...keep(ctx), sel: n.id, curM: measOf(song, n.s), preview: n };
  }

  // 마디에 걸친 음: 아직 시작 마디를 안 봤으면 같은 음의 이전 마디 뷰로만 이동
  if (cur && curM > measOf(song, cur.s)) return { ...keep(ctx), curM: asBar(curM - 1) };
  if (i === 0) {
    const first = sorted[0] as Note;
    if (first.s <= 0) return keep(ctx, '곡 처음입니다');
    const d = Math.min(first.d, first.s);
    const n: Note = { id: nextId(song), s: asStep(first.s - d), d, p: first.p };
    return {
      song: { ...song, notes: resolveOverlap([...song.notes, n], n) },
      sel: n.id,
      curM: measOf(song, n.s),
      changed: true,
      preview: n,
      toast: '앞에 복제 추가',
    };
  }
  // 뒤로 이동은 이전 음의 마지막 마디로 진입 (걸친 음을 오른쪽부터 방문)
  const n = sorted[i < 0 ? 0 : i - 1] as Note;
  return { ...keep(ctx), sel: n.id, curM: lastMeasOf(song, n), preview: n };
};

/** 선택 노트 삭제, 이전 노트 자동 선택 */
export const deleteSel = (ctx: EditCtx): EditOut => {
  const n = getSel(ctx);
  if (!n) return keep(ctx);
  const sorted = notesSorted(ctx.song);
  const i = sorted.findIndex((x) => x.id === n.id);
  const prev = i > 0 ? (sorted[i - 1] as Note).id : null;
  return {
    song: { ...ctx.song, notes: ctx.song.notes.filter((x) => x.id !== n.id) },
    sel: prev,
    curM: ctx.curM,
    changed: true,
  };
};

/** 못갖춘마디(2박) 추가: notes s+=8, 코드 키+2, mAcc 키+1. 중복 호출 no-op */
export const addPickup = (ctx: EditCtx): EditOut => {
  const { song } = ctx;
  if (song.pickup) return keep(ctx);
  const chords: Record<number, string> = {};
  for (const [k, v] of Object.entries(song.chords)) chords[+k + 2] = v;
  const mAcc: Record<number, MeasureAcc> = {};
  for (const [k, v] of Object.entries(song.mAcc)) mAcc[+k + 1] = v;
  return {
    song: {
      ...song,
      pickup: 8,
      notes: song.notes.map((n) => ({ ...n, s: asStep(n.s + 8) })),
      chords,
      mAcc,
    },
    sel: ctx.sel,
    curM: asBar(0),
    changed: true,
    toast: '못갖춘마디 추가 (2박)',
  };
};

/** 일반 마디 1개 추가 후 그 마디로 이동 */
export const addMeasure = (ctx: EditCtx): EditOut => {
  const song = { ...ctx.song, meas: ctx.song.meas + 1 };
  return {
    song,
    sel: ctx.sel,
    curM: asBar(measCountAll(song) - 1),
    changed: true,
    toast: `마디 ${song.meas} 추가`,
  };
};

/** 코드 설정(chord=null이면 삭제). 키 = 절대 박 인덱스 */
export const setChord = (ctx: EditCtx, beatKey: number, chord: string | null): EditOut => {
  const chords: Record<number, string> = {};
  for (const [k, v] of Object.entries(ctx.song.chords)) {
    if (+k !== beatKey) chords[+k] = v;
  }
  if (chord !== null) chords[beatKey] = chord;
  return { ...ctx, song: { ...ctx.song, chords }, changed: true };
};

/** 마디 탭/이동: 그 마디로 이동 + 첫 노트(걸친 음 포함, s 최소) 자동 선택 (SPEC §3.2) */
export const gotoMeasure = (ctx: EditCtx, m: BarIndex): EditOut => {
  const ms = measStart(ctx.song, m);
  const me = ms + measLen(ctx.song, m);
  const first = ctx.song.notes
    .filter((n) => n.s < me && n.s + n.d > ms)
    .reduce<Note | null>((best, n) => (best === null || n.s < best.s ? n : best), null);
  const base = { ...keep(ctx), curM: m, sel: first?.id ?? null };
  return first ? { ...base, preview: first } : base;
};

/** 템포 설정: 40~240 클램프 + 반올림. 숫자가 아니면 유지 (SPEC §3.1) */
export const setTempo = (ctx: EditCtx, v: number): EditOut => {
  const rounded = Math.round(v);
  if (!Number.isFinite(rounded)) return keep(ctx);
  const tempo = Math.max(40, Math.min(240, rounded));
  if (tempo === ctx.song.tempo) return keep(ctx);
  return { ...ctx, song: { ...ctx.song, tempo }, changed: true };
};

// ── 데스크톱 워크스페이스 편집 (editor-workspace-design §6) ──

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** 음이름(A~G) → 피치 클래스 (C=0 기준) */
const LETTER_PC: Readonly<Record<string, number>> = {
  c: 0,
  d: 2,
  e: 4,
  f: 5,
  g: 7,
  a: 9,
  b: 11,
};

/** 음이름을 기준 피치에서 가장 가까운 옥타브로 변환. 거리 동률이면 아래쪽, PMIN~PMAX 클램프 */
export const letterPitch = (ref: Midi, letter: string): Midi => {
  const pc = LETTER_PC[letter.toLowerCase()];
  if (pc === undefined) return ref;
  // ref 근처 옥타브의 후보 중 최근접(동률이면 아래) 선택
  const base = Math.round((ref - pc) / 12) * 12 + pc;
  let best = base;
  for (const cand of [base - 12, base, base + 12]) {
    const dBest = Math.abs(best - ref);
    const dCand = Math.abs(cand - ref);
    // 더 가깝거나, 동률이면 더 낮은 쪽 채택
    if (dCand < dBest || (dCand === dBest && cand < best)) best = cand;
  }
  // 범위를 벗어나면 같은 음이름의 가장 가까운 in-range 옥타브로
  while (best < PMIN) best += 12;
  while (best > PMAX) best -= 12;
  return asMidi(clamp(best, PMIN, PMAX));
};

/** 선택 노트를 음이름의 최근접 옥타브로 재배치 (없으면 no-op, 같은 피치면 no-op) */
export const renoteSel = (ctx: EditCtx, letter: string): EditOut => {
  const n = getSel(ctx);
  if (!n) return keep(ctx);
  const np = letterPitch(n.p, letter);
  if (np === n.p) return keep(ctx);
  const moved = { ...n, p: np };
  return {
    song: { ...ctx.song, notes: ctx.song.notes.map((x) => (x.id === n.id ? moved : x)) },
    sel: ctx.sel,
    curM: ctx.curM,
    changed: true,
    preview: moved,
  };
};

/** 현재 마디의 다음 빈 박(박 시작 스텝이 비어있는 첫 박)에 입력 + 선택 */
export const insertAtFreeBeat = (ctx: EditCtx, p: Midi, len: number): EditOut => {
  const { song, curM } = ctx;
  const ms = measStart(song, curM);
  const beats = Math.floor(measLen(song, curM) / 4);
  for (let b = 0; b < beats; b++) {
    const abs = ms + b * 4;
    if (noteAt(song, asStep(abs)) === null) {
      const n: Note = {
        id: nextId(song),
        s: asStep(abs),
        d: freeLen(song, abs, len),
        p,
      };
      return {
        song: { ...song, notes: resolveOverlap([...song.notes, n], n) },
        sel: n.id,
        curM,
        changed: true,
        preview: n,
      };
    }
  }
  return keep(ctx, '빈 박이 없습니다');
};

/** 선택 노트 길이를 지정값으로 설정 (곡 끝 클램프 + 겹침 해소) */
export const setNoteLen = (ctx: EditCtx, len: number): EditOut => {
  const n = getSel(ctx);
  if (!n) return keep(ctx);
  const nd = Math.max(1, Math.min(len, total(ctx.song) - n.s));
  if (nd === n.d) return keep(ctx);
  const resized = { ...n, d: nd };
  return {
    song: {
      ...ctx.song,
      notes: resolveOverlap(
        ctx.song.notes.map((x) => (x.id === n.id ? resized : x)),
        resized,
      ),
    },
    sel: ctx.sel,
    curM: ctx.curM,
    changed: true,
  };
};

/** 드래그 편집: 노트의 시작/피치/길이를 패치 (전부 클램프 + 겹침 해소). pointerup 단일 커밋용 */
export const updateNote = (
  ctx: EditCtx,
  id: number,
  patch: { readonly s?: number; readonly p?: Midi; readonly d?: number },
): EditOut => {
  const n = ctx.song.notes.find((x) => x.id === id);
  if (!n) return keep(ctx);
  const T = total(ctx.song);
  const nd0 = patch.d !== undefined ? clamp(patch.d, 1, T) : n.d;
  const ns = patch.s !== undefined ? clamp(patch.s, 0, T - 1) : n.s;
  const nd = Math.max(1, Math.min(nd0, T - ns));
  const np = patch.p !== undefined ? clamp(patch.p, PMIN, PMAX) : n.p;
  const moved = { ...n, s: asStep(ns), d: nd, p: asMidi(np) };
  if (moved.s === n.s && moved.d === n.d && moved.p === n.p) return keep(ctx);
  return {
    song: {
      ...ctx.song,
      notes: resolveOverlap(
        ctx.song.notes.map((x) => (x.id === n.id ? moved : x)),
        moved,
      ),
    },
    sel: ctx.sel,
    curM: measOf(ctx.song, moved.s),
    changed: true,
    ...(patch.p !== undefined ? { preview: moved } : {}),
  };
};

/** 레코딩 커밋: 지정 스텝·길이로 삽입 + 겹침 해소 (piano-recording-design §2.4).
 *  선택·프리뷰 변경 없음 — 탭 사운드는 즉시 발음 경로가 담당 */
export const insertRecorded = (song: Song, spec: Pick<Note, 's' | 'd' | 'p'>): Song => {
  const n: Note = { id: nextId(song), ...spec };
  return { ...song, notes: resolveOverlap([...song.notes, n], n) };
};

const ACC_CYCLE: readonly (MeasureAcc | undefined)[] = [undefined, 'pad', 'comp', 'arp', 'off'];

/** 현재 마디 반주 오버라이드 순환: 기본→pad→comp→arp→off→기본 */
export const cycleMeasureAcc = (ctx: EditCtx): EditOut => {
  const cur = ctx.song.mAcc[ctx.curM];
  const next = ACC_CYCLE[(ACC_CYCLE.indexOf(cur) + 1) % ACC_CYCLE.length];
  const mAcc: Record<number, MeasureAcc> = {};
  for (const [k, v] of Object.entries(ctx.song.mAcc)) {
    if (+k !== ctx.curM) mAcc[+k] = v;
  }
  if (next !== undefined) mAcc[ctx.curM] = next;
  return { ...ctx, song: { ...ctx.song, mAcc }, changed: true };
};
