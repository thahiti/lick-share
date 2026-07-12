/**
 * ScoreLink 도메인 타입 (SPEC §2).
 * 전부 number인 좌표계(스텝·피치·초·마디)가 섞이지 않도록 branded type으로 구분한다.
 */

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

/** 곡 처음부터의 절대 16분음표 인덱스 (pickup 포함) */
export type Step = Brand<number, 'Step'>;
/** MIDI 피치 (53=파3 ~ 84=도6) */
export type Midi = Brand<number, 'Midi'>;
/** 초 단위 시간 */
export type Sec = Brand<number, 'Sec'>;
/** 마디 인덱스 (pickup이 있으면 0=못갖춘마디) */
export type BarIndex = Brand<number, 'BarIndex'>;

export const asStep = (n: number): Step => n as Step;
export const asMidi = (n: number): Midi => n as Midi;
export const asSec = (n: number): Sec => n as Sec;
export const asBar = (n: number): BarIndex => n as BarIndex;

export interface Note {
  /** 세션 내 유니크 */
  readonly id: number;
  /** 시작 스텝 */
  readonly s: Step;
  /** 길이: 16분음표 개수 */
  readonly d: number;
  /** MIDI 피치 */
  readonly p: Midi;
}

export type AccPattern = 'pad' | 'comp' | 'arp';
export type MeasureAcc = AccPattern | 'off';

export interface Song {
  readonly title: string;
  /** 40~240, 기본 100 */
  readonly tempo: number;
  /** 일반 마디 수, 기본 4 */
  readonly meas: number;
  /** 못갖춘마디 (0=없음, 8=2박) */
  readonly pickup: 0 | 8;
  /** 전역 반주 패턴, 기본 'pad' */
  readonly accPat: AccPattern;
  /** 마디별 오버라이드 (키=마디 인덱스) */
  readonly mAcc: Readonly<Record<number, MeasureAcc>>;
  readonly notes: readonly Note[];
  /** 키 = 절대 박 인덱스 (s/4), 값 = "C", "F♯m7" 등 */
  readonly chords: Readonly<Record<number, string>>;
}
