/**
 * ScoreLink 도메인·조판 상수 (SPEC §2, §3.2).
 * 조판/레이아웃 수치는 여기 LAYOUT 한 곳에만 정의한다 (CLAUDE.md 절대 규칙).
 */

/** 마디당 16분음표 수 */
export const SPM = 16;
/** 마디당 박 수 (4/4) */
export const BPM_M = 4;
/** 최저 피치: 미3 */
export const PMIN = 52;
/** 최고 피치: 도6 */
export const PMAX = 84;
/** 허용 음길이 단계 (16분음표 개수) */
export const LEN_STEPS: readonly number[] = [1, 2, 3, 4, 6, 8, 12, 16];
/** 패드 입력 고정 길이 (4분음표) */
export const INPUT_LEN = 4;
/** 음길이 → 한국어 표기 (SMP 문자 금지) */
export const LEN_NAME: Readonly<Record<number, string>> = {
  1: '16분',
  2: '8분',
  3: '점8분',
  4: '4분',
  6: '점4분',
  8: '2분',
  12: '점2분',
  16: '온음표',
};

/** 반음계 계이름 (한국어) */
export const NOTE_KO: readonly string[] = ['도', '도♯', '레', '레♯', '미', '파', '파♯', '솔', '솔♯', '라', '라♯', '시'];
/** 반음계 음이름 (영문) */
export const NOTE_EN: readonly string[] = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
/** 검은건반 피치 클래스 */
export const BLACK_PC: ReadonlySet<number> = new Set([1, 3, 6, 8, 10]);
/** "도 C5" 형식 (스테퍼 현재 음 표기) */
export const pName = (p: number): string =>
  `${NOTE_KO[p % 12]} ${NOTE_EN[p % 12]}${Math.floor(p / 12 - 1)}`;
/** "도5" 형식 (스테퍼 이웃 음 표기) */
export const pShort = (p: number): string => `${NOTE_KO[p % 12]}${Math.floor(p / 12 - 1)}`;

/** 조판 상수 — 전부 여기서만 정의 */
export const LAYOUT = {
  /** 줄당 마디 수 */
  MPL: 4,
  /** 줄 높이 */
  LH: 118,
  /** 보표 선 간격 */
  LINEGAP: 10,
  /** 못갖춘마디 폭 = 일반 마디의 70% */
  PICKW: 0.7,
  /** 악보 좌우 패딩 (좌 8 + 우 8) */
  PAD_X: 8,
  /** 음자리표 영역 폭 */
  CLEF_W: 26,
  /** 단일 줄 기준 보표 top */
  STAFF_TOP: 42,
  /** 마디 히트영역 높이 */
  MHIT_H: 98,
  /** posX 인셋 최대값 */
  INSET_MAX: 9,
  /** posX 인셋 비율 */
  INSET_RATIO: 0.18,
  /** posX 우측 여유 */
  EDGE_GAP: 6,
} as const;
