# ScoreLink 데스크톱 반응형 설계 (P11)

작성일: 2026-07-12

## 1. 배경과 목표

ScoreLink는 모바일 우선으로 설계되어 `.app`이 `max-width:420px` 고정 컬럼으로
화면 중앙에 놓인다(DESIGN.md §7). PC 브라우저에서는 양옆이 전부 회색 여백이 되어
넓은 화면을 활용하지 못하고, 터치 전제라 마우스·키보드 조작 지원이 없다.

이 설계는 **모바일 경험을 그대로 유지**하면서 데스크톱(넓은 뷰포트)에서:

1. 넓은 화면을 실제로 활용하는 **좌우 2패널 편집 레이아웃**을 제공하고,
2. **풀 키보드 단축키**(화살표 + Vim hjkl)로 손만으로 편집 가능하게 하며,
3. 마우스 **호버·포커스 피드백**과 **여백 확대**로 데스크톱 가독성을 높인다.

## 2. 범위

### 포함
- 편집 화면의 데스크톱 2패널 레이아웃 (뷰포트 ≥ 900px)
- 열람(view) 화면의 데스크톱 중앙 넓은 컬럼
- 전역 키보드 단축키 훅 (화살표 + Vim hjkl + 편집/재생/실행취소)
- 데스크톱 호버·포커스 상태 및 여백 확대 CSS
- 악보 폭 측정 대상을 악보 pane으로 이전 (ResizeObserver)
- DESIGN.md §7 데스크톱 규격 추가

### 제외 (YAGNI)
- 컨트롤 px 크기 확대 (디자인 시스템 규격 유지, **여백만** 확대)
- 오디오/스케줄/코덱/조판 알고리즘 변경 (전혀 손대지 않음)
- 반응형 이미지·아이콘 리소스 추가
- 커스텀 단축키 설정 UI

## 3. 불변 조건 (반드시 지킬 것)

- **모바일(<900px) 회귀 없음**: DOM 구조를 바꾸되, 좁은 뷰포트에서의 렌더 순서·
  모양·수치는 현재와 동일해야 한다.
- **디자인 토큰 불변**: 색·폰트·컨트롤 px는 그대로. 데스크톱에서 바뀌는 것은
  `padding`/`gap`/레이아웃 배치와 `:hover`/`:focus-visible` 상태뿐이다.
- **레이어 규칙 유지**: 키보드 훅은 ui 레이어에만 둔다(window/DOM 사용 허용).
  core/engine/ports/adapters는 손대지 않는다.
- **오디오·골든 스냅샷 무영향**: 키보드는 기존 스토어 액션만 호출한다. FakeAudioSink
  로그와 golden 스냅샷은 변경되지 않아야 한다.
- **SMP 기호 미사용**: 신규 텍스트/아이콘에 U+1D100~U+1D1FF 금지.
- **게이트 통과**: `npm run typecheck && npm run lint && npm test && npm run check-smp`.

## 4. 레이아웃 구조

### 4.1 DOM 재구성 (App.tsx)

현재 `.app`의 직속 자식들을 두 개의 pane으로 묶는다. 구조는 **뷰포트와 무관하게
항상 동일**하며, 표시 방식만 CSS가 결정한다.

```
편집 모드:
.app
├─ .pane-score            → <Header> + <Score>
└─ .pane-edit             → <ChordRow> + (<ChordPicker>) + <Pad>
                            + <MeasureBar> + <Steppers> + <ButtonBar>

열람 모드:
.app.app--view
└─ <Viewer>               (단일 컬럼, pane 분할 없음)
```

`Toast`는 `position:fixed`이므로 pane 밖 `.app` 직속에 그대로 둔다.

### 4.2 반응형 규칙 (CSS, global.css)

| 뷰포트 | `.app` | pane 배치 |
|---|---|---|
| `< 900px` (모바일/태블릿) | `max-width:420px`, 세로 컬럼 | 두 pane이 단순 블록으로 세로 스택 → 현재와 동일 순서 |
| `≥ 900px` (데스크톱) | `max-width:1120px`, `display:grid` | `grid-template-columns: 1fr 380px` (악보 유동 · 컨트롤 고정 380px) |

- 데스크톱에서 `.pane-score`는 `overflow-y:auto`로 악보만 독립 스크롤.
- 브레이크포인트 900px는 미디어쿼리 리터럴(주석으로 근거 표기). CSS `@media`는
  `var()`를 조건에 못 쓰므로 상수화하지 않는다.
- 열람 데스크톱: `.app--view`는 `max-width:680px` 중앙 정렬(2패널 아님).

### 4.3 악보 폭 측정 이전 (App.tsx)

현재 `shellRef`가 `.app` 전체 폭을 재어 `scoreW`로 전달한다. 2패널에서는 악보
실제 가용폭이 `.pane-score` 폭이므로:

- `shellRef` → `.pane-score`(편집) / `.app`(열람 — Viewer가 전체폭) 대상으로 측정.
- `window resize` 리스너를 `ResizeObserver`로 교체(레이아웃 그리드 전환·창 크기
  변화 모두 포착). 관측 대상이 없을 때의 폴백은 현행 값(384) 유지.
- `scoreW`는 모바일=전체폭, 데스크톱=좌패널 폭으로 자동 반영되어 Score/Viewer의
  조판이 폭에 맞춰 재계산된다(기존 SPEC §8 동작 그대로).

## 5. 데스크톱 여백·피드백 (CSS)

### 5.1 여백 확대 (`@media (min-width:900px)`)
컨트롤 px는 유지하고 아래만 키운다.
- `.pane-edit` 좌우 `padding` 부여(예: 12px)로 컨트롤이 벽에 붙지 않게.
- `.chord-row`, `.pad`, `.steppers`의 `gap`/`padding`을 소폭 상향.
- 정확한 수치는 구현 시 시각 확인 후 확정하되, 컨트롤 자체 px·색은 불변.

### 5.2 마우스 호버·포커스
현재는 `:active`만 존재한다. 데스크톱 포인터용으로 추가:
- 버튼류(`.icon-btn`, `.chip`, `.button-bar .bb`, `.measure-bar button`,
  `.stepper button`, `.chord-pick button`)에 `:hover` 은은한 배경.
- 패드 셀(`.pcell`), 코드 슬롯(`.cslot`)에 `:hover` 배경/커서.
- 키보드 접근성용 `:focus-visible` 아웃라인(레드 계열, 디자인 토큰 사용).
- 호버는 `@media (hover:hover)`로 감싸 터치 기기에서 stuck-hover 방지.

## 6. 키보드 단축키

### 6.1 위치
신규 훅 `src/ui/hooks/useKeyboardShortcuts.ts` (ui 레이어). App.tsx에서 편집 모드일
때 활성화. 핸들러 맵을 인자로 받는 순수한 등록/해제 훅으로 설계해 단위테스트 가능.

### 6.2 가드
- `document.activeElement`가 `<input>`/`<textarea>`/`contentEditable`이면 무시
  (템포 입력·제목 편집 중 오작동 방지).
- IME 조합 중(`event.isComposing`) 무시.
- 스크롤/기본동작 유발 키(`Space`, 화살표)는 매핑 성립 시 `preventDefault`.

### 6.3 매핑 (화살표 = Vim hjkl 동일 동작)

| 키 | Vim | 동작 | 스토어 액션 |
|---|---|---|---|
| `←` | `h` | 이전 음 선택 | `selectDir(-1)` |
| `→` | `l` | 다음 음 선택 | `selectDir(+1)` |
| `↑` | `k` | 음높이 ↑ | `stepPitch(+1)` |
| `↓` | `j` | 음높이 ↓ | `stepPitch(-1)` |
| `Shift+←` | `Shift+h` (`H`) | 위치 앞으로 | `stepPos(-1)` |
| `Shift+→` | `Shift+l` (`L`) | 위치 뒤로 | `stepPos(+1)` |
| `Shift+↑` | `Shift+k` (`K`) | 길이 늘림 | `stepLen(+1)` |
| `Shift+↓` | `Shift+j` (`J`) | 길이 줄임 | `stepLen(-1)` |
| `Space` | — | 전체 재생/정지 | `togglePlay` |
| `Enter` | — | 현재 마디 재생 | `playMeasure` |
| `Delete`/`Backspace` | — | 선택 삭제 | `deleteSel` |
| `[` | — | 이전 마디 | `measurePrev` |
| `]` | — | 다음 마디 | `measureNext` |
| `Cmd/Ctrl+Z` | — | 실행취소 | `undoAction` |
| `Cmd/Ctrl+Shift+Z` | — | 재실행 | `redoAction` |
| `Esc` | — | 코드 피커 닫기 | `setCpBeat(null)` |

설계 근거:
- 선택은 선형(음렬)이라 세로 선택 개념이 없다. 그래서 `↑↓`/`kj`는 선택이 아니라
  **음높이**에 배정한다. Vim의 j=아래=음높이↓, k=위=음높이↑로 방향 직관과 일치.
- Vim 키는 `event.key`의 소문자/대문자로 Shift를 판별한다(`h`/`H`).
- `Space`는 전역 재생 토글이 스크롤보다 우선(편집 모드 한정).

## 7. 열람(view) 화면

구조·컴포넌트 변경 없음. `.app--view` 수정자만 추가해 데스크톱에서
`max-width:680px` 중앙 정렬 + 악보를 넓게 렌더(폭은 §4.3 측정으로 자동 반영).
키보드 훅은 편집 모드 전용이므로 열람에는 적용하지 않는다.

## 8. 컴포넌트/파일 영향

| 파일 | 변경 |
|---|---|
| `index.html` | (선택) viewport `maximum-scale` 접근성 검토 — 기본은 현행 유지 |
| `src/ui/components/App.tsx` | pane 래핑, ref 이전(ResizeObserver), 키보드 훅 연결, `.app--view` 클래스 |
| `src/ui/hooks/useKeyboardShortcuts.ts` | 신규 — 전역 keydown 등록/해제 + 매핑 |
| `src/styles/global.css` | `.pane-*` 레이아웃, 데스크톱 미디어쿼리, 호버/포커스 |
| `docs/DESIGN.md` | §7에 데스크톱 브레이크포인트·2패널 규격 추가 |

core/engine/ports/adapters 및 오디오·조판 코드는 **불변**.

## 9. 테스트 전략

- **키보드 훅 단위테스트** (`useKeyboardShortcuts.test.ts`):
  - 각 키/Vim 등가/Shift 조합이 올바른 핸들러를 호출하는지.
  - `<input>` 포커스·IME 조합 중 무시되는지.
  - `Space`/화살표에서 `preventDefault` 호출되는지.
  - 언마운트 시 리스너 해제되는지.
- **App 구조 테스트**: 편집 모드에서 `.pane-score`/`.pane-edit`가 함께 존재하고
  자식 컴포넌트가 올바른 pane에 속하는지(뷰포트 무관, DOM 존재 검증).
- **CSS 미디어쿼리**는 jsdom에서 검증 불가 → 수동 확인(모바일 회귀·데스크톱 2패널·
  열람 컬럼)을 e2e 체크리스트에 항목으로 추가.
- 기존 테스트·golden 스냅샷은 그대로 통과해야 한다(오디오·조판 무영향).

## 10. 완료 정의 (DoD)

1. `< 900px`에서 렌더가 현재와 시각적으로 동일(회귀 없음).
2. `≥ 900px` 편집 화면이 좌 악보 / 우 380px 컨트롤 2패널로 표시.
3. 데스크톱 열람 화면이 중앙 680px 컬럼으로 표시.
4. 표의 모든 키보드 단축키(화살표 + hjkl + 편집/재생/실행취소)가 동작.
5. 버튼·셀·슬롯에 호버/포커스 피드백 존재.
6. 게이트 4종 전부 통과, golden 스냅샷 불변.
7. DESIGN.md §7에 데스크톱 규격 반영.
