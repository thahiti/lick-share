import { cleanup, fireEvent, render } from '@testing-library/react';
import type { JSX } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  resolveShortcut,
  useKeyboardShortcuts,
  type ShortcutAction,
} from './useKeyboardShortcuts';

afterEach(cleanup);

const ev = (key: string, mods: Partial<KeyboardEvent> = {}): KeyboardEvent =>
  new KeyboardEvent('keydown', { key, ...mods });

describe('resolveShortcut', () => {
  test('화살표/Vim 등가 매핑', () => {
    expect(resolveShortcut(ev('ArrowLeft'))).toBe('selectPrev');
    expect(resolveShortcut(ev('h'))).toBe('selectPrev');
    expect(resolveShortcut(ev('ArrowRight'))).toBe('selectNext');
    expect(resolveShortcut(ev('l'))).toBe('selectNext');
    expect(resolveShortcut(ev('ArrowUp'))).toBe('pitchUp');
    expect(resolveShortcut(ev('k'))).toBe('pitchUp');
    expect(resolveShortcut(ev('ArrowDown'))).toBe('pitchDown');
    expect(resolveShortcut(ev('j'))).toBe('pitchDown');
  });

  test('Shift = 위치/길이', () => {
    expect(resolveShortcut(ev('ArrowLeft', { shiftKey: true }))).toBe('posBack');
    expect(resolveShortcut(ev('H', { shiftKey: true }))).toBe('posBack');
    expect(resolveShortcut(ev('ArrowRight', { shiftKey: true }))).toBe('posFwd');
    expect(resolveShortcut(ev('ArrowUp', { shiftKey: true }))).toBe('lenInc');
    expect(resolveShortcut(ev('J', { shiftKey: true }))).toBe('lenDec');
  });

  test('재생/편집/이동/실행취소/esc', () => {
    expect(resolveShortcut(ev(' '))).toBe('playToggle');
    expect(resolveShortcut(ev('Enter'))).toBe('playMeasure');
    expect(resolveShortcut(ev('Delete'))).toBe('del');
    expect(resolveShortcut(ev('Backspace'))).toBe('del');
    expect(resolveShortcut(ev('['))).toBe('measPrev');
    expect(resolveShortcut(ev(']'))).toBe('measNext');
    expect(resolveShortcut(ev('z', { metaKey: true }))).toBe('undo');
    expect(resolveShortcut(ev('z', { metaKey: true, shiftKey: true }))).toBe('redo');
    expect(resolveShortcut(ev('z', { ctrlKey: true }))).toBe('undo');
    expect(resolveShortcut(ev('Escape'))).toBe('escape');
  });

  test('모디파이어 조합/미지정 키는 null', () => {
    expect(resolveShortcut(ev('a', { metaKey: true }))).toBeNull();
    expect(resolveShortcut(ev('x'))).toBeNull();
  });

  test('한글 모드: ㅗㅓㅏㅣ(hjkl 물리 위치) → 동일 동작', () => {
    expect(resolveShortcut(ev('ㅗ', { code: 'KeyH' }))).toBe('selectPrev');
    expect(resolveShortcut(ev('ㅓ', { code: 'KeyJ' }))).toBe('pitchDown');
    expect(resolveShortcut(ev('ㅏ', { code: 'KeyK' }))).toBe('pitchUp');
    expect(resolveShortcut(ev('ㅣ', { code: 'KeyL' }))).toBe('selectNext');
  });

  test('한글 모드 + Shift → 위치/길이', () => {
    expect(resolveShortcut(ev('ㅗ', { code: 'KeyH', shiftKey: true }))).toBe('posBack');
    expect(resolveShortcut(ev('ㅏ', { code: 'KeyK', shiftKey: true }))).toBe('lenInc');
    expect(resolveShortcut(ev('ㅓ', { code: 'KeyJ', shiftKey: true }))).toBe('lenDec');
  });

  test('한글 모드 Cmd+Z(ㅋ) → 실행취소/재실행', () => {
    expect(resolveShortcut(ev('ㅋ', { code: 'KeyZ', metaKey: true }))).toBe('undo');
    expect(resolveShortcut(ev('ㅋ', { code: 'KeyZ', metaKey: true, shiftKey: true }))).toBe('redo');
  });

  test('Windows IME Process 키 → 물리 코드로 보정', () => {
    expect(resolveShortcut(ev('Process', { code: 'KeyJ' }))).toBe('pitchDown');
  });

  test('영문 자판 의미는 유지 (미지정 비라틴 키는 null)', () => {
    expect(resolveShortcut(ev('ㅁ', { code: 'KeyA' }))).toBeNull();
  });
});

const noop = (): void => {};
const emptyHandlers = (): Record<ShortcutAction, () => void> => ({
  selectPrev: noop,
  selectNext: noop,
  pitchUp: noop,
  pitchDown: noop,
  posBack: noop,
  posFwd: noop,
  lenInc: noop,
  lenDec: noop,
  playToggle: noop,
  playMeasure: noop,
  del: noop,
  measPrev: noop,
  measNext: noop,
  undo: noop,
  redo: noop,
  escape: noop,
});

const Harness = ({
  handlers,
  enabled,
}: {
  handlers: Record<ShortcutAction, () => void>;
  enabled: boolean;
}): JSX.Element => {
  useKeyboardShortcuts(handlers, enabled);
  return <input data-testid="inp" />;
};

describe('useKeyboardShortcuts', () => {
  test('enabled 시 액션 디스패치 + preventDefault', () => {
    const h = { ...emptyHandlers(), selectNext: vi.fn() };
    render(<Harness handlers={h} enabled={true} />);
    const e = new KeyboardEvent('keydown', { key: 'l', cancelable: true });
    const spy = vi.spyOn(e, 'preventDefault');
    window.dispatchEvent(e);
    expect(h.selectNext).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalled();
  });

  test('input 포커스 중 무시', () => {
    const h = { ...emptyHandlers(), selectNext: vi.fn() };
    const { getByTestId } = render(<Harness handlers={h} enabled={true} />);
    (getByTestId('inp') as HTMLInputElement).focus();
    fireEvent.keyDown(window, { key: 'l' });
    expect(h.selectNext).not.toHaveBeenCalled();
  });

  test('enabled=false면 무시', () => {
    const h = { ...emptyHandlers(), playToggle: vi.fn() };
    render(<Harness handlers={h} enabled={false} />);
    fireEvent.keyDown(window, { key: ' ' });
    expect(h.playToggle).not.toHaveBeenCalled();
  });

  test('언마운트 시 리스너 해제', () => {
    const h = { ...emptyHandlers(), selectNext: vi.fn() };
    const { unmount } = render(<Harness handlers={h} enabled={true} />);
    unmount();
    fireEvent.keyDown(window, { key: 'l' });
    expect(h.selectNext).not.toHaveBeenCalled();
  });
});
