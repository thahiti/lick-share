# 데스크톱 반응형 (P11) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ScoreLink를 모바일 회귀 없이 데스크톱에서 좌우 2패널 편집·풀 키보드 단축키·여백/호버 피드백으로 원활히 쓰도록 한다.

**Architecture:** DOM은 pane 두 개로 항상 동일하게 유지하고 CSS 미디어쿼리(≥900px)로만 2패널 전환. 키보드는 ui 레이어 훅(순수 resolver + 얇은 effect)으로 기존 스토어 액션만 호출. 악보 폭은 악보 pane을 ResizeObserver로 측정해 자동 반영.

**Tech Stack:** React 18 + zustand, Vite/Vitest(jsdom), 순수 CSS(토큰 변수).

## Global Constraints

- 모바일(<900px) 렌더 순서·모양·수치 회귀 없음.
- 디자인 토큰(색·폰트·컨트롤 px) 불변 — 데스크톱은 padding/gap/배치/hover만 변경.
- 레이어 규칙: window/DOM 사용은 ui 레이어에서만. core/engine/ports/adapters 불변.
- 오디오·골든 스냅샷 무영향(키보드는 기존 액션만 호출).
- SMP 유니코드 음악 기호(U+1D100~U+1D1FF) 미사용.
- 게이트: `npm run typecheck && npm run lint && npm test && npm run check-smp` 전부 통과.
- 디자인 색상 하드코딩 금지 — `src/styles/tokens.css` 변수만 사용.

---

### Task 1: 테스트용 ResizeObserver 목 세팅

App이 `ResizeObserver`를 쓰게 되는데 jsdom에는 없다. 전역 목을 setupFile로 추가한다.

**Files:**
- Create: `src/test-setup.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Produces: 전역 `ResizeObserver`(no-op observe/unobserve/disconnect), `window.matchMedia` 스텁 — 이후 App 테스트가 의존.

- [ ] **Step 1: setupFile 작성**

```ts
// src/test-setup.ts
// jsdom에 없는 브라우저 API 목 (App의 ResizeObserver/matchMedia 사용 대비)
class ResizeObserverMock {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
```

- [ ] **Step 2: vite.config에 setupFiles 등록**

```ts
// vite.config.ts — test 블록에 setupFiles 추가
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/dump.test.ts'],
  },
```

- [ ] **Step 3: 기존 테스트 회귀 확인**

Run: `npm test`
Expected: 전부 PASS (기존과 동일 개수).

- [ ] **Step 4: Commit**

```bash
git add src/test-setup.ts vite.config.ts
git commit -m "test: jsdom ResizeObserver/matchMedia 목 세팅"
```

---

### Task 2: 키보드 단축키 훅

순수 `resolveShortcut`(이벤트→액션) + 얇은 `useKeyboardShortcuts` effect.

**Files:**
- Create: `src/ui/hooks/useKeyboardShortcuts.ts`
- Test: `src/ui/hooks/useKeyboardShortcuts.test.tsx`

**Interfaces:**
- Produces:
  - `type ShortcutAction = 'selectPrev'|'selectNext'|'pitchUp'|'pitchDown'|'posBack'|'posFwd'|'lenInc'|'lenDec'|'playToggle'|'playMeasure'|'del'|'measPrev'|'measNext'|'undo'|'redo'|'escape'`
  - `resolveShortcut(e: KeyboardEvent): ShortcutAction | null`
  - `useKeyboardShortcuts(handlers: Record<ShortcutAction, () => void>, enabled: boolean): void`

- [ ] **Step 1: resolver·hook 실패 테스트 작성**

```tsx
// src/ui/hooks/useKeyboardShortcuts.test.tsx
import { cleanup, fireEvent, render } from '@testing-library/react';
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
});

const noop = (): void => {};
const emptyHandlers = (): Record<ShortcutAction, () => void> => ({
  selectPrev: noop, selectNext: noop, pitchUp: noop, pitchDown: noop,
  posBack: noop, posFwd: noop, lenInc: noop, lenDec: noop,
  playToggle: noop, playMeasure: noop, del: noop, measPrev: noop,
  measNext: noop, undo: noop, redo: noop, escape: noop,
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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/ui/hooks/useKeyboardShortcuts.test.tsx`
Expected: FAIL ("Cannot find module './useKeyboardShortcuts'").

- [ ] **Step 3: 구현**

```ts
// src/ui/hooks/useKeyboardShortcuts.ts
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
  const lower = e.key.length === 1 ? e.key.toLowerCase() : e.key;

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
  ref.current = handlers;

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
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/ui/hooks/useKeyboardShortcuts.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/hooks/useKeyboardShortcuts.ts src/ui/hooks/useKeyboardShortcuts.test.tsx
git commit -m "feat(ui): 키보드 단축키 훅 (화살표+Vim hjkl)"
```

---

### Task 3: App pane 재구성 + 훅 연결 + ResizeObserver

**Files:**
- Modify: `src/ui/components/App.tsx`
- Test: `src/ui/components/App.test.tsx` (구조·키보드 테스트 추가)

**Interfaces:**
- Consumes: `useKeyboardShortcuts`, `resolveShortcut`(Task 2).
- Produces: 편집 DOM에 `.pane-score`(Header+Score) / `.pane-edit`(나머지 컨트롤), 열람 DOM에 `.app.app--view`.

- [ ] **Step 1: 구조·키보드 통합 테스트 추가**

`src/ui/components/App.test.tsx`의 `describe` 블록 안에 추가:

```tsx
  test('편집: 두 pane 구조 + 소속 컴포넌트', () => {
    const { container } = setup();
    const paneScore = container.querySelector('.pane-score');
    const paneEdit = container.querySelector('.pane-edit');
    expect(paneScore).not.toBeNull();
    expect(paneEdit).not.toBeNull();
    expect(paneScore?.querySelector('.header')).not.toBeNull();
    expect(paneEdit?.querySelector('.button-bar')).not.toBeNull();
    expect(paneEdit?.querySelector('.pad')).not.toBeNull();
  });

  test('키보드: l = 다음 음 선택', () => {
    const { container } = setup();
    // 첫 음(마디1 첫 노트) 선택 상태에서 오른쪽 이동
    click(container, '[data-m="0"]');
    const before = container.querySelector('.pcell.sel')?.getAttribute('data-p');
    fireEvent.keyDown(window, { key: 'l' });
    const after = container.querySelector('.pcell.sel')?.getAttribute('data-p');
    expect(after).not.toBe(before);
  });

  test('키보드: Space = 재생 토글', () => {
    const { container, player } = setup();
    expect(player.isPlaying()).toBe(false);
    fireEvent.keyDown(window, { key: ' ' });
    expect(player.isPlaying()).toBe(true);
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/ui/components/App.test.tsx`
Expected: FAIL (`.pane-score` 없음).

- [ ] **Step 3: App.tsx 수정 — ResizeObserver**

`useEffect`의 리사이즈 블록(현재 window resize 리스너)을 교체:

```tsx
  /* 악보 pane 폭 측정 → 조판 재계산 (SPEC §8). mode 전환 시 대상 재부착 */
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    const update = (): void => setScoreW(el.clientWidth || 384);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);
```

- [ ] **Step 4: App.tsx 수정 — 단축키 핸들러 + 훅**

`import` 추가:

```tsx
import { useKeyboardShortcuts, type ShortcutAction } from '../hooks/useKeyboardShortcuts';
```

`viewNoteTap` 정의 뒤(리턴 직전)에 핸들러 맵 + 훅 호출 추가:

```tsx
  const shortcuts: Record<ShortcutAction, () => void> = {
    selectPrev: () => store.getState().selectDir(-1),
    selectNext: () => store.getState().selectDir(1),
    pitchUp: () => store.getState().stepPitch(1),
    pitchDown: () => store.getState().stepPitch(-1),
    posBack: () => store.getState().stepPos(-1),
    posFwd: () => store.getState().stepPos(1),
    lenInc: () => store.getState().stepLen(1),
    lenDec: () => store.getState().stepLen(-1),
    playToggle: togglePlay,
    playMeasure,
    del: () => store.getState().deleteSel(),
    measPrev: measurePrev,
    measNext: measureNext,
    undo: () => store.getState().undoAction(),
    redo: () => store.getState().redoAction(),
    escape: () => setCpBeat(null),
  };
  useKeyboardShortcuts(shortcuts, mode === 'edit');
```

- [ ] **Step 5: App.tsx 수정 — 열람 래퍼 클래스**

열람 리턴의 `<div className="app" ref={shellRef}>`를:

```tsx
    <div className="app app--view" ref={shellRef}>
```

- [ ] **Step 6: App.tsx 수정 — 편집 pane 래핑**

편집 리턴을 pane 두 개로 감싼다. `ref={shellRef}`는 `.app`에서 `.pane-score`로 이동:

```tsx
  return (
    <div className="app">
      <div className="pane-score" ref={shellRef}>
        <Header
          song={s.song}
          accOn={s.accOn}
          metroOn={s.metroOn}
          playing={playing}
          onAccSelect={accSelect}
          onToggleMetro={metroToggle}
          onTogglePlay={togglePlay}
          onTempoApply={(v) => store.getState().setTempo(v)}
          onShare={copyShare}
          onView={() => {
            player.stop();
            setMode('view');
          }}
        />
        <Score
          song={s.song}
          mode="edit"
          curM={s.curM}
          sel={s.sel}
          width={scoreW}
          {...(playing && playEl !== null ? { playheadStep: playEl } : {})}
          onMeasureTap={(m) => {
            setCpBeat(null);
            store.getState().gotoMeasure(m);
          }}
        />
      </div>
      <div className="pane-edit">
        <ChordRow
          song={s.song}
          curM={s.curM}
          openBeat={cpBeat}
          onSlotTap={(b) => setCpBeat((cur) => (cur === b ? null : b))}
          onCycleAcc={() => store.getState().cycleMeasureAcc()}
        />
        {cpBeat !== null && (
          <ChordPicker
            song={s.song}
            curM={s.curM}
            beat={cpBeat}
            onApply={(ch) => store.getState().setChord(chordKey(cpBeat), ch)}
            onClear={() => {
              store.getState().setChord(chordKey(cpBeat), null);
              setCpBeat(null);
            }}
            onDone={() => setCpBeat(null)}
          />
        )}
        <Pad song={s.song} curM={s.curM} sel={s.sel} onCellTap={(pv, st) => store.getState().padTap(pv, st)} />
        <MeasureBar song={s.song} curM={s.curM} onPrev={measurePrev} onNext={measureNext} />
        <Steppers
          song={s.song}
          sel={s.sel}
          onStepPitch={(d) => store.getState().stepPitch(d)}
          onStepPos={(d) => store.getState().stepPos(d)}
          onStepLen={(d) => store.getState().stepLen(d)}
        />
        <ButtonBar
          song={s.song}
          sel={s.sel}
          onSelectDir={(d) => store.getState().selectDir(d)}
          onPlayMeasure={playMeasure}
          onUndo={() => store.getState().undoAction()}
          onRedo={() => store.getState().redoAction()}
          onDelete={() => store.getState().deleteSel()}
        />
      </div>
      <Toast msg={s.toast} onDone={() => store.getState().clearToast()} />
    </div>
  );
```

- [ ] **Step 7: 통과 확인**

Run: `npx vitest run src/ui/components/App.test.tsx`
Expected: PASS (기존 + 신규 3건).

- [ ] **Step 8: 전체 게이트**

Run: `npm run typecheck && npm run lint && npm test && npm run check-smp`
Expected: 전부 PASS.

- [ ] **Step 9: Commit**

```bash
git add src/ui/components/App.tsx src/ui/components/App.test.tsx
git commit -m "feat(ui): 편집 2패널 구조·키보드 단축키 연결·ResizeObserver 폭 측정"
```

---

### Task 4: 데스크톱 CSS (2패널·여백·호버·열람 컬럼)

**Files:**
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: `.app`, `.pane-score`, `.pane-edit`, `.app--view` 클래스(Task 3).
- 데스크톱 미디어쿼리는 jsdom 검증 불가 → 수동 확인.

- [ ] **Step 1: 모바일 기본 pane 스타일 (파일 상단 `.app` 규칙 뒤에 추가)**

```css
/* ── pane (모바일: 단순 스택, 데스크톱: 2패널) ── */
.pane-score,
.pane-edit {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
```

- [ ] **Step 2: 데스크톱 2패널 + 여백 + 열람 컬럼 (파일 맨 끝에 추가)**

```css
/* ── 데스크톱 반응형 (DESIGN §7) — 뷰포트 ≥900px ── */
@media (min-width: 900px) {
  .app:not(.app--view) {
    max-width: 1120px;
    display: grid;
    grid-template-columns: 1fr 380px;
    grid-template-rows: 1fr auto;
    min-height: 100dvh;
  }
  /* 악보 pane: 좌측, 독립 스크롤 */
  .app:not(.app--view) .pane-score {
    grid-column: 1;
    grid-row: 1 / span 2;
    overflow-y: auto;
    border-right: 1px solid var(--line);
  }
  /* 컨트롤 pane: 우측 고정폭, 여백 확대 */
  .app:not(.app--view) .pane-edit {
    grid-column: 2;
    grid-row: 1 / span 2;
    padding: 8px 12px 12px;
    gap: 4px;
    justify-content: flex-start;
  }
  /* Toast는 pane 밖 → grid 흐름에서 제외 */
  .app:not(.app--view) > .toast {
    grid-column: 1 / -1;
  }

  /* 열람: 중앙 넓은 컬럼 */
  .app--view {
    max-width: 680px;
  }
}
```

- [ ] **Step 3: 마우스 호버·포커스 (파일 맨 끝에 추가)**

```css
/* ── 마우스 호버/포커스 피드백 (데스크톱 포인터) ── */
@media (hover: hover) {
  .icon-btn:hover,
  .chip:hover,
  .measure-bar button:hover,
  .stepper button:hover:not(:disabled),
  .chord-pick .cp-row button:hover,
  .chord-pick .cp-ft button:hover,
  .popover button:hover,
  .button-bar .bb:hover {
    background: var(--bg-stepper-zone);
  }
  .chord-row .cslot:hover {
    border-color: var(--red);
  }
  .pad .pcell:hover {
    outline: 1px solid var(--mut2);
    outline-offset: -1px;
  }
}

.icon-btn:focus-visible,
.chip:focus-visible,
.button-bar .bb:focus-visible,
.measure-bar button:focus-visible,
.stepper button:focus-visible,
.chord-row .cslot:focus-visible,
.pad .pcell:focus-visible {
  outline: 2px solid var(--red);
  outline-offset: -2px;
}
```

- [ ] **Step 4: SMP·게이트 확인**

Run: `npm run check-smp && npm run lint && npm test`
Expected: 전부 PASS.

- [ ] **Step 5: 수동 시각 확인**

Run: `npm run dev` → 브라우저에서
- 창 폭 <900px: 현재와 동일(회귀 없음).
- ≥900px: 좌 악보 / 우 380px 컨트롤 2패널, 컨트롤 여백 확대.
- `?mode=view`: 중앙 680px 컬럼.
- 버튼/셀/슬롯 호버 시 피드백.

- [ ] **Step 6: Commit**

```bash
git add src/styles/global.css
git commit -m "feat(ui): 데스크톱 2패널 레이아웃·여백·호버 피드백 CSS"
```

---

### Task 5: 문서 갱신 (DESIGN §7, e2e 체크리스트)

**Files:**
- Modify: `docs/DESIGN.md` (§7)
- Modify: `docs/e2e-checklist.md`

**Interfaces:** 없음(문서만).

- [ ] **Step 1: DESIGN.md §7에 데스크톱 규격 추가**

§7 "레이아웃" 목록 끝에 추가:

```markdown
- 데스크톱(뷰포트 ≥900px): 편집은 `max-width:1120px` 2패널 그리드
  `[1fr 악보 | 380px 컨트롤]`, 악보 pane 독립 스크롤. 열람은 `max-width:680px`
  중앙 컬럼. 컨트롤 px 규격은 불변, padding/gap만 확대. 마우스 hover/focus 피드백 추가.
```

- [ ] **Step 2: e2e 체크리스트에 데스크톱 항목 추가**

`docs/e2e-checklist.md` 끝에 섹션 추가:

```markdown
## 데스크톱 반응형 (P11)
- [ ] 창 폭 <900px에서 모바일 레이아웃과 동일(회귀 없음)
- [ ] 창 폭 ≥900px에서 좌 악보 / 우 380px 컨트롤 2패널
- [ ] 악보 pane이 독립 세로 스크롤
- [ ] `?mode=view` 열람이 중앙 680px 컬럼
- [ ] 키보드: ←→/hl 선택, ↑↓/kj 음높이, Shift 위치·길이
- [ ] 키보드: Space 재생, Enter 마디재생, Delete 삭제, [ ] 마디이동, Cmd/Ctrl+Z 실행취소, Esc 피커닫기
- [ ] 입력창(템포/제목) 포커스 중에는 단축키 미작동
- [ ] 버튼/셀/슬롯 hover·focus 피드백
```

- [ ] **Step 3: check-smp 확인 후 Commit**

Run: `npm run check-smp`
Expected: PASS.

```bash
git add docs/DESIGN.md docs/e2e-checklist.md
git commit -m "docs: 데스크톱 반응형 규격·e2e 체크리스트 반영"
```

---

## Self-Review

- **Spec coverage:** §4 레이아웃→Task3+4, §4.3 폭측정→Task3, §5 여백/호버→Task4, §6 키보드→Task2+3, §7 열람→Task3+4, §8 문서→Task5, §9 테스트→Task1(목)+2+3. 전부 매핑됨.
- **Placeholder scan:** 코드 블록 전부 실제 코드. "여백 수치 시각 확인"은 Task4 Step5 수동 절차로 구체화됨.
- **Type consistency:** `ShortcutAction` 유니온·`resolveShortcut`·`useKeyboardShortcuts` 시그니처가 Task2 정의와 Task3 사용에서 일치. 스토어 액션명(`selectDir/stepPitch/stepPos/stepLen/deleteSel/undoAction/redoAction`)은 songStore 실제 시그니처와 일치.
