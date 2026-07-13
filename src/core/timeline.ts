/**
 * 공유 타임라인 좌표계 (editor-workspace-design §5) — 순수 함수.
 * 악보(StaffLane)·피아노롤·재생 헤드·선택 하이라이트가 모두 이 변환을 함께 사용해
 * 마디 경계가 픽셀 단위로 일치한다. 각 뷰가 독립적으로 x를 계산하지 않는다.
 * 확대/축소는 pxPerStep 하나만 조정한다.
 *
 * step은 곡 전체 스텝(SPM=16 기준), 반환값은 콘텐츠 영역(거터 제외) 로컬 x(px).
 * 거터/레이블 열 오프셋은 각 뷰가 CSS/래퍼에서 더한다 (LAYOUT.GUTTER_W).
 */

/** 줌(pxPerStep) 하한 — 촘촘한 축소 한계 */
export const ZOOM_MIN = 8;
/** 줌 상한 */
export const ZOOM_MAX = 32;
/** 기본 줌 */
export const ZOOM_DEFAULT = 14;

/** pxPerStep을 허용 범위로 클램프 */
export const clampZoom = (v: number): number => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v));

/** 스텝의 좌측 x */
export const stepToX = (step: number, pxPerStep: number): number => step * pxPerStep;

/** 스텝 셀의 중앙 x (단일 스텝 기준) */
export const stepCenterX = (step: number, pxPerStep: number): number => (step + 0.5) * pxPerStep;

/** 길이(스텝 수) → 폭(px) */
export const spanW = (d: number, pxPerStep: number): number => d * pxPerStep;

/** x(px) → 스텝 (floor 스냅, 0 하한) — 드래그·클릭 역변환 */
export const xToStep = (x: number, pxPerStep: number): number =>
  Math.max(0, Math.floor(x / pxPerStep));
