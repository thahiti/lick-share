# 모바일 유동 패드 + 태블릿 티어 (640–1023px) — 설계

- 작성일: 2026-07-14 (v2 — 시안 검토로 방향 확정: "패드 확장" 안 채택, 전 모바일 해상도 적용)
- 상태: 승인됨 (시안 통과)
- 관련: `2026-07-13-editor-workspace-design.md` (데스크톱 ≥1024px Workspace — 불변),
  `2026-07-12-desktop-responsive-design.md` (브레이크포인트 1024px 통일),
  DESIGN.md §7 (앱 셸 레이아웃 — "모바일(<1024px)은 원칙 그대로" 문장 갱신 대상)

## 1. 배경과 목표

모바일 편집 화면(`App.tsx`의 비-desktop 분기)은 두 가지 레이아웃 문제가 있다.

1. 콘텐츠가 화면보다 짧을 때(폰 세로·태블릿 세로) 버튼바 아래에 죽은 세로 여백이 남는다.
2. `--app-max-width: 420px` 캡 때문에 태블릿(768px 등)에서도 폰 폭 컬럼으로 렌더되어
   좌우 여백이 크고, Position·Length 스테퍼가 2줄로 쌓여 세로를 낭비한다.

시안 3종(플로팅 카드 / 패드 확장 / 2컬럼) 비교 검토 결과 **"패드 확장" 안**이 채택되었다:
남는 세로 공간을 피아노롤(Pad)이 흡수해 여백이 편집 기능(가시 음역 확대)으로 바뀐다.
이 유동 패드 레이아웃은 **모바일 트리 전체(<1024px)에 적용**하고, 태블릿 구간(640–1023px)
에는 추가로 컨테이너 680px 확장 + 스테퍼 1줄 가로화를 얹는다. 전부 순수 CSS로 구현하며
`App.tsx`의 레이아웃 분기(`min-width: 1024px` → Workspace)와 컴포넌트 구조는 건드리지
않는다.

## 2. 범위

### 포함
- **유동 패드 (전 모바일 폭 공통, 미디어 쿼리 밖)**: 상단 악보(+코드행) / 중앙 유동
  피아노롤 / 하단 컨트롤(마디바·스테퍼·버튼바) 도킹. `.pad-scroll`의 고정 156px를
  flex-grow로 전환.
- **iOS 세이프 에어리어 (전 모바일 폭 공통)**: 하단 도킹으로 물리적 최하단에 붙는
  `.button-bar`에 `env(safe-area-inset-bottom)` 패딩.
- **태블릿 티어** `@media (min-width: 640px) and (max-width: 1023px)`:
  - 컨테이너 폭 확장 — `.app`의 `--app-max-width`를 680px로 오버라이드 (열람 모드와 일치)
  - 스테퍼 1줄 가로화 — `.hsteppers { flex-direction: row }` → Pitch·Position·Length 한 줄
- **DESIGN.md §7 갱신**: 유동 패드 + 태블릿 티어 동작 명시
- 검증: 게이트 4종 + 해상도별(390/640/768/1023/1024) 실행 화면 확인

### 제외 (YAGNI — 의도적)
- Pad 셀 크기 변경 — **행 높이 17px 고정 유지** (`.pad .prow`). 태블릿에서는 가시 행 수가
  늘어나는 것으로 공간을 채운다. 폭 비례 정사각 셀(aspect-ratio)은 채택하지 않음.
- 악보(Score)와 패드의 세로 컬럼 정렬 변경 — 현행 유지. 실제 앱에는 문제가 없음이
  확인되었고(시안 목업에서만 어긋났음), **기존 렌더를 깨지 않는 것**이 불변 조건이다.
- Position/Length를 탭·컨텍스트 시트로 접기 (SPEC §3.7 스테퍼 3종 상시 노출 위배)
- Pad·Steppers 2컬럼 배치 / 플로팅 카드 (시안 검토에서 기각)
- iPad 가로(≥1024px) Workspace의 터치 타깃(버튼 최소 44px) 점검 — 별도 후속 과제
- 컨테이너 쿼리 도입 (기존 컨벤션은 `useMediaQuery` + 미디어 쿼리, KISS)

## 3. 불변 조건

- `App.tsx`의 레이아웃 분기·컴포넌트 트리·스토어 배선 변경 없음 (순수 CSS + 문서만).
- 데스크톱(≥1024px) Workspace·열람·커뮤니티 렌더 회귀 없음.
- **악보·코드행·패드의 기존 가로 정렬 불변** — 좌우 패딩·마진·라벨 폭(28px 들여쓰기 등)을
  건드리지 않는다.
- Pad 행 높이(17px)·셀 규격 불변. 유동화되는 것은 `.pad-scroll`의 가시 높이뿐이다.
- 짧은 뷰포트(폰 가로 모드 등)에서 현행 이하로 좁아지지 않도록 `.pad-scroll`에
  `min-height: 156px` 유지 — 기존 스크롤 동작이 하한으로 보존된다.
- 색상은 tokens.css 변수만 사용. 조판 수치(LAYOUT)는 core constants 유지 — 본 작업은
  CSS만 다룬다. SMP 유니코드 금지 (해당 없음 — CSS/문서만).
- 게이트 4종(`typecheck && lint && test && check-smp`) 통과.

## 4. 상세 설계

### 4.1 유동 패드 — flex 체인 (전 모바일 폭 공통)

`.app`은 `min-height: 100dvh` 세로 flex 컬럼이다. 자식 `.pane-score`(악보)와
`.pane-edit`(코드행·패드·마디바·스테퍼·버튼바)에 flex-grow가 없어, 콘텐츠가 짧으면
버튼바 아래에 여백이 남는다. 다음 체인으로 Pad가 남는 높이를 전부 흡수하게 한다.

```css
/* 미디어 쿼리 밖 — 모든 모바일 폭 공통 */
.pane-edit { flex: 1 1 auto; }          /* 남는 높이를 편집 페인으로 */
.pad {                                   /* 그 높이를 패드 내부로 전달 */
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
}
.pad-scroll {                            /* 고정 156px → 유동 (하한 156px) */
  flex: 1 1 0;
  min-height: 156px;
}
```

`.pad-scroll`의 flex-basis는 반드시 **0**이어야 한다. 패드에는 전체 음역(~29행,
~500px)이 항상 DOM에 렌더되어 있으므로 basis가 auto면 콘텐츠 높이만큼 커져
페이지가 뷰포트를 넘친다. basis 0 + min-height 156px이어야 "남는 공간만큼만
성장, 부족하면 내부 스크롤"이 된다.

효과: 폰(844px 세로)에서 가시 행 ~6행 → ~2배 내외, 태블릿 세로(1024px)에서 그 이상.
행은 이미 DOM에 있고 스크롤로 가려져 있을 뿐이므로 드러나기만 한다. ChordPicker가
열리면(코드 슬롯 탭) flex가 자연스럽게 패드를 줄여 공간을 내준다. 콘텐츠가 뷰포트보다
길면 `min-height` 하한 덕에 기존과 동일하게 페이지가 스크롤된다.

### 4.2 세이프 에어리어 (전 모바일 폭 공통)

유동 패드로 `.button-bar`가 뷰포트 물리적 최하단에 붙는다. iOS 홈 인디케이터를 피하도록
하단 인셋 패딩을 준다. `env()`가 0이 아니려면 `index.html`의 viewport meta에
`viewport-fit=cover`가 필요하다 — 없으면 함께 추가한다.

```css
.button-bar { padding-bottom: env(safe-area-inset-bottom); }
```

### 4.3 태블릿 티어 — 컨테이너 680px

```css
@media (min-width: 640px) and (max-width: 1023px) {
  .app { --app-max-width: 680px; }
}
```

`.app`은 `max-width: var(--app-max-width)`로 사용 시점에 값을 읽으므로 로컬 오버라이드가
그대로 적용된다. 680px은 열람 모드(`.app--view`)와 일치해 뷰↔편집 전환 시 컬럼 폭이
유지된다. 하한 640px은 큰 폰을 제외하고 소형 태블릿부터, 상한 1023px은 Workspace
분기(1024px)와 정확히 맞물린다. Score는 `ResizeObserver`(`App.tsx`의 `scoreW`)로 폭을
읽으므로 넓어진 컨테이너에 자동 적응한다. Pad 셀도 `flex: 1`이라 자동으로 넓어진다.

### 4.4 태블릿 티어 — 스테퍼 1줄 가로화

```css
@media (min-width: 640px) and (max-width: 1023px) {
  .hsteppers { flex-direction: row; }
}
```

`.steppers`는 이미 `[.stepper.vert (Pitch) | .hsteppers]` 가로 flex라 이 한 줄로
Pitch·Position·Length가 한 줄이 된다. Steppers.tsx 수정 없음. `.stepper.horiz`의
`flex: 1` + 좌우 버튼 고정폭(72px)은 그대로 동작한다.

## 5. 문서 갱신 (DESIGN.md §7 레이아웃)

현재 §7은 "모바일(<1024px)은 본 문서 원칙 그대로"라고 규정한다. 다음을 명시하도록
갱신한다: 모바일 편집은 상단 악보 / 유동 피아노롤(남는 높이 흡수, 행 높이 17px 불변,
하한 156px) / 하단 컨트롤 도킹 + 세이프 에어리어이며, 640–1023px 태블릿 티어는 추가로
컨테이너 680px + 스테퍼 1줄. `<640px` 폰은 스테퍼 2줄 유지, `≥1024px`은 Workspace 유지.

## 6. 테스트 전략

순수 CSS + 문서 변경이라 신규 단위 테스트 대상 로직은 없다.

- 게이트: `npm run typecheck && npm run lint && npm test && npm run check-smp`
  (App.test.tsx 등 기존 렌더 테스트가 컴포넌트 트리 불변을 검증)
- 실행 검증: dev 서버 + 헤드리스 브라우저 스크린샷으로 390×844 / 768×1024 / 1024 이상
  각각 확인 — ① 버튼바 아래 여백 0 ② 패드 가시 행 증가(행 높이 17px 불변)
  ③ 태블릿 680px + 스테퍼 1줄 ④ 악보·코드행·패드 가로 정렬 기존과 동일
  ⑤ 1024px에서 Workspace 전환 무변화.

## 7. 구현 순서 (원자적 커밋)

1. 유동 패드 flex 체인 + 세이프 에어리어(viewport-fit 포함) (4.1, 4.2)
2. 태블릿 티어: 컨테이너 680px + 스테퍼 1줄 (4.3, 4.4)
3. DESIGN.md §7 갱신 (5)

각 커밋 후 게이트 통과 유지. 메시지는 프로젝트 컨벤션(`feat`/`docs`, scope) 준수.
