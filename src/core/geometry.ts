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

/**
 * 컨테이너 폭과 음표 밀도로 줄당 마디 수를 정한다: 4, 2, 1 중 하나.
 * 반씩 줄여야 4마디 릭이 2+2 로 고르게 나뉜다 (3+1 을 피한다).
 * 못갖춘마디의 0.7 폭은 첫 줄만 좁히므로 계산에 넣지 않는다.
 */
export const barsPerLine = (song: Pick<Song, 'meas' | 'pickup' | 'notes'>, width: number): number => {
  const usable = width - LAYOUT.PAD_X * 2 - LAYOUT.CLEF_W;
  const perBar: Record<number, number> = {};
  for (const n of song.notes) {
    const m = measOf(song, n.s);
    perBar[m] = (perBar[m] ?? 0) + 1;
  }
  const densest = Math.max(0, ...Object.values(perBar));
  const need = Math.max(
    LAYOUT.MIN_BAR_W,
    densest * LAYOUT.NOTE_W + LAYOUT.INSET_MAX + LAYOUT.EDGE_GAP,
  );
  let mpl: number = LAYOUT.MPL;
  while (mpl > 1 && usable / mpl < need) mpl /= 2;
  return mpl;
};

/** 마디가 속한 줄 (mpl = 줄당 마디 수) */
export const lineOf = (song: BarSpec, m: BarIndex, mpl: number): number =>
  song.pickup ? (m === 0 ? 0 : Math.floor((m - 1) / mpl)) : Math.floor(m / mpl);

/** 마디 표기 라벨 */
export const measLabel = (song: BarSpec, m: BarIndex): string =>
  song.pickup && m === 0 ? 'Pickup' : `Bar ${song.pickup ? m : m + 1}`;

/** 컨테이너 폭 → 일반 마디 폭 */
export const computeMw = (song: BarSpec, width: number, mpl: number): number =>
  (width - LAYOUT.PAD_X * 2 - LAYOUT.CLEF_W) / (mpl + (song.pickup ? LAYOUT.PICKW : 0));

/** 마디 좌측 x */
export const measX = (song: BarSpec, mw: number, m: BarIndex, mpl: number): number => {
  const x0 = LAYOUT.PAD_X + LAYOUT.CLEF_W;
  if (song.pickup) {
    if (m === 0) return x0;
    const li = Math.floor((m - 1) / mpl);
    return x0 + (li === 0 ? mw * LAYOUT.PICKW : 0) + ((m - 1) % mpl) * mw;
  }
  return x0 + (m % mpl) * mw;
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
export const posX = (
  song: BarSpec,
  mw: number,
  m: BarIndex,
  frac: number,
  mpl: number,
): number => {
  const w = measW(song, mw, m);
  const inset = Math.min(LAYOUT.INSET_MAX, w * LAYOUT.INSET_RATIO);
  return measX(song, mw, m, mpl) + inset + frac * (w - inset - LAYOUT.EDGE_GAP);
};
