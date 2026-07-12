/**
 * FakeClock — 시간을 원하는 만큼 밀고 프레임을 수동으로 발화한다 (테스트용).
 */
import { asSec } from '../../core/types';
import type { Clock } from '../../ports/clock';

export interface FakeClock extends Clock {
  advance(dt: number): void;
  /** 등록된 프레임 콜백 전부 1회 호출 */
  frame(): void;
  frameSubscriberCount(): number;
}

export const createFakeClock = (): FakeClock => {
  let t = 0;
  const cbs = new Set<() => void>();
  return {
    now: () => asSec(t),
    onFrame(cb) {
      cbs.add(cb);
      return () => cbs.delete(cb);
    },
    advance(dt) {
      t += dt;
    },
    frame() {
      [...cbs].forEach((cb) => cb());
    },
    frameSubscriberCount: () => cbs.size,
  };
};
