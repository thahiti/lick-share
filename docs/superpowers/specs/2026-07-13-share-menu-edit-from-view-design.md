# 공유 메뉴 + 열람 화면에서 편집 이동 — 설계

- 날짜: 2026-07-13
- 상태: 승인됨 (구현 대기)
- 범위: 편집기 Share 버튼을 팝오버(Publish / Copy link)로 확장, 커뮤니티 릭 상세에 "편집으로 이동" 추가

## 배경

두 가지 사용자 요구:

1. **Create(편집) 화면**에서 Share 버튼을 누르면 링크 복사뿐 아니라 게시(Publish)도 고를 수 있어야 한다. 현재 Share는 `copyShare` 하나만 실행한다(`?mode=view#hash` 링크 복사 + 토스트).
2. **악보 열람 화면**(커뮤니티 릭 상세, `/lick/:id`)에서 해당 악보를 수정할 수 있는 화면으로 이동할 수 있어야 한다. 현재 상세 화면에는 편집 진입 경로가 없다(레거시 Viewer에만 "Duplicate & edit"가 존재).

## 기능 1 — Create 화면의 공유 메뉴

Share 버튼을 단일 액션에서 작은 팝오버로 바꾼다. `Header`/`DawTopBar`에 이미 있는 팝오버 패턴(`tempoPop`, `accPop`)과 `.popover` 스타일을 그대로 재사용한다.

### 컴포넌트 변경

- **`src/ui/components/edit/Header.tsx`**, **`src/ui/components/edit/daw/DawTopBar.tsx`**
  - prop `onShare: () => void` → `onPublish: () => void`, `onCopyLink: () => void` 두 개로 교체.
  - 로컬 `sharePop: boolean` 상태 추가. Share 버튼(`data-btn="share"`)이 `sharePop`을 토글.
  - `.popover share-pop` 렌더: **Publish**, **Copy link** 두 버튼. 하나를 누르면 팝오버를 닫고 해당 콜백 실행.
  - 팝오버 버튼 식별자: `data-share="publish"`, `data-share="copy"` (테스트·일관성).

- **`src/ui/components/edit/daw/DawEdit.tsx`**
  - `onShare` prop을 `onPublish`, `onCopyLink`로 교체하고 `DawTopBar`에 그대로 전달.

- **`src/ui/components/App.tsx`**
  - `onCopyLink`는 기존 `copyShare` 그대로 연결.
  - `onPublish`는 새 옵셔널 prop `onPublish?: (hash: string) => void`를 `encodeSong(store.getState().song)`으로 호출.
  - `AppProps`에 `readonly onPublish?: (hash: string) => void` 추가.
  - 모바일(`Header`)·데스크톱(`DawEdit`) 두 경로 모두에 `onPublish`/`onCopyLink` 전달.

- **`src/community/Root.tsx`**
  - `edit` 라우트에서 `App`에 `onPublish={(hash) => navigate('/publish#' + hash)}` 주입.

### 게시 흐름 재사용

기존 `Publish` 뷰(`src/community/views/Publish.tsx`)는 마운트 시 `initialInput()`으로 `window.location.hash`(`#v1.…`)를 읽어 입력을 프리필한다. `navigate('/publish#' + hash)`로 이동하면 그대로 프리필되어 미리보기·멜로디 해시·중복 판정·로그인 게이트를 전부 재사용한다. `Publish` 뷰 자체는 **변경 없음**.

### 레이어 경계 결정

네비게이션이 `ui`(App)에서 `community`(routing)로 넘어간다. 레이어 규칙상 `ui → community` 의존은 금지다. 따라서:

- **채택**: `Root`(community 레이어)가 네비게이션 콜백을 `App`에 주입한다. `ui`는 community를 알지 못한 채 콜백만 호출한다.
- **기각 A**: `App`이 community `navigate`를 직접 import → 의존 화살표 위반.
- **기각 B**: 편집기에서 다이얼로그로 인라인 게시(supabase 직접 호출) → Publish의 멜로디 해시·중복 판정·미리보기를 중복 구현. YAGNI/DRY 위반.

## 기능 2 — 커뮤니티 릭 상세의 "Duplicate & edit"

- **`src/community/views/LickDetail.tsx`**
  - 액션 행(`.c-row`, Play all / Like 근처)에 버튼 추가: 문구 **"Duplicate & edit"**(레거시 Viewer와 동일 표현).
  - onClick → `navigate('/edit#' + lick.blob)`. `lick.blob`은 `v1.…` 해시 문자열.
  - Root가 `/edit`로 `App`을 마운트 → App 초기화 이펙트가 `hashStore.read()`(= `window.location.hash`)를 디코드해 곡을 로드.
  - 음표 탭(`onNoteTap`, 탭 지점부터 재생)은 **변경 없음** — 편집 진입은 별도 버튼으로만.

### 문구 근거

커뮤니티에는 인플레이스 수정(업데이트) 흐름이 없다. 편집 후 재게시 시 멜로디 해시로 판정되어, 멜로디가 그대로면 중복으로 걸리고 바뀌면 새 릭이 된다. 즉 "원본 복제 후 편집"이 정확한 의미이므로 Viewer의 "Duplicate & edit"와 문구를 통일한다.

## 테스트 (TDD — 먼저 작성)

- **`src/ui/components/edit/Header.test.tsx`**
  - Share 클릭 → 팝오버 노출(`data-share="publish"`, `data-share="copy"`).
  - `data-share="publish"` 클릭 → `onPublish` 호출, 팝오버 닫힘.
  - `data-share="copy"` 클릭 → `onCopyLink` 호출, 팝오버 닫힘.
  - 기존 `onShare` mock(14번째 줄) 및 클릭 단언(82~83번째 줄)을 새 두 콜백 형태로 교체.

- **`src/ui/components/App.test.tsx`**
  - 기존 공유 테스트(231~240번째 줄): Share → **Copy link** 클릭 후 클립보드/해시/토스트 단언 유지.
  - 신규: Share → **Publish** 클릭 시 `onPublish` prop이 `v1.`로 시작하는 해시로 호출됨.

- **`src/ui/components/edit/daw/DawTopBar.test.tsx`** (없으면 신규, 있으면 확장)
  - Share 팝오버가 Publish/Copy link를 노출하고 각 콜백을 호출.

- **`src/community/views/LickDetail.test.tsx`**
  - **Duplicate & edit** 클릭 → `navigate`가 `/edit#` + 해당 릭 `blob`으로 호출.

## 영향 범위 / 비변경 확인

- 변경: `Header.tsx`, `DawTopBar.tsx`, `DawEdit.tsx`, `App.tsx`, `Root.tsx`, `LickDetail.tsx` + 해당 테스트, 필요한 CSS(`.share-pop`은 기존 `.popover` 규칙 재사용, 별도 하드코딩 색상 금지).
- 비변경: `Publish.tsx`(프리필 흐름 그대로), `Viewer.tsx`(이미 Duplicate & edit 보유), 코덱/코어/라우팅 파서.
- URL 해시 하위 호환(`v1.…`) 유지 — 새 경로는 `pathname#hash` 조합만 사용하고 해시 포맷은 건드리지 않는다.

## 게이트

`npm run typecheck && npm run lint && npm test && npm run check-smp` 전부 통과 후 커밋. 커밋 단위는 논리 단위(기능 1 / 기능 2)로 분리.
