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
  | 'escape'
  // 레코딩 시작/정지 (piano-recording-design §3.3)
  | 'record'
  // A~G 음 입력 (데스크톱 워크스페이스)
  | 'noteA'
  | 'noteB'
  | 'noteC'
  | 'noteD'
  | 'noteE'
  | 'noteF'
  | 'noteG';

/** 물리 키 위치 보정 — 한글 등 비라틴 자판에서도 hjkl·z·A~G가 같은 자리로 동작 */
const CODE_KEYS: Readonly<Record<string, string>> = {
  KeyH: 'h',
  KeyJ: 'j',
  KeyK: 'k',
  KeyL: 'l',
  KeyR: 'r',
  KeyZ: 'z',
  KeyA: 'a',
  KeyB: 'b',
  KeyC: 'c',
  KeyD: 'd',
  KeyE: 'e',
  KeyF: 'f',
  KeyG: 'g',
};

/** a~g → 음 입력 액션 (h/j/k/l/z는 Vim 이동이라 제외) */
const NOTE_ACTIONS: Readonly<Record<string, ShortcutAction>> = {
  a: 'noteA',
  b: 'noteB',
  c: 'noteC',
  d: 'noteD',
  e: 'noteE',
  f: 'noteF',
  g: 'noteG',
};

/** e.key가 비라틴 문자(ㅗ 등)거나 IME 'Process'면 e.code로 보정 */
const normalizedKey = (e: KeyboardEvent): string => {
  const k = e.key.toLowerCase();
  const nonLatin = (k.length === 1 && k.charCodeAt(0) > 127) || e.key === 'Process';
  return nonLatin ? (CODE_KEYS[e.code] ?? k) : k;
};

/** 키 이벤트 → 액션. 화살표와 Vim hjkl은 동일 동작 (한글 자판 포함). */
export const resolveShortcut = (e: KeyboardEvent): ShortcutAction | null => {
  const lower = normalizedKey(e);

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
    case 'r':
      return 'record';
    default:
      // a~g 음 입력 (shift 무관). h/j/k/l/z는 위에서 이미 처리됨
      return NOTE_ACTIONS[lower] ?? null;
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
