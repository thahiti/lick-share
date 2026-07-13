import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { PianoKeys } from './PianoKeys';

afterEach(cleanup);

const setup = () => {
  const onKeyTap = vi.fn();
  const utils = render(<PianoKeys onKeyTap={onKeyTap} />);
  return { ...utils, onKeyTap };
};

describe('PianoKeys', () => {
  test('C2~C6 범위: 흰건반 29 · 검은건반 20', () => {
    const { container } = setup();
    expect(container.querySelectorAll('.pk-white')).toHaveLength(29);
    expect(container.querySelectorAll('.pk-black')).toHaveLength(20);
  });

  test('흰건반 클릭 → onKeyTap(pitch)', () => {
    const { container, onKeyTap } = setup();
    fireEvent.click(container.querySelector('[data-key="60"]') as Element); // C4
    expect(onKeyTap).toHaveBeenCalledWith(60);
  });

  test('검은건반 클릭 → onKeyTap(pitch)', () => {
    const { container, onKeyTap } = setup();
    fireEvent.click(container.querySelector('[data-key="61"]') as Element); // C♯4
    expect(onKeyTap).toHaveBeenCalledWith(61);
  });

  test('옥타브 레이블 C4·C5 노출', () => {
    const { container } = setup();
    expect(container.textContent).toContain('C4');
    expect(container.textContent).toContain('C5');
  });
});
