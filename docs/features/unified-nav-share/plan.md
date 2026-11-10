# Unified Nav + Share Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 두 장치(모바일/데스크톱)의 상단 메뉴를 단일 NAV 모델로 통일하고, 편집자용 View 모드를 재생 가능한 Share 화면(/publish)으로 통합한다.

**Architecture:** 메뉴 항목을 `src/community/nav-items.ts` 한 곳에 정의하고 렌더러(AppBar·Sidebar·TabBar·MobileAppBar)가 공유한다. `/edit`는 몰입형을 유지하되 좌상단 ←Back(마지막 커뮤니티 라우트 복귀)과 Share 단일 버튼으로 정리한다. `/publish`는 미리보기+재생+Copy link+게시가 모인 Share 화면이 된다. 스펙: `docs/superpowers/specs/2026-07-14-unified-nav-share-design.md`.

**Tech Stack:** React 19 + TypeScript(strict), zustand, vitest + @testing-library/react. 라우팅은 자체 `src/community/routing.ts`(경로 기반).

## Global Constraints

- 레이어 규칙: `ui`는 `community`를 import 금지 — 네비게이션 콜백은 Root가 App에 주입한다.
- SMP 유니코드 음악 기호(U+1D100~) 금지 — `npm run check-smp`가 게이트.
- 색상은 `src/styles/tokens.css` CSS 변수만 사용. 하드코딩 금지.
- `?mode=view#v1.…` 열람 링크·`v1.` 해시 포맷·`/publish#hash` 진입 방식은 절대 불변 (하위 호환).
- UI 텍스트는 영어, 코드 주석은 한국어. trailing space 금지.
- TDD: 테스트 먼저 → RED 확인 → 구현 → GREEN.
- 각 Task 커밋 전 게이트: `npm run typecheck && npm run lint && npm test && npm run check-smp` 전부 통과.
- 커밋 형식: Conventional Commits (`feat(scope): …`, 제목 50자 이하 명령형).

---

### Task 1: nav-items 단일 NAV 모델

**Files:**
- Create: `src/community/nav-items.ts`
- Test: `src/community/nav-items.test.ts`

**Interfaces:**
- Consumes: `IconName`(src/ui/components/common/Icon.tsx), `Route`(src/community/routing.ts)
- Produces: `NavItem { to: string; label: string; icon: IconName; match: Route['name']; auth?: true }`, `NAV_ITEMS: readonly NavItem[]`, `visibleItems(signedIn: boolean): readonly NavItem[]` — Task 4·5가 사용

- [ ] **Step 1: Write the failing test**

`src/community/nav-items.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NAV_ITEMS, visibleItems } from './nav-items';

describe('nav-items', () => {
  it('메뉴 집합·순서: Latest → Create → Ranking → My licks', () => {
    expect(NAV_ITEMS.map((n) => n.label)).toEqual(['Latest', 'Create', 'Ranking', 'My licks']);
    expect(NAV_ITEMS.map((n) => n.to)).toEqual(['/', '/edit', '/ranking', '/me']);
  });

  it('비로그인이면 auth 항목(My licks)이 빠진다', () => {
    expect(visibleItems(false).map((n) => n.label)).toEqual(['Latest', 'Create', 'Ranking']);
    expect(visibleItems(true)).toEqual(NAV_ITEMS);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/community/nav-items.test.ts`
Expected: FAIL — "Cannot find module './nav-items'"

- [ ] **Step 3: Write minimal implementation**

`src/community/nav-items.ts`:

```ts
/**
 * 커뮤니티 네비게이션 단일 정의처 (unified-nav-share 설계).
 * 모든 메뉴 렌더러(AppBar·Sidebar·TabBar)는 이 모델만 읽는다 — 장치 간 메뉴 동일성 보장.
 */
import type { IconName } from '../ui/components/common/Icon';
import type { Route } from './routing';

export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly icon: IconName;
  readonly match: Route['name'];
  /** true면 로그인 시에만 노출 */
  readonly auth?: true;
}

/** 순서 = 모바일 탭바 순서. 데스크톱 Sidebar는 'edit' 항목을 제외하고 사용한다. */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Latest', icon: 'fire', match: 'feed' },
  { to: '/edit', label: 'Create', icon: 'plus', match: 'edit' },
  { to: '/ranking', label: 'Ranking', icon: 'trophy', match: 'ranking' },
  { to: '/me', label: 'My licks', icon: 'folder', match: 'me', auth: true },
];

/** 로그인 여부에 따른 노출 목록 — 필터 규칙도 이 모듈 한 곳에만 */
export const visibleItems = (signedIn: boolean): readonly NavItem[] =>
  NAV_ITEMS.filter((n) => n.auth !== true || signedIn);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/community/nav-items.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Gate + Commit**

```bash
npm run typecheck && npm run lint && npm test && npm run check-smp
git add src/community/nav-items.ts src/community/nav-items.test.ts
git commit -m "feat(community): add single nav model for all menus"
```

---

### Task 2: AvatarMenu 추출 (AppBar 리팩토링)

계정 메뉴(아바타 드롭다운)를 AppBar에서 분리해 모바일 앱바(Task 3)와 공유한다.
기존 `AppBar.test.tsx`의 아바타 관련 단언이 그대로 통과해야 한다(동작 불변 리팩토링).

**Files:**
- Create: `src/community/components/AvatarMenu.tsx`
- Modify: `src/community/components/AppBar.tsx`

**Interfaces:**
- Produces: `AvatarMenu({ user: User | null; onSignIn: () => void; onSignOut: () => void })` — Task 3이 사용

- [ ] **Step 1: 기존 테스트가 GREEN인지 확인 (리팩토링 기준선)**

Run: `npx vitest run src/community/components/AppBar.test.tsx`
Expected: PASS

- [ ] **Step 2: AvatarMenu 생성**

`src/community/components/AvatarMenu.tsx`:

```tsx
/**
 * 아바타 드롭다운 — 계정 메뉴의 단일 정의처. AppBar(데스크톱)·MobileAppBar(모바일)가 공유한다.
 * 항목: (로그인) My licks · Sign out / (비로그인) Sign in with Google.
 */
import { useState, type JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import { navigate } from '../routing';

interface Props {
  readonly user: User | null;
  readonly onSignIn: () => void;
  readonly onSignOut: () => void;
}

/** 표시 이름 → 이니셜 1글자 (없으면 '?') */
const initial = (user: User): string => {
  const name = (user.user_metadata?.name as string | undefined) ?? user.email ?? '';
  return name.trim().charAt(0).toUpperCase() || '?';
};

export const AvatarMenu = ({ user, onSignIn, onSignOut }: Props): JSX.Element => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="c-avatarwrap">
      <button
        type="button"
        className="c-avatar"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
      >
        {user ? initial(user) : '?'}
      </button>
      {menuOpen && (
        <div className="c-avatarmenu" role="menu">
          {user ? (
            <>
              <button type="button" role="menuitem" onClick={() => navigate('/me')}>
                My licks
              </button>
              <button type="button" role="menuitem" onClick={onSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <button type="button" role="menuitem" onClick={onSignIn}>
              Sign in with Google
            </button>
          )}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 3: AppBar가 AvatarMenu를 사용하도록 수정**

`src/community/components/AppBar.tsx`에서:
- `useState` import·`menuOpen` 상태·`initial` 함수·`.c-avatarwrap` JSX 블록 전체 삭제
- import에 `import { AvatarMenu } from './AvatarMenu';` 추가, `import type { JSX } from 'react';`로 정리
- 기존 `<div className="c-avatarwrap">…</div>` 자리를 다음으로 교체:

```tsx
      <AvatarMenu user={user} onSignIn={onSignIn} onSignOut={onSignOut} />
```

- [ ] **Step 4: 기존 테스트가 여전히 GREEN인지 확인**

Run: `npx vitest run src/community/components/AppBar.test.tsx`
Expected: PASS (아바타 드롭다운 단언 포함 전부)

- [ ] **Step 5: Gate + Commit**

```bash
npm run typecheck && npm run lint && npm test && npm run check-smp
git add src/community/components/AvatarMenu.tsx src/community/components/AppBar.tsx
git commit -m "refactor(community): extract AvatarMenu from AppBar"
```

---

### Task 3: MobileAppBar (모바일 상단 바) + CSS

**Files:**
- Create: `src/community/components/MobileAppBar.tsx`
- Test: `src/community/components/MobileAppBar.test.tsx`
- Modify: `src/community/community.css`

**Interfaces:**
- Consumes: `AvatarMenu`(Task 2)
- Produces: `MobileAppBar({ user, onSignIn, onSignOut })` — Task 6이 Root에 장착

- [ ] **Step 1: Write the failing test**

`src/community/components/MobileAppBar.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

const navigate = vi.fn<(path: string) => void>();
vi.mock('../routing', () => ({ navigate: (p: string) => navigate(p) }));

import { MobileAppBar } from './MobileAppBar';

const fakeUser = { user_metadata: { name: 'Randy' }, email: 'r@x.io' } as unknown as User;

describe('MobileAppBar', () => {
  it('로고 클릭 → / 로 이동', () => {
    render(<MobileAppBar user={null} onSignIn={vi.fn()} onSignOut={vi.fn()} />);
    fireEvent.click(screen.getByText('Lick Share'));
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('아바타 메뉴 항목은 데스크톱과 동일 (My licks / Sign out)', () => {
    render(<MobileAppBar user={fakeUser} onSignIn={vi.fn()} onSignOut={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'R' }));
    expect(screen.getByRole('menuitem', { name: 'My licks' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/community/components/MobileAppBar.test.tsx`
Expected: FAIL — "Cannot find module './MobileAppBar'"

- [ ] **Step 3: Write implementation**

`src/community/components/MobileAppBar.tsx`:

```tsx
/**
 * 모바일 상단 앱 바 (<1024px 전용, CSS가 전환) — 로고 + 아바타.
 * 내비 이동은 하단 TabBar가 담당한다 (unified-nav-share 설계).
 */
import type { JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import { Icon } from '../../ui/components/common/Icon';
import { navigate } from '../routing';
import { AvatarMenu } from './AvatarMenu';

interface Props {
  readonly user: User | null;
  readonly onSignIn: () => void;
  readonly onSignOut: () => void;
}

export const MobileAppBar = ({ user, onSignIn, onSignOut }: Props): JSX.Element => (
  <header className="c-mappbar">
    <a
      className="c-brand"
      href="/"
      onClick={(e) => {
        e.preventDefault();
        navigate('/');
      }}
    >
      <Icon name="note" color="var(--brand-primary)" size={20} />
      <span>Lick Share</span>
    </a>
    <AvatarMenu user={user} onSignIn={onSignIn} onSignOut={onSignOut} />
  </header>
);
```

- [ ] **Step 4: CSS — 아바타·브랜드 규칙을 모바일에서도 쓰도록 이동 + .c-mappbar 추가**

`src/community/community.css`에서:

1. `@media (min-width: 1024px)` 블록 **안**에 있는 `.c-brand`, `.c-avatarwrap`, `.c-avatar`, `.c-avatarmenu`, `.c-avatarmenu button`, `.c-avatarmenu button:hover` 규칙을 미디어쿼리 **밖**(예: `.c-create` 규칙 근처)으로 그대로 이동한다. 선택자·선언은 변경하지 않는다.
2. 미디어쿼리 밖에 추가:

```css
/* ── 모바일 상단 앱 바 (<1024px) — ≥1024px에서는 숨김 ── */
.c-mappbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
```

3. `@media (min-width: 1024px)` 블록 안에 추가:

```css
  .c-mappbar {
    display: none;
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/community/components/MobileAppBar.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 6: Gate + Commit**

```bash
npm run typecheck && npm run lint && npm test && npm run check-smp
git add src/community/components/MobileAppBar.tsx src/community/components/MobileAppBar.test.tsx src/community/community.css
git commit -m "feat(community): add mobile top app bar"
```

---

### Task 4: TabBar (모바일 하단 탭바) + CSS

**Files:**
- Create: `src/community/components/TabBar.tsx`
- Test: `src/community/components/TabBar.test.tsx`
- Modify: `src/community/community.css`

**Interfaces:**
- Consumes: `visibleItems`(Task 1), `Route`·`navigate`(routing.ts)
- Produces: `TabBar({ route: Route; user: User | null })` — Task 6이 Root에 장착

- [ ] **Step 1: Write the failing test**

`src/community/components/TabBar.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

const navigate = vi.fn<(path: string) => void>();
vi.mock('../routing', async (orig) => ({
  ...(await orig<typeof import('../routing')>()),
  navigate: (p: string) => navigate(p),
}));

import { TabBar } from './TabBar';

const fakeUser = {} as User;

describe('TabBar', () => {
  it('로그인 시 탭 순서: Latest · Create · Ranking · My licks', () => {
    render(<TabBar route={{ name: 'feed' }} user={fakeUser} />);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Latest',
      'Create',
      'Ranking',
      'My licks',
    ]);
  });

  it('비로그인 시 My licks 탭이 없다', () => {
    render(<TabBar route={{ name: 'feed' }} user={null} />);
    expect(screen.queryByText('My licks')).toBeNull();
  });

  it('현재 라우트 탭에 active + aria-current=page', () => {
    render(<TabBar route={{ name: 'ranking' }} user={null} />);
    const tab = screen.getByRole('button', { name: 'Ranking' });
    expect(tab.className).toContain('active');
    expect(tab.getAttribute('aria-current')).toBe('page');
  });

  it('탭 클릭 → navigate', () => {
    render(<TabBar route={{ name: 'feed' }} user={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(navigate).toHaveBeenCalledWith('/edit');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/community/components/TabBar.test.tsx`
Expected: FAIL — "Cannot find module './TabBar'"

- [ ] **Step 3: Write implementation**

`src/community/components/TabBar.tsx`:

```tsx
/**
 * 모바일 하단 탭바 (<1024px 전용, CSS가 전환) — visibleItems 단일 모델 렌더.
 * Create 탭은 원형 brand primary로 강조한다 (unified-nav-share 설계).
 */
import type { JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import { Icon } from '../../ui/components/common/Icon';
import { visibleItems } from '../nav-items';
import { navigate, type Route } from '../routing';

interface Props {
  readonly route: Route;
  readonly user: User | null;
}

export const TabBar = ({ route, user }: Props): JSX.Element => (
  <nav className="c-tabbar" aria-label="Primary">
    {visibleItems(user !== null).map((n) => {
      const active = route.name === n.match;
      const create = n.match === 'edit';
      return (
        <button
          key={n.to}
          type="button"
          className={`c-tab${active ? ' active' : ''}`}
          {...(active ? { 'aria-current': 'page' as const } : {})}
          onClick={() => navigate(n.to)}
        >
          <span className={create ? 'c-tab-ring' : 'c-tab-ic'}>
            <Icon
              name={n.icon}
              size={create ? 18 : 19}
              color={
                create
                  ? 'var(--brand-primary-text)'
                  : active
                    ? 'var(--brand-primary)'
                    : 'var(--mut2)'
              }
            />
          </span>
          {n.label}
        </button>
      );
    })}
  </nav>
);
```

- [ ] **Step 4: CSS 추가**

`src/community/community.css` 미디어쿼리 밖(`.c-mappbar` 근처)에 추가:

```css
/* ── 모바일 하단 탭바 (<1024px) — ≥1024px에서는 숨김 ── */
.c-tabbar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  width: 100%;
  max-width: var(--app-max-width);
  display: flex;
  align-items: stretch;
  height: 60px;
  background: var(--bg-card);
  border-top: 1px solid var(--line);
  padding-bottom: env(safe-area-inset-bottom);
}

.c-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: none;
  background: none;
  font: inherit;
  font-size: 10px;
  color: var(--mut2);
  cursor: pointer;
}

.c-tab.active {
  color: var(--brand-tint-text);
  font-weight: 700;
}

.c-tab-ic {
  display: flex;
}

.c-tab-ring {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-top: -14px;
  border-radius: 50%;
  background: var(--brand-primary);
}
```

`@media (min-width: 1024px)` 블록 안에 추가:

```css
  .c-tabbar {
    display: none;
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/community/components/TabBar.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 6: Gate + Commit**

```bash
npm run typecheck && npm run lint && npm test && npm run check-smp
git add src/community/components/TabBar.tsx src/community/components/TabBar.test.tsx src/community/community.css
git commit -m "feat(community): add mobile bottom tab bar"
```

---

### Task 5: Sidebar·AppBar가 nav-items를 사용

**Files:**
- Modify: `src/community/components/Sidebar.tsx` (자체 `NAV` 상수 제거)
- Modify: `src/community/components/AppBar.tsx` (Create 버튼을 모델에서)
- Test: `src/community/components/Sidebar.test.tsx` (가드 1건 추가)

**Interfaces:**
- Consumes: `NAV_ITEMS`·`visibleItems`(Task 1)

- [ ] **Step 1: Write the failing test (Sidebar에 Create 부재 가드)**

`src/community/components/Sidebar.test.tsx`의 `describe('Sidebar', …)` 안에 추가:

```tsx
  it('Create는 Sidebar에 없다 (AppBar·TabBar 전용) — 나머지 순서 Latest→Ranking→My licks', () => {
    render(<Sidebar route={{ name: 'feed' }} user={fakeUser} />);
    expect(screen.queryByRole('link', { name: /create/i })).toBeNull();
    expect(
      screen.getAllByRole('link', { name: /latest|ranking|my licks/i }).map((a) => a.textContent),
    ).toEqual(['Latest', 'Ranking', 'My licks']);
  });
```

Run: `npx vitest run src/community/components/Sidebar.test.tsx`
Expected: 새 테스트 PASS 여부와 무관하게 일단 실행 — 현 구현도 Create가 없으므로 PASS일 수 있다.
이 테스트는 리팩토링 후에도 지켜야 할 가드다(RED가 아니어도 진행).

- [ ] **Step 2: Sidebar 리팩토링**

`src/community/components/Sidebar.tsx`에서:
- `NAV` 상수와 `IconName` import 제거
- `import { visibleItems } from '../nav-items';` 추가
- `const items = NAV.filter((n) => n.match !== 'me' || user);` 를 다음으로 교체:

```tsx
  // 단일 NAV 모델에서 파생 — Create(/edit)는 AppBar·TabBar 전용이므로 제외
  const items = visibleItems(user !== null).filter((n) => n.match !== 'edit');
```

(렌더 JSX는 `n.to`/`n.label`/`n.icon`/`n.match`를 그대로 쓰므로 변경 없음)

- [ ] **Step 3: AppBar Create 버튼을 모델에서 파생**

`src/community/components/AppBar.tsx`에서:
- `import { NAV_ITEMS } from '../nav-items';` 추가
- 기존 `<button type="button" className="c-create" …>` 블록을 다음으로 교체:

```tsx
      {NAV_ITEMS.filter((n) => n.match === 'edit').map((n) => (
        <button key={n.to} type="button" className="c-create" onClick={() => navigate(n.to)}>
          <Icon name={n.icon} color="var(--brand-primary-text)" size={14} />
          {n.label}
        </button>
      ))}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npx vitest run src/community/components/Sidebar.test.tsx src/community/components/AppBar.test.tsx`
Expected: PASS 전부 (AppBar의 "Create 버튼은 /edit로 이동" 포함)

- [ ] **Step 5: Gate + Commit**

```bash
npm run typecheck && npm run lint && npm test && npm run check-smp
git add src/community/components/Sidebar.tsx src/community/components/AppBar.tsx src/community/components/Sidebar.test.tsx
git commit -m "refactor(community): render sidebar and appbar from nav model"
```

---

### Task 6: Root 셸 교체 — CommunityHeader 삭제, 모바일 셸 장착

**Files:**
- Modify: `src/community/Root.tsx`
- Delete: `src/community/components/CommunityHeader.tsx`
- Modify: `src/community/Root.test.tsx`
- Modify: `src/community/community.css` (.c-header/.c-nav 규칙 제거, 본문 하단 여백)

**Interfaces:**
- Consumes: `MobileAppBar`(Task 3), `TabBar`(Task 4)

- [ ] **Step 1: Write the failing test**

`src/community/Root.test.tsx`의 `describe('Root 라우팅', …)` 안에 추가:

```tsx
  it('모바일 셸: TabBar·MobileAppBar가 있고 구 CommunityHeader가 없다', () => {
    renderAt('/');
    expect(document.querySelector('.c-tabbar')).toBeTruthy();
    expect(document.querySelector('.c-mappbar')).toBeTruthy();
    expect(document.querySelector('.c-header')).toBeNull();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/community/Root.test.tsx`
Expected: FAIL — `.c-tabbar` 없음

- [ ] **Step 3: Root 수정 + CommunityHeader 삭제**

`src/community/Root.tsx`에서:
- `CommunityHeader` import 제거, `MobileAppBar`·`TabBar` import 추가:

```tsx
import { MobileAppBar } from './components/MobileAppBar';
import { TabBar } from './components/TabBar';
```

- 셸 렌더를 다음으로 교체 (`<CommunityHeader …/>` 제거, 데스크톱/모바일 두 셸 모두 DOM에 두고 CSS가 전환):

```tsx
  return (
    <div className="community">
      <AppBar user={user} onSignIn={onSignIn} onSignOut={onSignOut} />
      <MobileAppBar user={user} onSignIn={onSignIn} onSignOut={onSignOut} />
      <div className="community-shell">
        <Sidebar route={route} user={user} />
        <main className="c-main">{view}</main>
        <TopLicks />
      </div>
      <TabBar route={route} user={user} />
    </div>
  );
```

- 파일 삭제:

```bash
git rm src/community/components/CommunityHeader.tsx
```

- [ ] **Step 4: CSS 정리**

`src/community/community.css`에서:
1. `.c-header`, `.c-nav`, `.c-nav a`, `.c-nav a.active` 규칙 삭제.
   `@media (min-width: 1024px)` 안의 `.c-header { display: none; }` 도 삭제.
   (`.c-linkbtn`은 삭제 전 `grep -rn "c-linkbtn" src/` 로 다른 사용처가 없는지 확인 — CommunityHeader 전용이면 함께 삭제)
2. 탭바가 본문을 가리지 않도록 미디어쿼리 밖에 추가:

```css
/* 하단 탭바 높이만큼 본문 여백 (모바일) */
.community {
  padding-bottom: 72px;
}
```

3. `@media (min-width: 1024px)` 안에 추가:

```css
  .community {
    padding-bottom: 0;
  }
```

(주의: `.community` 기본 규칙이 이미 파일 상단에 있으므로 `padding-bottom`은 별도 규칙 블록으로 추가해도 되고 기존 블록에 선언을 추가해도 된다 — 기존 블록에 추가를 권장)

- [ ] **Step 5: Run tests to verify GREEN**

Run: `npx vitest run src/community/Root.test.tsx`
Expected: PASS 전부 (기존 "Publish 링크가 없다" 가드 포함)

- [ ] **Step 6: Gate + Commit**

```bash
npm run typecheck && npm run lint && npm test && npm run check-smp
git add -A src/community
git commit -m "feat(community): replace mobile header with appbar and tab bar"
```

---

### Task 7: 편집 상단 바 정리 — Share 단일 버튼 + Back(onExit), View 모드 제거

편집 화면의 진출 경로를 통일한다: 좌상단 ←Back = 커뮤니티 복귀, Share 버튼 하나 = `/publish#hash`.
편집자용 내부 View 전환(`setMode('view')`)을 제거한다. `?mode=view` 수신자 링크(Viewer)는 불변.
컴포넌트·App·Root가 prop으로 얽혀 있어 한 커밋으로 처리한다(논리 단위: "편집 진출 경로 통일").

**Files:**
- Modify: `src/ui/components/edit/Header.tsx`, `src/ui/components/edit/Header.test.tsx`
- Modify: `src/ui/components/edit/ws/WsTopBar.tsx`, `src/ui/components/edit/ws/WsTopBar.test.tsx`
- Modify: `src/ui/components/edit/ws/Workspace.tsx` (+ `Workspace.test.tsx`의 prop 이름)
- Modify: `src/ui/components/App.tsx`, `src/ui/components/App.test.tsx`
- Modify: `src/community/Root.tsx`, `src/styles/global.css`

**Interfaces:**
- Produces (AppProps): `onShare?: (hash: string) => void`(구 onPublish 대체), `onExit?: () => void` — Root가 주입
- Produces (Header/WsTopBar/Workspace props): `onShare: () => void`, `onExit: () => void`
- 유지: App 내부 `copyShare`는 legacyView(Viewer) 전용으로 남는다 — 하위 호환 절대 규칙

- [ ] **Step 1: Write the failing tests — Header**

`src/ui/components/edit/Header.test.tsx`에서:
- `cbs`를 다음으로 교체:

```tsx
const cbs = {
  onAccSelect: vi.fn(),
  onToggleMetro: vi.fn(),
  onTogglePlay: vi.fn(),
  onTempoApply: vi.fn(),
  onShare: vi.fn(),
  onExit: vi.fn(),
};
```

- 기존 `test('공유 팝오버: …')`와 `test('보기 버튼', …)`을 다음 둘로 교체:

```tsx
  test('Share 버튼 → onShare 즉시 호출 (팝오버 없음)', () => {
    const { container } = renderHeader();
    fireEvent.click($(container, '[data-btn="share"]'));
    expect(cbs.onShare).toHaveBeenCalled();
    expect(container.querySelector('[data-share]')).toBeNull();
  });

  test('Back 버튼 → onExit, View 버튼은 없다', () => {
    const { container } = renderHeader();
    fireEvent.click($(container, '[data-btn="back"]'));
    expect(cbs.onExit).toHaveBeenCalled();
    expect(container.querySelector('[data-btn="view"]')).toBeNull();
  });
```

- [ ] **Step 2: Write the failing tests — WsTopBar**

`src/ui/components/edit/ws/WsTopBar.test.tsx` 전체를 다음으로 교체:

```tsx
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { demoSong } from '../../../../core/demo-song';
import { WsTopBar } from './WsTopBar';

afterEach(cleanup);

const setup = () => {
  const h = { onExit: vi.fn(), onShare: vi.fn() };
  const utils = render(<WsTopBar song={demoSong} {...h} />);
  return { ...utils, ...h };
};

describe('WsTopBar', () => {
  test('제목 + Auto-saved 표기', () => {
    const { container } = setup();
    expect(container.textContent).toContain('Spring Sketch');
    expect(container.textContent).toContain('Auto-saved');
  });

  test('← 뒤로 → onExit (커뮤니티 복귀)', () => {
    const { container, onExit } = setup();
    fireEvent.click(container.querySelector('[data-btn="back"]') as Element);
    expect(onExit).toHaveBeenCalledOnce();
  });

  test('Share primary 단일 버튼 → onShare, Publish 버튼은 없다', () => {
    const { container, onShare } = setup();
    const share = container.querySelector('[data-btn="share"]') as HTMLElement;
    fireEvent.click(share);
    expect(onShare).toHaveBeenCalledOnce();
    expect(share.className).toContain('ws-btn-primary');
    expect(container.querySelector('[data-btn="publish"]')).toBeNull();
  });
});
```

- [ ] **Step 3: Write the failing tests — App**

`src/ui/components/App.test.tsx`에서:
- `test('공유→Copy link: …')`를 다음으로 교체 (열람 describe의 `setupView` 사용 — 이 테스트는
  이미 열람 describe 안에 있다):

```tsx
  test('레거시 열람 Copy link → ?mode=view#v1. URL 클립보드 복사 + 토스트', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const { container, findByText } = setupView();
    click(container, '[data-btn="copy"]');
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('?mode=view#v1.'));
    expect(await findByText('View link copied')).toBeTruthy();
    vi.unstubAllGlobals();
  });
```

- `test('공유→Publish: …')`를 다음으로 교체:

```tsx
  test('편집 Share 버튼: 현재 곡 해시로 onShare 호출', () => {
    const onShare = vi.fn();
    const time = { t: 0 };
    const { container } = render(
      <App
        store={createSongStore()}
        player={createPlayer({ sink: createFakeAudioSink(() => time.t), clock: createFakeClock() })}
        hashStore={createMemoryHashStore('')}
        onShare={onShare}
      />,
    );
    click(container, '[data-btn="share"]');
    expect(onShare).toHaveBeenCalledTimes(1);
    expect((onShare.mock.calls[0]?.[0] as string).startsWith('v1.')).toBe(true);
  });

  test('편집 Back 버튼 → onExit, View 버튼은 없다', () => {
    const onExit = vi.fn();
    const time = { t: 0 };
    const { container } = render(
      <App
        store={createSongStore()}
        player={createPlayer({ sink: createFakeAudioSink(() => time.t), clock: createFakeClock() })}
        hashStore={createMemoryHashStore('')}
        onExit={onExit}
      />,
    );
    expect(container.querySelector('[data-btn="view"]')).toBeNull();
    click(container, '[data-btn="back"]');
    expect(onExit).toHaveBeenCalledTimes(1);
  });
```

(`test('복제해서 편집 → edit 전환 + 데이터 유지')`은 레거시 Viewer 경로이므로 그대로 둔다)

- [ ] **Step 4: Run tests to verify RED**

Run: `npx vitest run src/ui/components/edit/Header.test.tsx src/ui/components/edit/ws/WsTopBar.test.tsx src/ui/components/App.test.tsx`
Expected: FAIL (onShare/onExit prop 부재, back 버튼 부재 등)

- [ ] **Step 5: Header.tsx 구현**

`src/ui/components/edit/Header.tsx`:
- Props를 교체:

```tsx
export interface HeaderProps {
  readonly song: Song;
  readonly accOn: boolean;
  readonly metroOn: boolean;
  readonly playing: boolean;
  readonly onAccSelect: (v: AccPattern | 'off') => void;
  readonly onToggleMetro: () => void;
  readonly onTogglePlay: () => void;
  /** 클램프는 core setTempo가 담당 — 원시 값 전달 */
  readonly onTempoApply: (v: number) => void;
  /** Share 화면(/publish) 진입 */
  readonly onShare: () => void;
  /** 편집 종료 — 커뮤니티 복귀 */
  readonly onExit: () => void;
}
```

- `sharePop` 상태와 `share-pop` 팝오버 블록 삭제.
- `header-left`를 Back 버튼 + 타이틀 묶음으로 교체:

```tsx
        <div className="header-left">
          <button
            type="button"
            data-btn="back"
            className="icon-btn"
            aria-label="Back to community"
            onClick={onExit}
          >
            <Icon name="prev" size={15} />
          </button>
          <div>
            <div className="eyebrow">LICK SHARE — EDIT</div>
            <h1 className="title">{song.title}</h1>
          </div>
        </div>
```

- Share 버튼은 onClick만 교체, View 버튼 삭제:

```tsx
          <button type="button" data-btn="share" className="icon-btn" aria-label="Share" onClick={onShare}>
            <Icon name="share" size={15} />
          </button>
```

- 파일 상단 주석을 "반주/메트로놈/재생/템포/공유/뒤로 + 메타라인"으로 갱신.

`src/styles/global.css`의 `.header-row` 근처에 추가:

```css
.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
```

- [ ] **Step 6: WsTopBar.tsx 구현**

전체를 다음으로 교체:

```tsx
/**
 * 워크스페이스 상단 바 (unified-nav-share 설계).
 * 좌: ← 뒤로(커뮤니티 복귀) · 곡 제목 · "Auto-saved"(muted).
 * 우: [Share] brand primary 단일 버튼 — /publish 화면이 재생·복사·게시를 모두 담당.
 */
import type { JSX } from 'react';
import type { Song } from '../../../../core/types';
import { Icon } from '../../common/Icon';

export interface WsTopBarProps {
  readonly song: Song;
  /** 편집 종료 — 커뮤니티 복귀 */
  readonly onExit: () => void;
  /** Share 화면(/publish) 진입 */
  readonly onShare: () => void;
}

export const WsTopBar = ({ song, onExit, onShare }: WsTopBarProps): JSX.Element => (
  <header className="ws-top">
    <div className="ws-top-left">
      <button type="button" data-btn="back" className="ws-back" aria-label="Back to community" onClick={onExit}>
        <Icon name="prev" size={16} />
      </button>
      <h1 className="ws-title">{song.title}</h1>
      <span className="ws-saved">Auto-saved</span>
    </div>
    <div className="ws-top-right">
      <button type="button" data-btn="share" className="ws-btn-primary" onClick={onShare}>
        Share
      </button>
    </div>
  </header>
);
```

- [ ] **Step 7: Workspace.tsx prop 연결 교체**

`src/ui/components/edit/ws/Workspace.tsx`에서:
- `WorkspaceProps`의 `onBack`/`onCopyLink`/`onPublish` 3개를 다음 2개로 교체:

```tsx
  readonly onExit: () => void;
  readonly onShare: () => void;
```

- 구조 분해와 WsTopBar 호출을 교체:

```tsx
      <WsTopBar song={song} onExit={onExit} onShare={onShare} />
```

- `Workspace.test.tsx`에 `onBack`/`onCopyLink`/`onPublish` mock이 있으면 `onExit`/`onShare`로 교체
  (확인: `grep -n "onBack\|onCopyLink\|onPublish" src/ui/components/edit/ws/Workspace.test.tsx`)

- [ ] **Step 8: App.tsx 구현**

`src/ui/components/App.tsx`에서:

1. `AppProps`의 `onPublish` 항목을 다음으로 교체:

```tsx
  /** Share 화면 진입 — community Root가 주입 (ui→community 의존 회피) */
  readonly onShare?: (hash: string) => void;
  /** 편집 종료(커뮤니티 복귀) — community Root가 주입 */
  readonly onExit?: () => void;
```

2. 컴포넌트 인자 `onPublish` → `onShare, onExit`.

3. `publishShare`를 삭제하고 다음을 추가 (`copyShare`는 남긴다 — 주석만 교체):

```tsx
  /** 레거시 열람(?mode=view) 전용: 열람 링크 클립보드 복사 (SPEC §7, 하위 호환) */
  // copyShare 함수 본문은 변경 없음

  /** 공유: 현재 곡 해시로 Share 화면 진입 (Root가 콜백 주입) */
  const share = (): void => {
    onShare?.(encodeSong(store.getState().song));
  };

  /** 편집 종료: 재생 정지 후 커뮤니티 복귀 */
  const exit = (): void => {
    player.stop();
    onExit?.();
  };
```

4. 데스크톱 `<Workspace …>`에서 `onCopyLink={copyShare}`·`onPublish={publishShare}`·
   `onBack={…setMode('view')…}` 3개를 다음으로 교체:

```tsx
          onShare={share}
          onExit={exit}
```

5. 모바일 `<Header …>`에서 `onPublish={publishShare}`·`onCopyLink={copyShare}`·
   `onView={…setMode('view')…}` 3개를 다음으로 교체:

```tsx
          onShare={share}
          onExit={exit}
```

6. `mode === 'view'` 분기(Viewer)는 변경하지 않는다 — `onCopyLink={copyShare}`·`onToEdit` 유지.
   이로써 edit 모드에서 `setMode('view')` 호출이 모두 사라진다.

7. 파일 상단 주석의 "열람(view) 라우팅은 P9" 문구를 "view 모드는 ?mode=view 레거시 열람 전용"으로 갱신.

- [ ] **Step 9: Root.tsx 주입 갱신 (onShare/onExit + 마지막 커뮤니티 라우트 기억)**

`src/community/Root.tsx`에서:
- import에 `useRef` 추가.
- `Root` 본문에 추가 (route 선언 아래):

```tsx
  // 편집 ←Back의 목적지: 마지막으로 머문 커뮤니티 화면 (편집·레거시열람·게시 화면은 제외)
  const lastCommunityPath = useRef('/');
  useEffect(() => {
    if (route.name !== 'edit' && route.name !== 'legacyView' && route.name !== 'publish') {
      lastCommunityPath.current = window.location.pathname;
    }
  }, [route]);
```

- edit 라우트 렌더를 교체:

```tsx
  if (route.name === 'edit')
    return (
      <App
        player={player}
        hashStore={hashStore}
        initialMode="edit"
        onShare={(hash) => navigate('/publish#' + hash)}
        onExit={() => navigate(lastCommunityPath.current)}
      />
    );
```

- [ ] **Step 10: Run tests to verify GREEN**

Run: `npx vitest run src/ui src/community`
Expected: PASS 전부. 특히 App.test의 접근성 테스트(모든 버튼에 이름)와
"복제해서 편집" 레거시 테스트가 통과해야 한다.

- [ ] **Step 11: Gate + Commit**

```bash
npm run typecheck && npm run lint && npm test && npm run check-smp
git add src/ui src/community src/styles/global.css
git commit -m "feat(edit): unify exit and share actions in edit top bars"
```

---

### Task 8: Share 화면 통합 — Publish에 재생·Copy link·게이트 완화

**Files:**
- Modify: `src/community/views/Publish.tsx` (전체 재작성)
- Modify: `src/community/views/Publish.test.tsx`
- Modify: `src/community/Root.tsx` (`<Publish user={user} player={player} />`)
- Modify: `src/community/community.css` (.c-backlink, .c-form-actions)

**Interfaces:**
- Consumes: `ScoreToolbar({ playing, loop, bpm, onTogglePlay, onToggleLoop, onBpmChange })`,
  `Player.play(song, opts, from, to, loop)`, `Player.setLoop(on)`, `total(song)`, `asStep(n)`
- Produces: `Publish({ user: User | null; player: Player })`

- [ ] **Step 1: Write the failing tests**

`src/community/views/Publish.test.tsx`에서:

1. import에 추가:

```tsx
import type { Player } from '../../adapters/player';
```

2. `fakeUser` 선언 아래에 추가:

```tsx
const fakePlayer = (): Player =>
  ({
    play: vi.fn(),
    stop: vi.fn(),
    isPlaying: vi.fn(() => false),
    onTick: vi.fn(() => () => {}),
    onEnded: vi.fn(() => () => {}),
    setLoop: vi.fn(),
    preview: vi.fn(),
    toggleAcc: vi.fn(),
    toggleMetro: vi.fn(),
  }) as unknown as Player;
```

3. `renderAt`을 교체:

```tsx
const renderAt = (hash: string, user: User | null = fakeUser, player: Player = fakePlayer()) => {
  window.history.pushState(null, '', '/publish' + hash);
  return { ...render(<Publish user={user} player={player} />), player };
};
```

4. 기존 `it('로그인하지 않았으면 안내 문구만, 입력창 없음', …)`을 교체:

```tsx
  it('비로그인: 미리보기·Copy link는 보이고 Publish 자리에 로그인 안내', () => {
    renderAt('#' + validHash, null);
    expect(document.querySelector('svg')).toBeTruthy();
    expect(screen.getByText('Copy link')).toBeTruthy();
    expect(screen.getByText('Sign in to publish')).toBeTruthy();
    expect(screen.queryByText('Publish')).toBeNull();
    expect(publishLick).not.toHaveBeenCalled();
  });
```

5. describe 끝에 신규 테스트 추가:

```tsx
  it('재생 토글: Play 클릭 → player.play (멜로디+반주+메트로놈 옵션)', () => {
    const { player } = renderAt('#' + validHash);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(player.play).toHaveBeenCalledTimes(1);
    expect((player.play as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]).toEqual({
      melody: true,
      accomp: true,
      metro: true,
    });
  });

  it('Copy link → /?mode=view#hash 클립보드 복사 + Link copied 토스트', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    renderAt('#' + validHash);
    fireEvent.click(screen.getByText('Copy link'));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('?mode=view#' + validHash));
    expect(await screen.findByText('Link copied')).toBeTruthy();
    vi.unstubAllGlobals();
  });

  it('Back to editor → /edit#hash로 이동', () => {
    renderAt('#' + validHash);
    fireEvent.click(screen.getByText(/Back to editor/));
    expect(navigate).toHaveBeenCalledWith('/edit#' + validHash);
  });
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npx vitest run src/community/views/Publish.test.tsx`
Expected: FAIL — `player` prop 부재(타입 에러) 또는 Copy link/Play 요소 없음

- [ ] **Step 3: Publish.tsx 재작성**

`src/community/views/Publish.tsx` 전체를 다음으로 교체:

```tsx
/**
 * Share 화면 (unified-nav-share 설계). 에디터 Share로 진입 — 곡 blob(v1.…)은 URL 해시.
 * 미리보기 + 재생(ScoreToolbar) + 제목/태그 + Copy link(비로그인 가능) + 게시(로그인 게이트).
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Player } from '../../adapters/player';
import { decodeSong } from '../../core/codec';
import { total } from '../../core/geometry';
import { asStep } from '../../core/types';
import { Score } from '../../ui/components/edit/Score';
import { publishLick } from '../api/licks';
import { ScoreToolbar } from '../components/ScoreToolbar';
import { TagInput } from '../components/TagInput';
import { melodyHash } from '../melody-hash';
import { navigate } from '../routing';
import { normalizeTags } from '../tags';

interface Props {
  readonly user: User | null;
  readonly player: Player;
}

// 열람 재생: 각 종류를 모두 내보내고 실제 소리는 곡 데이터(accPat/metro)가 결정
const VIEW_OPTS = { melody: true, accomp: true, metro: true };

/** 진입 시점의 URL 해시에서 곡 blob(v1.…)을 한 번 캡처 — 없으면 빈 문자열 */
const readInitialHash = (): string => {
  const h = window.location.hash;
  return h.startsWith('#v1.') ? h.slice(1) : '';
};

type Status =
  | { readonly kind: 'idle' }
  | { readonly kind: 'submitting' }
  | { readonly kind: 'duplicate' }
  | { readonly kind: 'error'; readonly message?: string };

export const Publish = ({ user, player }: Props): JSX.Element => {
  const [hash] = useState(readInitialHash);
  const song = hash ? decodeSong(hash) : null;
  // 음표 없는 곡은 무효 취급 — melodyHash([])는 모든 빈 릭이 충돌하므로 게시 차단
  const validSong = song && song.notes.length > 0 ? song : null;
  const [title, setTitle] = useState(validSong?.title ?? '');
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [toast, setToast] = useState<string | null>(null);
  // 재생/툴바 세션 상태 (bpm·loop는 세션 한정 — 저장하지 않는다, LickDetail과 동일 패턴)
  const [playing, setPlaying] = useState(false);
  const [playheadStep, setPlayheadStep] = useState<number | null>(null);
  const [loop, setLoop] = useState(false);
  const [bpm, setBpm] = useState(validSong?.tempo ?? 120);
  const lastEl = useRef(0);

  /* 재생 진행 구독 + 언마운트 시 정지 */
  useEffect(() => {
    const unsubTick = player.onTick((el) => {
      lastEl.current = el;
      setPlayheadStep(el);
    });
    const unsubEnded = player.onEnded(() => {
      setPlaying(false);
      setPlayheadStep(null);
    });
    return () => {
      unsubTick();
      unsubEnded();
      player.stop();
    };
  }, [player]);

  /* 토스트 자동 소멸 */
  useEffect(() => {
    if (toast === null) return;
    const t = setTimeout(() => setToast(null), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  if (!hash)
    return (
      <p className="c-state">
        No score to publish.{' '}
        <a
          href="/edit"
          onClick={(e) => {
            e.preventDefault();
            navigate('/edit');
          }}
        >
          Go to the editor
        </a>{' '}
        to create one.
      </p>
    );

  if (!song) return <p className="c-state">Couldn&apos;t read this score</p>;
  if (!validSong) return <p className="c-state">This lick has no notes</p>;

  /* 세션 템포로 재생 — bpm은 곡을 바꾸지 않고 지금 듣는 속도만 바꾼다 */
  const playFrom = (fromStep: number): void => {
    player.play({ ...validSong, tempo: bpm }, VIEW_OPTS, asStep(fromStep), asStep(total(validSong)), loop);
    setPlaying(true);
  };

  const onTogglePlay = (): void => {
    if (player.isPlaying()) {
      player.stop();
      return;
    }
    playFrom(0);
  };

  const onToggleLoop = (): void => {
    const next = !loop;
    setLoop(next);
    player.setLoop(next); // 재생 중이면 즉시 반영, 아니면 no-op
  };

  const onBpmChange = (v: number): void => {
    setBpm(v);
    // 재생 중 변경은 현재 위치에서 새 템포로 이어 재생
    if (player.isPlaying()) {
      player.play(
        { ...validSong, tempo: v },
        VIEW_OPTS,
        asStep(Math.floor(lastEl.current)),
        asStep(total(validSong)),
        loop,
      );
    }
  };

  /** 열람 링크 복사 — 비로그인도 가능. 클립보드 미지원 시 prompt 폴백 (LickDetail과 동일) */
  const onCopyLink = (): void => {
    const url = `${window.location.origin}/?mode=view#${hash}`;
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(url).then(() => setToast('Link copied'));
    } else {
      window.prompt('Copy this link', url);
    }
  };

  const onPublish = async (): Promise<void> => {
    setStatus({ kind: 'submitting' });
    try {
      const mh = await melodyHash(validSong.notes);
      // TagInput이 이미 정규화하지만 최종 방어로 한 번 더 적용 (설계 §5)
      const result = await publishLick(
        title.trim() || validSong.title,
        hash,
        mh,
        normalizeTags(tags),
      );
      if (result.ok) {
        navigate('/lick/' + result.id);
        return;
      }
      if (result.reason === 'duplicate') {
        setStatus({ kind: 'duplicate' });
      } else {
        setStatus(
          result.message === undefined
            ? { kind: 'error' }
            : { kind: 'error', message: result.message },
        );
      }
    } catch {
      setStatus({ kind: 'error', message: 'Publish failed' });
    }
  };

  return (
    <div className="c-form">
      <a
        className="c-backlink"
        href={'/edit#' + hash}
        onClick={(e) => {
          e.preventDefault();
          navigate('/edit#' + hash);
        }}
      >
        ← Back to editor
      </a>
      <Score
        song={validSong}
        mode="view"
        width={384}
        {...(playing && playheadStep !== null ? { playheadStep } : {})}
      />
      <ScoreToolbar
        playing={playing}
        loop={loop}
        bpm={bpm}
        onTogglePlay={onTogglePlay}
        onToggleLoop={onToggleLoop}
        onBpmChange={onBpmChange}
      />
      <input
        className="c-input"
        aria-label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <TagInput value={tags} onChange={setTags} />
      <div className="c-form-actions">
        <button type="button" className="c-btn" onClick={onCopyLink}>
          Copy link
        </button>
        {user ? (
          <button
            type="button"
            className="c-btn c-btn-primary"
            disabled={status.kind === 'submitting'}
            onClick={() => void onPublish()}
          >
            {status.kind === 'submitting' ? 'Publishing…' : 'Publish'}
          </button>
        ) : (
          <p className="c-state">Sign in to publish</p>
        )}
      </div>
      {status.kind === 'duplicate' && <p className="c-state">You already published this lick</p>}
      {status.kind === 'error' && <p className="c-state">{status.message ?? 'Publish failed'}</p>}
      {toast && (
        <div className="c-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
};
```

주의: `.c-btn`이 `c-btn-primary` 없이 단독 사용 가능한지 확인
(`grep -n "^\.c-btn " src/community/community.css`) — 아웃라인 기본 스타일이 이미 있다.

- [ ] **Step 4: Root에서 player 전달**

`src/community/Root.tsx`의 `case 'publish':`를 교체:

```tsx
      case 'publish':
        return <Publish user={user} player={player} />;
```

- [ ] **Step 5: CSS 추가**

`src/community/community.css`의 `.c-form` 근처에 추가:

```css
.c-backlink {
  align-self: flex-start;
  font-size: 12px;
  color: var(--mut2);
  text-decoration: none;
}

.c-form-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
```

- [ ] **Step 6: Run tests to verify GREEN**

Run: `npx vitest run src/community/views/Publish.test.tsx src/community/Root.test.tsx`
Expected: PASS 전부 (기존 게시·중복·태그 테스트 포함 — 로그인 상태 기본이므로 그대로 통과)

- [ ] **Step 7: Gate + Commit**

```bash
npm run typecheck && npm run lint && npm test && npm run check-smp
git add src/community
git commit -m "feat(community): merge playback and copy link into share screen"
```

---

### Task 9: 수동 E2E 확인 (dev 서버)

- [ ] **Step 1: dev 서버로 두 레이아웃 확인**

Run: `npm run dev`

체크리스트 (브라우저 폭을 바꿔가며):
1. 모바일(<1024px): 하단 탭바 4개(로그인)/3개(비로그인), 활성 표시, 상단 로고+아바타
2. 데스크톱(≥1024px): AppBar+Sidebar, 탭바 없음
3. Create 진입 → 좌상단 ←Back → 직전 커뮤니티 화면 복귀 (Ranking에서 진입했으면 Ranking으로)
4. 편집에서 Share → /publish#hash: 미리보기·재생(플레이헤드)·템포·반복·Copy link·Publish
5. ← Back to editor → 곡 그대로 에디터 복귀
6. 기존 열람 링크 `/?mode=view#v1.…` 정상 동작 (Viewer + Copy link + Duplicate & edit)
7. 편집 화면에 View 버튼 없음

- [ ] **Step 2: 문제 없으면 완료. 발견 시 해당 Task로 돌아가 수정 후 게이트 재실행**

---

## Self-Review 체크 (플랜 작성 후 수행됨)

- 스펙 커버리지: nav-items(Task 1) / 렌더러 4종(Task 2~5) / Root 셸·CommunityHeader 삭제(Task 6) /
  편집 상단 바·View 모드 제거·lastCommunityPath(Task 7) / Share 화면 통합(Task 8) — 스펙 전 섹션 대응.
- 스펙과 다른 점 1건(의도적): 스펙은 "copyShare를 App에서 제거"라 했으나 legacyView(Viewer)의
  Copy link 버튼이 이를 사용하므로 **legacy 전용으로 유지**한다. 하위 호환 절대 규칙이 우선.
- 타입 일관성: `onShare?: (hash: string) => void`(App) vs `onShare: () => void`(Header/WsTopBar/Workspace) —
  App이 해시를 만들어 넘기는 `share()` 어댑터로 연결. `visibleItems(signedIn: boolean)` 사용처 3곳 동일.
