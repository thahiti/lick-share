// 전역 키보드 단축키 (ui 레이어). 순수 resolver + 얇은 effect.
import { useEffect, useRef } from 'react';

export type ShortcutAction =
  | 'selectPrev'
  | 'selectNext'
  | 'pitchUp'
  | 'pitchDown'
  | 'posBack'
  | 'posFwd'
  | 'lenInc'
  | 'lenDec'
  | 'playToggle'
  | 'playMeasure'
  | 'del'
  | 'measPrev'
  | 'measNext'
  | 'undo'
  | 'redo'
  | 'escape';

/** 키 이벤트 → 액션. 화살표와 Vim hjkl은 동일 동작. */
export const resolveShortcut = (e: KeyboardEvent): ShortcutAction | null => {
  const lower = e.key.toLowerCase();

  // Cmd/Ctrl 조합: z만 처리(실행취소/재실행), 나머지는 브라우저에 양보
  if (e.metaKey || e.ctrlKey) {
    if (lower === 'z') return e.shiftKey ? 'redo' : 'undo';
    return null;
  }

  const shift = e.shiftKey;
  switch (lower) {
    case 'arrowleft':
    case 'h':
      return shift ? 'posBack' : 'selectPrev';
    case 'arrowright':
    case 'l':
      return shift ? 'posFwd' : 'selectNext';
    case 'arrowup':
    case 'k':
      return shift ? 'lenInc' : 'pitchUp';
    case 'arrowdown':
    case 'j':
      return shift ? 'lenDec' : 'pitchDown';
    case ' ':
      return 'playToggle';
    case 'enter':
      return 'playMeasure';
    case 'delete':
    case 'backspace':
      return 'del';
    case '[':
      return 'measPrev';
    case ']':
      return 'measNext';
    case 'escape':
      return 'escape';
    default:
      return null;
  }
};

const isEditable = (el: Element | null): boolean =>
  el instanceof HTMLElement &&
  (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

/** 편집 모드에서 전역 keydown을 액션 핸들러로 라우팅. */
export const useKeyboardShortcuts = (
  handlers: Record<ShortcutAction, () => void>,
  enabled: boolean,
): void => {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.isComposing) return;
      if (isEditable(document.activeElement)) return;
      const action = resolveShortcut(e);
      if (!action) return;
      e.preventDefault();
      ref.current[action]();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
};
