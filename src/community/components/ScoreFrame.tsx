/**
 * 악보 프레임 (핸드오프 §4 — 이 시안의 정체성).
 * 툴바와 악보를 하나의 카드 컨테이너로 묶는다. R1~R7:
 * - R1 툴바·악보가 같은 컨테이너 안, R2 눈에 보이는 경계(c-card),
 * - R3 툴바가 내부 최상단에 밀착, R4 툴바와 악보 사이 구분선,
 * - R5 재생 관련 컨트롤은 전부 이 안에(툴바), R6 컬럼 폭을 채움,
 * - R7 내부 overflow hidden — 악보 가로 스크롤은 프레임 안쪽에서.
 */
import type { JSX } from 'react';

interface Props {
  /** 프레임 최상단 툴바 (ScoreToolbar) */
  readonly toolbar: JSX.Element;
  /** 악보 뷰 (ScoreView) */
  readonly children: JSX.Element;
}

export const ScoreFrame = ({ toolbar, children }: Props): JSX.Element => (
  <div className="c-frame">
    {toolbar}
    <div className="c-frame-divider" />
    <div className="c-frame-score">{children}</div>
  </div>
);
