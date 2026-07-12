import { act, cleanup, render } from '@testing-library/react';
import type { JSX } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { useMediaQuery } from './useMediaQuery';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

type ChangeFn = (e: { matches: boolean }) => void;

/** 제어 가능한 matchMedia 페이크 */
const stubMatchMedia = (initial: boolean) => {
  const listeners = new Set<ChangeFn>();
  const mql = {
    matches: initial,
    media: '',
    addEventListener: (_: string, fn: ChangeFn) => listeners.add(fn),
    removeEventListener: (_: string, fn: ChangeFn) => listeners.delete(fn),
  };
  vi.stubGlobal('matchMedia', () => mql);
  return {
    fire: (m: boolean) => {
      mql.matches = m;
      listeners.forEach((fn) => fn({ matches: m }));
    },
    count: () => listeners.size,
  };
};

const Probe = ({ q }: { q: string }): JSX.Element => (
  <div data-testid="out">{useMediaQuery(q) ? 'y' : 'n'}</div>
);

describe('useMediaQuery', () => {
  test('초기값 반영', () => {
    stubMatchMedia(true);
    const { getByTestId } = render(<Probe q="(min-width: 900px)" />);
    expect(getByTestId('out').textContent).toBe('y');
  });

  test('change 이벤트에 반응', () => {
    const ctl = stubMatchMedia(false);
    const { getByTestId } = render(<Probe q="(min-width: 900px)" />);
    expect(getByTestId('out').textContent).toBe('n');
    act(() => ctl.fire(true));
    expect(getByTestId('out').textContent).toBe('y');
  });

  test('언마운트 시 리스너 해제', () => {
    const ctl = stubMatchMedia(false);
    const { unmount } = render(<Probe q="(min-width: 900px)" />);
    expect(ctl.count()).toBe(1);
    unmount();
    expect(ctl.count()).toBe(0);
  });
});
