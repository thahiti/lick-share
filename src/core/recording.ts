/**
 * 레코딩 상태 머신 (piano-recording-design §2.1). 전부 순수 —
 * 시각(초)은 밖에서 주입한다. t=0 = 본편 시작(예비박 끝), 예비박 구간은 t<0.
 * sps(step당 초)는 engine의 secPerStep이 계산해 넘긴다 (core→engine 의존 금지).
 */
import { LEN_STEPS } from './constants';
import { measStart, total } from './geometry';
import { asStep, type BarIndex, type Midi, type Note, type Sec, type Song, type Step } from './types';

/** 커밋할 노트 스펙 — id는 스토어(insertRecorded)가 부여 */
export type NoteSpec = Pick<Note, 's' | 'd' | 'p'>;

export interface RecState {
  readonly startStep: Step;
  readonly endStep: Step;
  /** 누르고 있는 건반 — 모노포닉이라 최대 1개 */
  readonly held: { readonly p: Midi; readonly downT: Sec } | null;
}

export interface RecResult {
  readonly st: RecState;
  readonly commit: NoteSpec | null;
}

export interface TickResult extends RecResult {
  readonly done: boolean;
}

export const initRecording = (song: Song, curM: BarIndex): RecState => ({
  startStep: measStart(song, curM),
  endStep: asStep(total(song)),
  held: null,
});

/** 길이(스텝 실수)를 LEN_STEPS 최근접 값으로 스냅 (동률이면 짧은 쪽) */
const snapLen = (raw: number): number =>
  LEN_STEPS.reduce((best, v) => (Math.abs(v - raw) < Math.abs(best - raw) ? v : best));

/** max 이하의 최대 LEN_STEPS 값 (max ≥ 1 전제) */
const snapLenDown = (max: number): number => LEN_STEPS.filter((v) => v <= max).at(-1) ?? 1;

/** held → 커밋 스펙. 본편 범위 밖이면 null */
const commitHeld = (st: RecState, sps: number, upT: Sec): NoteSpec | null => {
  if (!st.held) return null;
  const s = st.startStep + Math.round(st.held.downT / sps);
  if (s < st.startStep || s >= st.endStep) return null;
  const d = snapLen((upT - st.held.downT) / sps);
  return { s: asStep(s), d: s + d > st.endStep ? snapLenDown(st.endStep - s) : d, p: st.held.p };
};

/** 건반 누름: 기존 held를 이 시각에 잘라 커밋(레가토 컷) 후 새로 hold */
export const recKeyDown = (st: RecState, sps: number, midi: Midi, t: Sec): RecResult => ({
  st: { ...st, held: { p: midi, downT: t } },
  commit: commitHeld(st, sps, t),
});

/** 건반 뗌: held와 같은 피치일 때만 커밋. 불일치(레가토 컷 잔여)는 무시 */
export const recKeyUp = (st: RecState, sps: number, midi: Midi, t: Sec): RecResult =>
  st.held && st.held.p === midi
    ? { st: { ...st, held: null }, commit: commitHeld(st, sps, t) }
    : { st, commit: null };

/** 건반 취소(pointercancel — 브라우저가 스크롤 제스처로 가져간 경우):
 *  의도된 연주가 아니므로 held를 커밋 없이 버린다. 피치 불일치는 무시 */
export const recKeyAbort = (st: RecState, midi: Midi): RecState =>
  st.held && st.held.p === midi ? { ...st, held: null } : st;

/** 프레임 틱: 본편 끝 도달 시 done + held 잔여 커밋 */
export const recTick = (st: RecState, sps: number, t: Sec): TickResult => {
  if (t < (st.endStep - st.startStep) * sps) return { st, commit: null, done: false };
  return { st: { ...st, held: null }, commit: commitHeld(st, sps, t), done: true };
};
