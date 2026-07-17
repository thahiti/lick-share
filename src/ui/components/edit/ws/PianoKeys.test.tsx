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

  test('흰건반 pointerdown → onKeyTap(pitch) — 소리 프리뷰용', () => {
    const { container, onKeyTap } = setup();
    fireEvent.pointerDown(container.querySelector('[data-key="60"]') as Element); // C4
    expect(onKeyTap).toHaveBeenCalledWith(60);
    expect(onKeyTap).toHaveBeenCalledTimes(1);
  });

  test('검은건반 pointerdown → onKeyTap(pitch)', () => {
    const { container, onKeyTap } = setup();
    fireEvent.pointerDown(container.querySelector('[data-key="61"]') as Element); // C♯4
    expect(onKeyTap).toHaveBeenCalledWith(61);
  });

  test('옥타브 레이블 C4·C5 노출', () => {
    const { container } = setup();
    expect(container.textContent).toContain('C4');
    expect(container.textContent).toContain('C5');
  });
});

describe('레코딩 모드 (piano-recording-design §3.3)', () => {
  test('recording=true면 pointerdown/up이 레코딩 콜백으로, 클릭 삽입 비활성', () => {
    const onKeyTap = vi.fn();
    const down = vi.fn();
    const up = vi.fn();
    const { container } = render(
      <PianoKeys onKeyTap={onKeyTap} recording onRecKeyDown={down} onRecKeyUp={up} />,
    );
    const key = container.querySelector('[data-key="60"]') as Element;
    fireEvent.pointerDown(key);
    fireEvent.pointerUp(key);
    expect(down).toHaveBeenCalledWith(60);
    expect(up).toHaveBeenCalledWith(60);
    fireEvent.click(key);
    expect(onKeyTap).not.toHaveBeenCalled();
    expect(container.querySelector('.pk.recording')).not.toBeNull();
  });

  test('pointercancel(스크롤 제스처)은 keyUp이 아니라 abort', () => {
    const up = vi.fn();
    const abort = vi.fn();
    const { container } = render(
      <PianoKeys
        onKeyTap={vi.fn()}
        recording
        onRecKeyDown={vi.fn()}
        onRecKeyUp={up}
        onRecKeyAbort={abort}
      />,
    );
    const key = container.querySelector('[data-key="61"]') as Element;
    fireEvent.pointerDown(key);
    fireEvent.pointerCancel(key);
    expect(abort).toHaveBeenCalledWith(61);
    expect(up).not.toHaveBeenCalled();
  });

  test('recording=false면 pointerdown 프리뷰 + recording 클래스 없음', () => {
    const { container, onKeyTap } = setup();
    fireEvent.pointerDown(container.querySelector('[data-key="60"]') as Element);
    expect(onKeyTap).toHaveBeenCalledWith(60);
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
