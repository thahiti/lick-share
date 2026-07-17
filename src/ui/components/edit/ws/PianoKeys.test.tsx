import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { PianoKeys } from './PianoKeys';

/* jsdom에는 elementFromPoint가 없다 — 이동 중 건반 판정을 좌표 대신 목으로 대체 */
type DocWithPoint = { elementFromPoint?: (x: number, y: number) => Element | null };
const mockPoint = (el: Element | null): void => {
  (document as unknown as DocWithPoint).elementFromPoint = () => el;
};

afterEach(() => {
  cleanup();
  delete (document as unknown as DocWithPoint).elementFromPoint;
});

const setup = () => {
  const onPreviewDown = vi.fn();
  const onPreviewUp = vi.fn();
  const utils = render(<PianoKeys onPreviewDown={onPreviewDown} onPreviewUp={onPreviewUp} />);
  return { ...utils, onPreviewDown, onPreviewUp };
};

describe('PianoKeys', () => {
  test('C2~C6 범위: 흰건반 29 · 검은건반 20', () => {
    const { container } = setup();
    expect(container.querySelectorAll('.pk-white')).toHaveLength(29);
    expect(container.querySelectorAll('.pk-black')).toHaveLength(20);
  });

  test('흰건반 pointerdown → onPreviewDown, pointerup → onPreviewUp (홀드 프리뷰)', () => {
    const { container, onPreviewDown, onPreviewUp } = setup();
    const key = container.querySelector('[data-key="60"]') as Element; // C4
    fireEvent.pointerDown(key);
    expect(onPreviewDown).toHaveBeenCalledWith(60);
    expect(onPreviewUp).not.toHaveBeenCalled();
    fireEvent.pointerUp(key);
    expect(onPreviewUp).toHaveBeenCalledWith(60);
  });

  test('검은건반 pointerdown → onPreviewDown(pitch)', () => {
    const { container, onPreviewDown } = setup();
    fireEvent.pointerDown(container.querySelector('[data-key="61"]') as Element); // C♯4
    expect(onPreviewDown).toHaveBeenCalledWith(61);
  });

  test('옥타브 레이블 C4·C5 노출', () => {
    const { container } = setup();
    expect(container.textContent).toContain('C4');
    expect(container.textContent).toContain('C5');
  });
});

describe('글리산도 (터치 이동 경로 발음)', () => {
  test('드래그로 다른 건반 진입 → 이전 up + 새 down', () => {
    const { container, onPreviewDown, onPreviewUp } = setup();
    const c4 = container.querySelector('[data-key="60"]') as Element;
    const d4 = container.querySelector('[data-key="62"]') as Element;
    fireEvent.pointerDown(c4);
    mockPoint(d4);
    fireEvent.pointerMove(window, { clientX: 30, clientY: 5 });
    expect(onPreviewUp).toHaveBeenCalledWith(60);
    expect(onPreviewDown).toHaveBeenLastCalledWith(62);
    fireEvent.pointerUp(window);
    expect(onPreviewUp).toHaveBeenLastCalledWith(62);
  });

  test('같은 건반 안 이동은 재발음 없음', () => {
    const { container, onPreviewDown, onPreviewUp } = setup();
    const c4 = container.querySelector('[data-key="60"]') as Element;
    fireEvent.pointerDown(c4);
    mockPoint(c4);
    fireEvent.pointerMove(window, { clientX: 3, clientY: 3 });
    expect(onPreviewDown).toHaveBeenCalledTimes(1);
    expect(onPreviewUp).not.toHaveBeenCalled();
  });

  test('건반 밖으로 나가면 up, 다시 들어오면 down', () => {
    const { container, onPreviewDown, onPreviewUp } = setup();
    const c4 = container.querySelector('[data-key="60"]') as Element;
    fireEvent.pointerDown(c4);
    mockPoint(null);
    fireEvent.pointerMove(window, { clientX: 0, clientY: 999 });
    expect(onPreviewUp).toHaveBeenCalledWith(60);
    mockPoint(c4);
    fireEvent.pointerMove(window, { clientX: 3, clientY: 3 });
    expect(onPreviewDown).toHaveBeenLastCalledWith(60);
    expect(onPreviewDown).toHaveBeenCalledTimes(2);
  });
});

describe('레코딩 모드 (piano-recording-design §3.3)', () => {
  const recSetup = () => {
    const onPreviewDown = vi.fn();
    const down = vi.fn();
    const up = vi.fn();
    const abort = vi.fn();
    const utils = render(
      <PianoKeys
        onPreviewDown={onPreviewDown}
        onPreviewUp={vi.fn()}
        recording
        onRecKeyDown={down}
        onRecKeyUp={up}
        onRecKeyAbort={abort}
      />,
    );
    return { ...utils, onPreviewDown, down, up, abort };
  };

  test('recording=true면 pointerdown/up이 레코딩 콜백으로, 프리뷰 비활성', () => {
    const { container, onPreviewDown, down, up } = recSetup();
    const key = container.querySelector('[data-key="60"]') as Element;
    fireEvent.pointerDown(key);
    fireEvent.pointerUp(key);
    expect(down).toHaveBeenCalledWith(60);
    expect(up).toHaveBeenCalledWith(60);
    expect(onPreviewDown).not.toHaveBeenCalled();
    expect(container.querySelector('.pk.recording')).not.toBeNull();
  });

  test('pointercancel(시스템 인터럽트)은 keyUp이 아니라 abort', () => {
    const { container, up, abort } = recSetup();
    const key = container.querySelector('[data-key="61"]') as Element;
    fireEvent.pointerDown(key);
    fireEvent.pointerCancel(key);
    expect(abort).toHaveBeenCalledWith(61);
    expect(up).not.toHaveBeenCalled();
  });

  test('레코딩 중 글리산도 → 이전 키 up + 새 키 down 캡처', () => {
    const { container, down, up } = recSetup();
    const c4 = container.querySelector('[data-key="60"]') as Element;
    const d4 = container.querySelector('[data-key="62"]') as Element;
    fireEvent.pointerDown(c4);
    mockPoint(d4);
    fireEvent.pointerMove(window, { clientX: 30, clientY: 5 });
    expect(up).toHaveBeenCalledWith(60);
    expect(down).toHaveBeenLastCalledWith(62);
  });

  test('recording=false면 pointerdown 프리뷰 + recording 클래스 없음', () => {
    const { container, onPreviewDown } = setup();
    fireEvent.pointerDown(container.querySelector('[data-key="60"]') as Element);
    expect(onPreviewDown).toHaveBeenCalledWith(60);
    expect(container.querySelector('.pk.recording')).toBeNull();
  });
});

describe('iPadOS 네이티브 제스처 차단', () => {
  test('건반 touchstart 기본 동작 취소 — long-press 선택·확대경·스크롤 억제', () => {
    const { container } = setup();
    const key = container.querySelector('[data-key="60"]') as Element;
    const ev = new Event('touchstart', { bubbles: true, cancelable: true });
    key.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  test('건반 contextmenu 기본 동작 취소 — long-press 콜아웃 억제', () => {
    const { container } = setup();
    const key = container.querySelector('[data-key="61"]') as Element;
    const ev = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    key.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });
});
