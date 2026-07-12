import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Toast } from './Toast';

afterEach(cleanup);

describe('Toast (DESIGN §4)', () => {
  test('메시지 표시 후 1.5초 뒤 onDone', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { container } = render(<Toast msg="쉼표로 변경" onDone={onDone} />);
    expect(container.textContent).toBe('쉼표로 변경');
    vi.advanceTimersByTime(1499);
    expect(onDone).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  test('msg가 null이면 렌더하지 않음', () => {
    const { container } = render(<Toast msg={null} onDone={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
