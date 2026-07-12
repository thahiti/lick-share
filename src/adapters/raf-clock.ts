/**
 * RafClock — requestAnimationFrame 루프 기반 Clock.
 */
import { asSec } from '../core/types';
import type { Clock } from '../ports/clock';

export const createRafClock = (): Clock => ({
  now: () => asSec(performance.now() / 1000),
  onFrame(cb) {
    let active = true;
    let id = 0;
    const loop = (): void => {
      if (!active) return;
      cb();
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => {
      active = false;
      cancelAnimationFrame(id);
    };
  },
});
