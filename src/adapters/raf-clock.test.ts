import { afterEach, describe, expect, test, vi } from 'vitest';
import { createRafClock } from './raf-clock';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RafClock', () => {
  test('onFrame: 프레임마다 콜백, 해제 후 중단', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const clock = createRafClock();
    const seen: number[] = [];
    const unsub = clock.onFrame(() => seen.push(1));

    frames.shift()?.(0); // 첫 프레임 발화
    frames.shift()?.(0);
    expect(seen).toHaveLength(2);

    unsub();
    frames.shift()?.(0);
    expect(seen).toHaveLength(2);
  });

  test('now(): performance.now 기반 초 단위', () => {
    vi.stubGlobal('performance', { now: () => 2500 });
    const clock = createRafClock();
    expect(clock.now()).toBeCloseTo(2.5);
  });
});
