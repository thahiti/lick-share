# 태블릿 적응형 레이아웃 (640–1023px) — 설계

- 작성일: 2026-07-14
- 상태: 승인 대기
- 관련: `2026-07-13-editor-workspace-design.md` (데스크톱 ≥1024px Workspace — 불변),
  `2026-07-12-desktop-responsive-design.md` (브레이크포인트 1024px 통일),
  DESIGN.md §7 (앱 셸 레이아웃 — "모바일(<1024px)은 원칙 그대로" 문장 갱신 대상)

## 1. 배경과 목표

모바일 편집 화면(`App.tsx`의 비-desktop 분기)은 `--app-max-width: 420px`로 캡되어
중앙 정렬된다. iPad 세로(768px) 같은 태블릿 폭에서도 폰 폭 컬럼으로 렌더되어 좌우 회색
여백이 크고, Position·Length 스테퍼가 2줄로 쌓여 세로를 낭비하며, 컨트롤이 상단에
몰리고 하단에 세로 여백이 남는다.

**640–1023px 태블릿 티어**를 모바일 트리 안에 CSS만으로 추가해, 넓어진 폭을 활용하고
세로 여백을 제거한다. `App.tsx`의 레이아웃 분기(`min-width: 1024px` → Workspace)와
컴포넌트 구조는 건드리지 않는다.

## 2. 범위

### 포함
- `global.css`에 태블릿 티어 미디어 쿼리 `@media (min-width: 640px) and (max-width: 1023px)` 추가
- 컨테이너 폭 확장: `.app`의 `--app-max-width`를 680px로 오버라이드 (열람 모드와 일치)
- 스테퍼 1줄 가로화: `.hsteppers { flex-direction: row }` → Pitch·Position·Length 한 줄
- 세로 채움(도킹): `.pane-score`를 flex-grow시켜 편집 컨트롤 묶음을 화면 하단으로 도킹,
  오선보 SVG는 커진 캔버스 안에서 세로 중앙 정렬
- iOS 세이프 에어리어: 하단 도킹으로 물리적 최하단에 붙는 `.button-bar`에
  `env(safe-area-inset-bottom)` 패딩 적용 (홈 인디케이터 회피)
- DESIGN.md §7 갱신: 태블릿 티어 동작 명시

### 제외 (YAGNI — 의도적)
- Position/Length를 탭·컨텍스트 시트로 접기 (SPEC §3.7 스테퍼 3종 상시 노출 위배)
- Pad·Steppers 2컬럼 배치 (시각 모델 변경 → App.tsx 구조 변경 필요)
- iPad 가로(≥1024px) Workspace의 터치 타깃(버튼 최소 44px) 점검 — **별도 후속 과제**
- 폰(<640px) 도킹 동작 변경 (현재 스택 유지)
- 컨테이너 쿼리 도입 (기존 컨벤션은 `useMediaQuery` + 미디어 쿼리, KISS)

## 3. 불변 조건

- `App.tsx`의 레이아웃 분기·컴포넌트 트리·스토어 배선 변경 없음 (순수 CSS + 문서만).
- 폰(<640px)·데스크톱(≥1024px)·열람·커뮤니티 렌더 회귀 없음.
- 색상은 tokens.css 변수만 사용. 하드코딩 색상 금지.
- 조판/레이아웃 수치(LAYOUT)는 core constants 유지 — 본 작업은 CSS 브레이크포인트·
  컨테이너 폭만 다루며 LAYOUT 상수를 건드리지 않는다.
- SMP 유니코드 음악 기호 금지 (해당 없음 — 본 작업은 CSS/문서만).
- 게이트 4종(`typecheck && lint && test && check-smp`) 통과.

## 4. 상세 설계

### 4.1 브레이크포인트

기존 분기는 그대로다. `App.tsx:61`의 `useMediaQuery('(min-width: 1024px)')`가
데스크톱 Workspace 여부를 결정한다. 태블릿 티어는 그 아래(모바일 트리)에서만 적용되는
**순수 CSS 하위 구간**이므로 JS 변경이 없다.

```css
@media (min-width: 640px) and (max-width: 1023px) {
  /* 4.2 ~ 4.4 규칙 */
}
```

하한 640px은 큰 폰(예: 430px 논리폭)을 제외하고 소형 태블릿부터 포함하도록 잡는다.
상한 1023px은 Workspace 분기(1024px)와 정확히 맞물린다.

### 4.2 컨테이너 폭 680px

`--app-max-width`(tokens.css `:root`에서 420px)를 티어 안에서 `.app`에 재정의한다.
`.app`은 `max-width: var(--app-max-width)`로 이 값을 사용 시점에 읽으므로 로컬
오버라이드가 그대로 적용된다. 값 680px은 열람 모드(`.app--view` 680px)와 일치해
뷰↔편집 전환 시 컬럼 폭이 유지된다.

```css
.app { --app-max-width: 680px; }
```

### 4.3 스테퍼 1줄 가로화

`.steppers`는 이미 `[.stepper.vert (Pitch, width:96px) | .hsteppers (flex:1)]`
가로 flex다. `.hsteppers`만 세로→가로로 바꾸면 Position·Length가 좌우로 펴져
Pitch와 함께 한 줄이 된다. Steppers.tsx 컴포넌트 수정 없음.

```css
.hsteppers { flex-direction: row; }
```

`.stepper.horiz`는 이미 `flex: 1`이라 남는 폭을 균등 분배한다. 좌우 버튼 고정폭
(`flex: 0 0 72px`)은 유지되어 라벨 길이에 따라 폭이 흔들리지 않는다.

### 4.4 세로 채움 — 오선보 캔버스 도킹

`.app`은 `min-height: 100dvh` 세로 flex 컬럼이고, 자식 `.pane-score`·`.pane-edit`는
현재 flex-grow가 없어 콘텐츠 높이로만 잡힌다. 태블릿 세로처럼 뷰포트가 콘텐츠보다
높으면 `.button-bar` 아래에 세로 여백이 남는다.

편집 모드 Score는 **한 줄짜리 고정 종횡비 SVG**다(`Score.tsx`: `height = 1*LH + 8`,
`viewBox` + `width="100%"`, 높이 미지정). 따라서 `.pane-score`를 flex-grow해도
오선보가 세로로 늘어나지 않는다(늘리면 기보 왜곡). 대신 **캔버스 영역이 커지고
`.pane-edit`(코드행·패드·스테퍼·버튼바 묶음)가 화면 하단으로 도킹**되며, 오선보 SVG는
커진 캔버스 안에서 세로 중앙에 놓인다.

```css
.pane-score {
  flex: 1 1 auto;
  justify-content: center;  /* 세로 flex 컬럼 → 오선보를 캔버스 세로 중앙에 */
}
```

`.pane-score`는 이미 `display: flex; flex-direction: column`(global.css:29-34)이므로
`justify-content: center`가 SVG를 세로 중앙 정렬한다. `.pane-edit`는 grow하지 않으므로
콘텐츠 높이를 유지한 채 하단에 도킹된다.

### 4.5 세이프 에어리어

4.4의 도킹으로 `.button-bar`가 뷰포트 물리적 최하단에 붙는다. iOS 홈 인디케이터를
피하도록 하단 인셋만큼 패딩을 준다. `.button-bar`는 흰 배경이므로 인셋 영역도 흰색으로
자연스럽게 채워진다.

```css
.button-bar { padding-bottom: env(safe-area-inset-bottom); }
```

이 규칙은 티어 안에 두어 폰·데스크톱 동작에 영향을 주지 않는다.

## 5. 문서 갱신 (DESIGN.md §7 레이아웃)

현재 §7 레이아웃(line 107의 데스크톱/모바일 문장)은 "모바일(<1024px)은 본 문서 원칙
그대로"라고 규정한다.
문서 우선순위 규칙(DESIGN.md는 스타일 근거)과 어긋나지 않도록, 640–1023px 태블릿 티어
동작(컨테이너 680px, 스테퍼 1줄, 오선보 캔버스 도킹 + 세이프 에어리어)을 한 문장으로
명시한다. `<640px`은 기존 스택 유지, `≥1024px`은 Workspace 유지임을 함께 못박는다.

## 6. 테스트 전략

순수 CSS + 문서 변경이라 신규 단위 테스트 대상 로직은 없다. 회귀 방지는 기존 게이트로
담보한다.

- `npm run typecheck && npm run lint && npm test && npm run check-smp` 통과 확인
  (App.test.tsx 등 기존 렌더 테스트가 컴포넌트 트리 불변을 검증)
- 수동 확인: 브라우저 반응형 모드에서 639/640/1023/1024px 경계 렌더 육안 점검
  (420px 캡 → 680px 전환, 스테퍼 1↔2줄, 하단 여백 제거, 세이프 에어리어)

## 7. 구현 순서 (원자적 커밋)

1. 태블릿 티어 미디어 쿼리 + 컨테이너 680px (4.1, 4.2)
2. 스테퍼 1줄 가로화 (4.3)
3. 오선보 캔버스 도킹 + 세이프 에어리어 (4.4, 4.5)
4. DESIGN.md §7 갱신 (5)

각 커밋 후 게이트 통과 유지. 메시지는 프로젝트 컨벤션(`feat`/`docs`, scope) 준수.
