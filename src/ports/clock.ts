/**
 * Clock 포트 — 지금 몇 시인가 + 프레임 콜백 (설계 문서 §2).
 */
import type { Sec } from '../core/types';

export interface Clock {
  now(): Sec;
  /** 프레임마다 cb 호출. 반환값은 구독 해제 함수 */
  onFrame(cb: () => void): () => void;
}
