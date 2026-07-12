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

  const n: Note = {
    id: nextId(song),
    s: asStep(abs),
    d: Math.min(INPUT_LEN, total(song) - abs),
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

/** 이전/다음 선택. 끝에서는 복제 추가로 전환 (SPEC §3.8) */
export const selectDir = (ctx: EditCtx, dir: 1 | -1): EditOut => {
  const { song } = ctx;
  const sorted = notesSorted(song);
  if (sorted.length === 0) return keep(ctx, '음표가 없습니다');
  const i = sorted.findIndex((n) => n.id === ctx.sel);

  if (dir > 0) {
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
  const n = sorted[i < 0 ? 0 : i - 1] as Note;
  return { ...keep(ctx), sel: n.id, curM: measOf(song, n.s), preview: n };
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
