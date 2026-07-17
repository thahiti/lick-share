/**
 * 마디 지오메트리 (SPEC §2.1, §3.2). 못갖춘마디(pickup) 지원.
 * 마디 ↔ 스텝 변환은 반드시 이 모듈만 사용한다 (오프셋 중복 계산 금지).
 */
import { LAYOUT, SPM } from './constants';
import { asBar, asStep, type BarIndex, type Midi, type Song, type Step } from './types';

/** 지오메트리에 필요한 최소 곡 정보 */
export type BarSpec = Pick<Song, 'meas' | 'pickup'>;

/** 곡 전체 스텝 수 */
export const total = (song: BarSpec): number => song.pickup + song.meas * SPM;

/** 전체 마디 수 (pickup 포함) */
export const measCountAll = (song: BarSpec): number => song.meas + (song.pickup ? 1 : 0);

/** 마디 시작 스텝 */
export const measStart = (song: BarSpec, m: BarIndex): Step =>
  asStep(song.pickup ? (m === 0 ? 0 : song.pickup + (m - 1) * SPM) : m * SPM);

/** 마디 길이 (스텝) */
export const measLen = (song: BarSpec, m: BarIndex): number =>
  song.pickup && m === 0 ? song.pickup : SPM;

/** 스텝이 속한 마디 */
export const measOf = (song: BarSpec, step: Step): BarIndex =>
  asBar(
    song.pickup
      ? step < song.pickup
        ? 0
        : 1 + Math.floor((step - song.pickup) / SPM)
      : Math.floor(step / SPM),
  );

/** 마디가 속한 줄 (MPL=4) */
export const lineOf = (song: BarSpec, m: BarIndex): number =>
  song.pickup ? (m === 0 ? 0 : Math.floor((m - 1) / LAYOUT.MPL)) : Math.floor(m / LAYOUT.MPL);

/** 마디 표기 라벨 */
export const measLabel = (song: BarSpec, m: BarIndex): string =>
  song.pickup && m === 0 ? 'Pickup' : `Bar ${song.pickup ? m : m + 1}`;

/** 컨테이너 폭 → 일반 마디 폭 */
export const computeMw = (song: BarSpec, width: number): number =>
  (width - LAYOUT.PAD_X * 2 - LAYOUT.CLEF_W) / (LAYOUT.MPL + (song.pickup ? LAYOUT.PICKW : 0));

/** 열람 악보 확대 배율 — 표시폭 w에 대해 논리폭 = w/viewScale(w).
 *  svg viewBox 스케일로 넓은 화면일수록 기보가 크게 보인다 */
export const viewScale = (w: number): number =>
  w >= LAYOUT.VZ_DESKTOP_MIN ? LAYOUT.VZ_DESKTOP : w >= LAYOUT.VZ_TABLET_MIN ? LAYOUT.VZ_TABLET : 1;

/** 마디 좌측 x */
export const measX = (song: BarSpec, mw: number, m: BarIndex): number => {
  const x0 = LAYOUT.PAD_X + LAYOUT.CLEF_W;
  if (song.pickup) {
    if (m === 0) return x0;
    const li = Math.floor((m - 1) / LAYOUT.MPL);
    return x0 + (li === 0 ? mw * LAYOUT.PICKW : 0) + ((m - 1) % LAYOUT.MPL) * mw;
  }
  return x0 + (m % LAYOUT.MPL) * mw;
};

/** 마디 폭 */
export const measW = (song: BarSpec, mw: number, m: BarIndex): number =>
  song.pickup && m === 0 ? mw * LAYOUT.PICKW : mw;

const DIA_MAP: readonly number[] = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const BLACK = new Set([1, 3, 6, 8, 10]);

export interface PitchDia {
  /** 온음계 좌표: 0=보표 최하단 선(E4), 반 칸 단위 */
  readonly step: number;
  /** 검은건반 여부 (♯ 임시표 표기) */
  readonly acc: boolean;
}

/** MIDI 피치 → 보표 온음계 좌표 (C장조 스펠링, 검은건반=♯) */
export const pitchDia = (p: Midi): PitchDia => {
  const oct = Math.floor(p / 12);
  const pc = p % 12;
  return { step: (DIA_MAP[pc] ?? 0) + (oct - 5) * 7 - 2, acc: BLACK.has(pc) };
};

/** 마디 내부 콘텐츠 x — 좌우 여백 제외 영역에 비례 배치 (마디선 넘침 방지) */
export const posX = (song: BarSpec, mw: number, m: BarIndex, frac: number): number => {
  const w = measW(song, mw, m);
  const inset = Math.min(LAYOUT.INSET_MAX, w * LAYOUT.INSET_RATIO);
  return measX(song, mw, m) + inset + frac * (w - inset - LAYOUT.EDGE_GAP);
};
