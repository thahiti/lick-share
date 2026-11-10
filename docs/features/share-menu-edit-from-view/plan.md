# Share Menu + Edit-from-View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 편집기 Share 버튼을 Publish/Copy link 팝오버로 확장하고, 커뮤니티 릭 상세에 "Duplicate & edit" 편집 진입을 추가한다.

**Architecture:** 기존 `.popover` 패턴(`tempoPop`/`accPop`)을 재사용해 Share 팝오버를 만든다. `ui→community` 의존 금지 규칙을 지키기 위해, 편집기의 게시 네비게이션은 `Root`(community)가 `App`에 콜백을 주입한다. 릭 상세의 편집 진입은 community 내부라 `navigate`를 직접 쓴다.

**Tech Stack:** React 18 + TypeScript, Zustand, Vitest + @testing-library/react.

## Global Constraints

- 디자인 토큰은 `src/styles/tokens.css`의 CSS 변수만 사용. 하드코딩 색상 금지 (`.share-pop`은 기존 `.popover` 규칙 재사용 — 새 CSS 불필요).
- 의존 방향 `ui → adapters → ports`. `ui`는 `community`를 import 금지. `community`는 `core` import 가능.
- URL 해시 하위 호환(`v1.…`) 유지. 새 경로는 `pathname#hash` 조합만 사용.
- TDD 필수: 실패 테스트 먼저 → RED 확인 → 최소 구현 → GREEN.
- 게이트: `npm run typecheck && npm run lint && npm test && npm run check-smp` 전부 통과 후 커밋.
- trailing space 금지. UI 텍스트 영어, 주석 한국어.

---

### Task 1: Header 공유 팝오버

**Files:**
- Modify: `src/ui/components/edit/Header.tsx`
- Test: `src/ui/components/edit/Header.test.tsx`

**Interfaces:**
- Produces: `HeaderProps`에서 `onShare: () => void` 제거, `onPublish: () => void`·`onCopyLink: () => void` 추가.
- 팝오버 버튼 식별자: `data-share="publish"`, `data-share="copy"`.

- [ ] **Step 1: 실패 테스트 작성** — `Header.test.tsx`의 mock과 공유 테스트를 교체한다.

`cbs` 객체(9~16번째 줄)에서 `onShare: vi.fn(),`를 다음으로 교체:

```tsx
  onPublish: vi.fn(),
  onCopyLink: vi.fn(),
```

기존 '공유·보기 버튼' 테스트(80~86번째 줄)를 다음으로 교체:

```tsx
  test('공유 팝오버: Publish / Copy link 각각 콜백 + 선택 시 닫힘', () => {
    const { container } = renderHeader();
    fireEvent.click($(container, '[data-btn="share"]'));
    fireEvent.click($(container, '[data-share="publish"]'));
    expect(cbs.onPublish).toHaveBeenCalled();
    expect(container.querySelector('[data-share]')).toBeNull(); // 선택 즉시 닫힘

    fireEvent.click($(container, '[data-btn="share"]'));
    fireEvent.click($(container, '[data-share="copy"]'));
    expect(cbs.onCopyLink).toHaveBeenCalled();
  });

  test('보기 버튼', () => {
    const { container } = renderHeader();
    fireEvent.click($(container, '[data-btn="view"]'));
    expect(cbs.onView).toHaveBeenCalled();
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- Header`
Expected: FAIL — `onPublish`/`onCopyLink` 타입 없음, `[data-share]` 없음.

- [ ] **Step 3: 최소 구현** — `Header.tsx` 수정.

`HeaderProps`에서 `readonly onShare: () => void;`를 다음으로 교체:

```tsx
  readonly onPublish: () => void;
  readonly onCopyLink: () => void;
```

구조분해(29~40번째 줄)에서 `onShare,`를 `onPublish,`·`onCopyLink,`로 교체.

`useState` 블록(41~43번째 줄) 근처에 추가:

```tsx
  const [sharePop, setSharePop] = useState(false);
```

Share 버튼(96~98번째 줄)의 `onClick={onShare}`를 `onClick={() => setSharePop((v) => !v)}`로 교체.

tempoPop 팝오버 블록(127~150번째 줄) 뒤에 share 팝오버 추가:

```tsx
      {sharePop && (
        <div className="popover share-pop">
          <button
            type="button"
            data-share="publish"
            onClick={() => {
              onPublish();
              setSharePop(false);
            }}
          >
            Publish
          </button>
          <button
            type="button"
            data-share="copy"
            onClick={() => {
              onCopyLink();
              setSharePop(false);
            }}
          >
            Copy link
          </button>
        </div>
      )}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- Header`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/ui/components/edit/Header.tsx src/ui/components/edit/Header.test.tsx
git commit -m "feat(editor): Header share popover with Publish / Copy link"
```

---

### Task 2: DawTopBar 공유 팝오버 + DawEdit 배선

**Files:**
- Modify: `src/ui/components/edit/daw/DawTopBar.tsx`
- Modify: `src/ui/components/edit/daw/DawEdit.tsx`
- Test: `src/ui/components/edit/daw/DawTopBar.test.tsx` (신규)

**Interfaces:**
- Consumes: Task 1의 `data-share` 팝오버 패턴.
- Produces: `DawTopBarProps`·`DawEditProps`에서 `onShare` 제거, `onPublish`·`onCopyLink` 추가.

- [ ] **Step 1: 실패 테스트 작성** — 신규 `DawTopBar.test.tsx`.

```tsx
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { demoSong } from '../../../../core/demo-song';
import { DawTopBar } from './DawTopBar';

afterEach(cleanup);

const cbs = {
  onTogglePlay: vi.fn(),
  onToggleMetro: vi.fn(),
  onTempoApply: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onDelete: vi.fn(),
  onPublish: vi.fn(),
  onCopyLink: vi.fn(),
  onView: vi.fn(),
};

const $ = (c: HTMLElement, sel: string): Element => {
  const el = c.querySelector(sel);
  if (!el) throw new Error(`${sel} 없음`);
  return el;
};

describe('DawTopBar 공유 팝오버', () => {
  test('Share → Publish / Copy link 각각 콜백 + 선택 시 닫힘', () => {
    const { container } = render(
      <DawTopBar song={demoSong} playing={false} metroOn={false} {...cbs} />,
    );
    fireEvent.click($(container, '[data-btn="share"]'));
    fireEvent.click($(container, '[data-share="publish"]'));
    expect(cbs.onPublish).toHaveBeenCalled();
    expect(container.querySelector('[data-share]')).toBeNull();

    fireEvent.click($(container, '[data-btn="share"]'));
    fireEvent.click($(container, '[data-share="copy"]'));
    expect(cbs.onCopyLink).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- DawTopBar`
Expected: FAIL — `onPublish`/`onCopyLink` 타입 없음.

- [ ] **Step 3: 최소 구현** — `DawTopBar.tsx` 수정.

`DawTopBarProps`의 `readonly onShare: () => void;`를 교체:

```tsx
  readonly onPublish: () => void;
  readonly onCopyLink: () => void;
```

구조분해(24~36번째 줄)에서 `onShare,`를 `onPublish,`·`onCopyLink,`로 교체.

`useState` 블록(37~38번째 줄) 근처에 추가:

```tsx
  const [sharePop, setSharePop] = useState(false);
```

Share 버튼(92~94번째 줄)의 `onClick={onShare}`를 `onClick={() => setSharePop((v) => !v)}`로 교체.

tempoPop 블록(100~123번째 줄) 뒤에 share 팝오버 추가 (Task 1 Step 3과 동일 마크업):

```tsx
      {sharePop && (
        <div className="popover share-pop">
          <button
            type="button"
            data-share="publish"
            onClick={() => {
              onPublish();
              setSharePop(false);
            }}
          >
            Publish
          </button>
          <button
            type="button"
            data-share="copy"
            onClick={() => {
              onCopyLink();
              setSharePop(false);
            }}
          >
            Copy link
          </button>
        </div>
      )}
```

- [ ] **Step 4: DawEdit 배선** — `DawEdit.tsx` 수정.

`DawEditProps`의 `readonly onShare: () => void;`를 교체:

```tsx
  readonly onPublish: () => void;
  readonly onCopyLink: () => void;
```

구조분해(52~82번째 줄)에서 `onShare,`를 `onPublish,`·`onCopyLink,`로 교체.

`<DawTopBar>`(84~96번째 줄)의 `onShare={onShare}`를 교체:

```tsx
      onPublish={onPublish}
      onCopyLink={onCopyLink}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- DawTopBar`
Expected: PASS (typecheck는 App 수정 전이라 아직 실패 가능 — Task 3에서 해소)

- [ ] **Step 6: 커밋**

```bash
git add src/ui/components/edit/daw/DawTopBar.tsx src/ui/components/edit/daw/DawTopBar.test.tsx src/ui/components/edit/daw/DawEdit.tsx
git commit -m "feat(editor): DawTopBar share popover + DawEdit wiring"
```

---

### Task 3: App 배선 + Root 게시 네비게이션

**Files:**
- Modify: `src/ui/components/App.tsx`
- Modify: `src/community/Root.tsx`
- Test: `src/ui/components/App.test.tsx`

**Interfaces:**
- Consumes: Task 1·2의 `onPublish`/`onCopyLink` props (Header, DawEdit).
- Produces: `AppProps`에 `readonly onPublish?: (hash: string) => void` 추가.

- [ ] **Step 1: 실패 테스트 작성** — `App.test.tsx`.

기존 공유 테스트(231~240번째 줄)를 다음으로 교체 (Share → Copy link 2단계 클릭):

```tsx
  test('공유→Copy link: ?mode=view#v1. URL 클립보드 복사 + 현재 해시 갱신 + 토스트', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { container, hashStore, findByText } = setup();
    click(container, '[data-btn="share"]');
    click(container, '[data-share="copy"]');
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('?mode=view#v1.'));
    expect(hashStore.read().startsWith('v1.')).toBe(true);
    expect(await findByText('View link copied')).toBeTruthy();
    vi.unstubAllGlobals();
  });

  test('공유→Publish: 현재 곡 해시로 onPublish 호출', () => {
    const onPublish = vi.fn();
    const store = createSongStore();
    const time = { t: 0 };
    const player = createPlayer({ sink: createFakeAudioSink(() => time.t), clock: createFakeClock() });
    const hashStore = createMemoryHashStore('');
    const { container } = render(
      <App store={store} player={player} hashStore={hashStore} onPublish={onPublish} />,
    );
    click(container, '[data-btn="share"]');
    click(container, '[data-share="publish"]');
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect((onPublish.mock.calls[0]?.[0] as string).startsWith('v1.')).toBe(true);
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- App`
Expected: FAIL — `[data-share="copy"]` 없음(App이 아직 새 props 전달 안 함), `onPublish` prop 타입 없음.

- [ ] **Step 3: 최소 구현** — `App.tsx` 수정.

`AppProps`에 추가:

```tsx
  /** 게시 진입 — community Root가 주입 (ui→community 의존 회피) */
  readonly onPublish?: (hash: string) => void;
```

구조분해(42~47번째 줄)에 `onPublish,` 추가.

`copyShare` 함수(158~168번째 줄) 뒤에 추가:

```tsx
  /** 게시: 현재 곡 해시를 Root가 주입한 네비게이션 콜백으로 전달 */
  const publishShare = (): void => {
    onPublish?.(encodeSong(store.getState().song));
  };
```

모바일 `Header`(290~304번째 줄)의 `onShare={copyShare}`를 교체:

```tsx
          onPublish={publishShare}
          onCopyLink={copyShare}
```

데스크톱 `DawEdit`(276번째 줄)의 `onShare={copyShare}`를 교체:

```tsx
          onPublish={publishShare}
          onCopyLink={copyShare}
```

- [ ] **Step 4: Root 주입** — `Root.tsx` 수정.

`navigate` import 확인(8번째 줄에 이미 `import { navigate, useRoute } from './routing';` 존재).

edit 라우트 렌더(38번째 줄)를 교체:

```tsx
  if (route.name === 'edit')
    return (
      <App
        player={player}
        hashStore={hashStore}
        initialMode="edit"
        onPublish={(hash) => navigate('/publish#' + hash)}
      />
    );
```

- [ ] **Step 5: 테스트·게이트 통과 확인**

Run: `npm test -- App` → PASS
Run: `npm run typecheck` → 통과 (App/DawEdit/Header/DawTopBar 시그니처 일치)

- [ ] **Step 6: 커밋**

```bash
git add src/ui/components/App.tsx src/community/Root.tsx src/ui/components/App.test.tsx
git commit -m "feat(editor): wire share popover to publish/copy + Root publish nav"
```

---

### Task 4: LickDetail "Duplicate & edit"

**Files:**
- Modify: `src/community/views/LickDetail.tsx`
- Test: `src/community/views/LickDetail.test.tsx`

**Interfaces:**
- Consumes: community `navigate` (이미 import됨), `lick.blob`.

- [ ] **Step 1: 실패 테스트 작성** — `LickDetail.test.tsx`에 테스트 추가 (기존 describe 블록 안, 예: 100번째 줄 이후 적당한 위치).

```tsx
  it('Duplicate & edit: 릭 blob으로 /edit# 로 이동한다', async () => {
    fetchLick.mockResolvedValue(original);
    render(<LickDetail id="orig-1" user={null} player={fakePlayer()} />);

    fireEvent.click(await screen.findByText('Duplicate & edit'));
    expect(navigate).toHaveBeenCalledWith('/edit#' + blob);
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- LickDetail`
Expected: FAIL — 'Duplicate & edit' 버튼 없음.

- [ ] **Step 3: 최소 구현** — `LickDetail.tsx` 수정.

액션 행(185~190번째 줄, `.c-row` 내 Play all 버튼과 LikeButton 사이 또는 그 아래)에 편집 버튼 추가. `.c-row` 블록을 다음으로 교체:

```tsx
      <div className="c-row">
        <button type="button" className="c-btn" onClick={onTogglePlay}>
          {playing ? 'Stop' : 'Play all'}
        </button>
        <button type="button" className="c-btn" onClick={() => navigate('/edit#' + lick.blob)}>
          Duplicate &amp; edit
        </button>
        <LikeButton liked={liked} count={count} onToggle={onToggleLike} disabled={likeBusy} />
      </div>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- LickDetail`
Expected: PASS

- [ ] **Step 5: 전체 게이트**

Run: `npm run typecheck && npm run lint && npm test && npm run check-smp`
Expected: 전부 통과

- [ ] **Step 6: 커밋**

```bash
git add src/community/views/LickDetail.tsx src/community/views/LickDetail.test.tsx
git commit -m "feat(community): Duplicate & edit button on lick detail"
```

---

## Self-Review

- **Spec 커버리지:** 기능 1(공유 팝오버) = Task 1·2·3; Root 게시 네비게이션 = Task 3; 기능 2(편집 진입) = Task 4. Publish 뷰 프리필은 기존 `initialInput()` 재사용 — 변경 없음(스펙 명시). 전부 매핑됨.
- **플레이스홀더:** 없음 — 모든 스텝에 실제 코드/명령/기대 출력 포함.
- **타입 일관성:** `onPublish`/`onCopyLink`가 Header·DawTopBar·DawEdit·App 전 계층에서 동일 시그니처. `AppProps.onPublish?: (hash: string) => void`와 Root 주입 `(hash) => navigate('/publish#' + hash)` 일치. `data-share="publish"|"copy"` 식별자 전 태스크 통일.
