# 통합 네비게이션 + Share 화면 통합 — 설계

- 날짜: 2026-07-14
- 상태: 승인됨 (구현 대기)
- 범위: 상단 메뉴를 모바일/데스크톱 두 레이아웃으로 일관되게 재설계,
  편집자용 View 모드 제거 및 Share(=Publish) 화면으로 통합(재생 포함)

## 배경

세 가지 문제:

1. **장치 간 메뉴 불일치.** 데스크톱은 AppBar(로고·검색·Create·아바타)+Sidebar(Latest/Ranking/My licks),
   모바일은 CommunityHeader(텍스트 링크 한 줄) — 구성·위치·조작 방식이 서로 다르다.
   메뉴 정의도 세 컴포넌트(AppBar/Sidebar/CommunityHeader)에 흩어져 있어 어긋나기 쉽다.
2. **Create(/edit)가 막다른 화면.** 커뮤니티 헤더 없이 마운트되어 편집 중 다른 메뉴로 갈 수 없고,
   데스크톱 WsTopBar의 ←Back은 커뮤니티가 아닌 내부 View 모드로 간다.
3. **View 모드의 애매한 역할.** Create→View로 가면 "Duplicate & edit"라는 어긋난 라벨로만
   편집에 복귀할 수 있다. 편집자용 미리보기와 수신자용 열람이 한 화면에 섞여 있다.

## 결정 요약

| 항목 | 결정 |
|---|---|
| 메뉴 집합 | 두 장치 동일: Latest(`/`) · Ranking(`/ranking`) · Create(`/edit`) · My licks(`/me`, 로그인 시) · 계정(아바타) |
| 데스크톱(≥1024px) | AppBar + Sidebar 현행 유지, 메뉴 정의만 공유 모델로 교체 |
| 모바일(<1024px) | 상단 MobileAppBar(로고+아바타) + 하단 TabBar(Latest·Create·Ranking·My licks) 신설, CommunityHeader 삭제 |
| Create 화면 | 몰입형 유지(셸 없음) + 좌상단 고정 ←Back(마지막 커뮤니티 화면으로) |
| View 메뉴 | 편집자용 View 버튼·내부 모드 전환 제거. 수신자용 `?mode=view` 링크는 하위 호환 유지 |
| Share | 에디터의 Share 버튼 하나 → `/publish#hash`. 그 화면에 미리보기+재생+제목/태그+Publish+Copy link 완전 통합 |
| 구현 접근 | 단일 NAV 모델(`nav-items.ts`) + 장치별 렌더러 (검토안 B: CSS만 정리 — 중복 정의 문제 잔존으로 기각, 검토안 C: 라우팅/UI 라이브러리 도입 — 규모 대비 과함·레이어 규칙 저촉 여지로 기각) |

## 일관성 규칙 (UX 원칙)

- 커뮤니티 화면 간 이동은 항상 1탭: 데스크톱은 Sidebar/AppBar, 모바일은 TabBar.
- Create 진입도 1탭(데스크톱 AppBar 버튼 / 모바일 TabBar 중앙 탭).
- Create·Share 등 몰입 흐름에서 나오는 길은 항상 **좌상단 ←Back** — 위치·의미 고정.
- 아바타 메뉴 항목(My licks / Sign in·out)은 두 장치에서 동일.

## 정보 구조

### 데스크톱 (≥1024px) — 현행 유지

```
┌──────────────────────────────────────────┐
│ ♪ Lick Share   [search…]   [+ Create] (R)│ AppBar
├─────────┬────────────────────┬───────────┤
│ Latest  │                    │           │
│ Ranking │      (콘텐츠)        │ Top licks │
│ My licks│                    │           │
│ #tags   │                    │           │
└─────────┴────────────────────┴───────────┘
```

### 모바일 (<1024px) — 신설

```
┌──────────────────────┐
│ ♪ Lick Share     (R) │ MobileAppBar
├──────────────────────┤
│      (콘텐츠)          │
├──────────────────────┤
│ 🔥      ⊕      🏆  📁 │ TabBar (SVG 라인 아이콘)
│Latest Create Rank My │
└──────────────────────┘
```

- 아이콘은 기존 `Icon` 세트(fire·plus·trophy·folder, stroke 1.5 butt/miter)만 사용. 이모지 금지.
- Create 탭은 원형 brand primary 버튼으로 강조(탭바 위로 살짝 돌출).
- 로그아웃 상태에서는 My licks 탭 숨김(3탭). Sidebar와 동일 규칙 — `visibleItems`가 판정.

### Create(/edit) — 몰입형

- 셸(AppBar/TabBar/Sidebar) 없음. 편집 상단 바 좌측에 항상 `←` Back.
- Back 목적지: Root가 기억하는 **마지막 커뮤니티 라우트**(기본 `/`).
- 우측 액션은 **Share** 버튼 하나(brand primary) → `/publish#<현재 곡 해시>`.

## 컴포넌트 구조

### 신규 `src/community/nav-items.ts` — 메뉴 단일 정의처 (순수 모듈)

```ts
interface NavItem {
  readonly to: string;          // '/', '/ranking', '/edit', '/me'
  readonly label: string;       // 'Latest' | 'Ranking' | 'Create' | 'My licks'
  readonly icon: IconName;      // 'fire' | 'trophy' | 'plus' | 'folder'
  readonly match: Route['name'];
  readonly auth?: boolean;      // true면 로그인 시에만 노출
}
export const NAV_ITEMS: readonly NavItem[];
export const visibleItems = (signedIn: boolean): readonly NavItem[];
```

### 렌더러 — 전부 NAV_ITEMS만 읽는다

| 컴포넌트 | 변경 | 역할 |
|---|---|---|
| `AppBar.tsx` | 수정 | 데스크톱 상단 바. Create 버튼·아바타 메뉴 항목을 공유 모델에서 |
| `Sidebar.tsx` | 수정 | 자체 `NAV` 상수 제거 → `visibleItems` 사용 (인기 태그 섹션은 그대로) |
| `MobileAppBar.tsx` | 신규 | 모바일 상단: 로고 + 아바타 메뉴(AppBar와 동일 항목) |
| `TabBar.tsx` | 신규 | 모바일 하단 탭바. 활성 = `route.name === match` |
| `CommunityHeader.tsx` | 삭제 | 테스트 포함 |

### `Root.tsx`

- 커뮤니티 라우트: `AppBar+Sidebar`(데스크톱) / `MobileAppBar+TabBar`(모바일) 모두 DOM에 두고
  표시 전환은 현행처럼 CSS 미디어쿼리(1024px 경계)가 담당.
- `/edit` 진입 시 직전 커뮤니티 라우트를 `useRef`로 기억, `onExit: () => navigate(last)` 콜백을
  App에 주입. 기존 `onPublish` 주입과 같은 패턴 — ui 레이어는 community를 모른다.
- `Publish`에 `player` 전달 (Feed·LickDetail과 동일 패턴).

### 편집 상단 바

- 모바일 `Header.tsx`: `View` 버튼·Share 팝오버(`sharePop`) 제거 → `←` Back(`onExit`) +
  **Share** 버튼 하나(`onShare` → App이 `/publish#hash` 네비 콜백 호출).
  반주·메트로놈·재생·템포 버튼은 변경 없음.
- 데스크톱 `WsTopBar.tsx`: `onBack`을 View 모드 진입에서 `onExit`(커뮤니티 복귀)로 교체,
  우측 [Share 아웃라인 + Publish primary] 두 버튼 → **Share** primary 하나로 통일.
- `App.tsx`: `onPublish`/`onCopyLink` prop → `onShare`(해시 전달)·`onExit`로 정리.
  `copyShare`는 App에서 제거(Share 화면으로 이전).

## Share 화면 (`/publish` 확장)

라우트·진입 방식(`/publish#v1.…`)은 불변. 화면 구성(위→아래):

1. `← Back to editor` 링크 — `/edit#<hash>` (브라우저 back도 동일하게 동작, blob은 URL 해시라 보존)
2. 악보 미리보기(`Score`, mode="view")
3. **ScoreToolbar** — 재생·반복·템포. LickDetail과 동일 컴포넌트·동일 재생 규칙:
   멜로디 + 곡 데이터에 따른 반주·메트로놈(`{melody:true, accomp:true, metro:true}`),
   첫 코드 이전 무음 규칙 등은 player가 이미 보장.
4. 제목 입력 · 태그 입력(TagInput)
5. 버튼 행: **[Copy link] [Publish]**
   - Copy link: 로그인 불필요. `?mode=view#hash` URL 클립보드 복사 + 토스트 `'Link copied'`
     (LickDetail의 로컬 토스트 패턴과 동일. 클립보드 미지원 시 `window.prompt` 폴백도 동일).
   - Publish: 게이트를 화면 전체가 아닌 **버튼에만** 적용 — 비로그인 시 버튼 자리에
     "Sign in to publish"(로그인 유도). 미리보기·재생·Copy link는 비로그인도 가능.
   - melodyHash·중복 판정·publishLick·상태 메시지(duplicate/error)는 변경 없음.
- 해시 없음/디코드 불가/음표 없음 상태 처리는 현행 유지.
- 이탈 시 재생 정지(`player.stop()` — LickDetail의 언마운트 정리와 동일 패턴).

## 편집자용 View 모드 제거 (`App.tsx`)

- edit 모드의 `setMode('view')` 경로, `onView` prop, Share 팝오버 관련 상태 제거.
- `mode`는 라우트가 결정(`initialMode`)하는 값으로 단순화 — 내부 전환 없음.
- `Viewer.tsx`는 **유지**: `?mode=view#v1.…` 수신자 링크 전용(하위 호환 절대 규칙).
  Viewer의 "Duplicate & edit"(→ edit 모드 전환)도 유지 — 이 전환은 legacyView 경로 내부에만 남는다.

## 하위 호환 체크

- `v1.` 해시 포맷 불변. 미래 버전 해시 거부 동작 불변.
- `?mode=view#hash` 열람 링크 동작 불변 (Viewer 렌더).
- `/publish#hash` 진입 방식 불변 — 기능 추가만.
- 라우트 추가/삭제 없음 (`routing.ts` 파서 비변경).

## 테스트 (TDD — 먼저 작성)

- `nav-items.test.ts`: 항목 집합·순서, `visibleItems(false)`에 auth 항목 부재.
- `TabBar.test.tsx` / `MobileAppBar.test.tsx`: NAV_ITEMS 렌더, 활성 탭 표시, 탭 클릭 → navigate,
  로그아웃 시 My licks 부재, 아바타 메뉴 항목.
- `Sidebar.test.tsx` / `AppBar.test.tsx`: 공유 모델 사용으로 회귀 없음 확인(기존 단언 유지).
- `Root.test.tsx`: CommunityHeader 부재 가드, TabBar 존재, `/edit`의 `onExit`가 직전 커뮤니티
  라우트로 navigate, `Publish`에 player 전달.
- `Header.test.tsx` / `WsTopBar.test.tsx`: View 버튼·share 팝오버 부재, Share 단일 버튼 → `onShare`,
  Back → `onExit`.
- `App.test.tsx`: edit에서 Share → `onShare(hash)` 호출(해시 `v1.` 프리픽스), 내부 view 전환 부재,
  legacyView(initialMode="view")는 기존대로 Viewer 렌더.
- `Publish.test.tsx`: 재생 토글(FakePlayer), Copy link 클립보드+피드백, 비로그인 시
  미리보기·Copy link 가능 + "Sign in to publish" 표시, 기존 게시·중복·에러 단언 유지.
- 골든 스냅샷(FakeAudioSink): 영향 없음 — 재생은 기존 player API 재사용, 스케줄링 비변경.

## 영향 범위 / 비변경 확인

- 변경: `nav-items.ts`(신규), `TabBar.tsx`(신규), `MobileAppBar.tsx`(신규), `AppBar.tsx`,
  `Sidebar.tsx`, `Root.tsx`, `Publish.tsx`, `App.tsx`, `Header.tsx`, `WsTopBar.tsx`,
  `CommunityHeader.tsx`(삭제) + 해당 테스트, `community.css`(탭바·모바일 앱바 — 토큰 변수만 사용).
- 비변경: `routing.ts`, `Viewer.tsx`, `codec`/`core`/`engine`, `licks.ts` API, `ScoreToolbar.tsx`,
  `melody-hash.ts`.
- 모바일 편집 화면 세로 공간: 셸을 씌우지 않으므로 영향 없음(몰입형 유지 결정의 근거).

## 게이트

`npm run typecheck && npm run lint && npm test && npm run check-smp` 전부 통과 후 커밋.
커밋은 논리 단위로 분리: (1) nav-items+렌더러, (2) Root 셸 교체, (3) 편집 상단 바 정리,
(4) Share 화면 통합, (5) View 모드 제거.
