# 모바일 유동 패드 + 태블릿 티어 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모바일 편집 화면에서 남는 세로 공간을 피아노롤이 흡수하게 하고(전 모바일 폭), 640–1023px 태블릿 티어에 컨테이너 680px + 스테퍼 1줄을 추가한다.

**Architecture:** 순수 CSS 변경. `.app`(100dvh flex 컬럼) 아래 `.pane-edit`→`.pad`→`.pad-scroll`로 flex-grow 체인을 만들어 고정 156px 패드를 유동화하고, 태블릿 구간은 미디어 쿼리 하나로 폭·스테퍼만 오버라이드한다. JS·컴포넌트 변경 없음.

**Tech Stack:** CSS (src/styles/global.css), HTML meta (index.html), 문서 (docs/DESIGN.md)

**Spec:** docs/superpowers/specs/2026-07-14-tablet-adaptive-layout-design.md

## Global Constraints

- `App.tsx` 분기·컴포넌트 트리·스토어 배선 변경 금지 (순수 CSS + 문서만)
- 악보·코드행·패드의 기존 가로 정렬 불변 (좌우 패딩·마진·라벨 폭 28px 유지)
- Pad 행 높이 17px·셀 규격 불변 — 유동화 대상은 `.pad-scroll` 가시 높이뿐
- `.pad-scroll`에 `min-height: 156px` 유지 (짧은 뷰포트 하한 = 기존 동작)
- 색상은 tokens.css 변수만. SMP 유니코드(U+1D100–U+1D1FF) 금지
- 게이트: `npm run typecheck && npm run lint && npm test && npm run check-smp` 커밋 전 전부 통과
- 데스크톱(≥1024px) Workspace·열람 모드 렌더 회귀 없음

---

### Task 1: 유동 패드 flex 체인 + 세이프 에어리어

**Files:**
- Modify: `index.html` (viewport meta)
- Modify: `src/styles/global.css` — `.pane-edit`(≈29행 공유 블록은 건드리지 않고 새 규칙 추가), `.pad`(≈150행), `.pad-scroll`(≈172행), `.button-bar`(≈490행)

**Interfaces:**
- Consumes: 기존 `.app { min-height: 100dvh; display: flex; flex-direction: column }` (global.css 19–26행)
- Produces: 유동 패드 레이아웃 — Task 2의 태블릿 티어가 이 위에 얹힌다

- [ ] **Step 1: viewport-fit=cover 추가** — `env(safe-area-inset-bottom)`이 0이 아니려면 필요

`index.html`의 viewport meta를 다음으로 교체:

```html
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
    />
```

- [ ] **Step 2: flex 체인 CSS 추가**

`src/styles/global.css`의 공유 블록(`.pane-score, .pane-edit { ... }`) 바로 아래에 추가 (공유 블록 자체는 수정 금지 — `.pane-score`는 grow하면 안 됨):

```css
/* 유동 패드 (fluid-pad-tablet-tier 스펙 §4.1) — 남는 세로 공간을 패드가 흡수.
   DESIGN §7의 "6버튼줄 flex 하단 고정" 의도 복원. */
.pane-edit {
  flex: 1 1 auto;
}
```

`.pad` 규칙(≈150행)에 두 줄 추가 (기존 선언 유지):

```css
.pad {
  border: 1px solid var(--ink);
  border-radius: var(--radius-pad);
  padding: 8px;
  margin: 0 8px;
  background: var(--bg-pad-zone);
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
}
```

`.pad-scroll` 규칙(≈172행)을 다음으로 교체 (고정 156px → 유동, 하한 156px):

```css
.pad-scroll {
  flex: 1 1 auto;
  min-height: 156px;
  height: auto;
  overflow-y: auto;
}
```

`.button-bar` 규칙(≈490행)에 한 줄 추가:

```css
.button-bar {
  display: flex;
  background: #fff;
  border-top: 2px solid var(--ink);
  padding-bottom: env(safe-area-inset-bottom);
}
```

- [ ] **Step 3: 게이트 실행**

Run: `npm run typecheck && npm run lint && npm test && npm run check-smp`
Expected: 전부 통과 (CSS만 변경이라 기존 테스트 영향 없음)

- [ ] **Step 4: 실행 검증 — 폰 해상도**

```bash
npm run dev &   # 서버 기동 대기 후
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --window-size=390,844 --screenshot=/tmp/verify-phone.png "http://localhost:5173"
```

스크린샷 확인 항목: ① 버튼바가 뷰포트 최하단에 밀착(아래 여백 0) ② 패드 가시 행이 기존(~6행)보다 증가 ③ 행 높이는 17px 그대로(셀이 세로로 늘어나지 않음) ④ 악보·코드행·패드 가로 정렬 기존과 동일.

- [ ] **Step 5: Commit**

```bash
git add index.html src/styles/global.css
git commit -m "feat(layout): let pad absorb leftover height on mobile edit"
```

---

### Task 2: 태블릿 티어 (640–1023px) — 컨테이너 680px + 스테퍼 1줄

**Files:**
- Modify: `src/styles/global.css` — 파일 하단 데스크톱 미디어 쿼리(`@media (min-width: 1024px)`, ≈642행) 앞에 신규 블록 추가

**Interfaces:**
- Consumes: Task 1의 유동 패드 (전 모바일 폭 공통이므로 티어에서도 그대로 동작)
- Produces: 최종 반응형 3밴드 — <640 폰 / 640–1023 태블릿 / ≥1024 Workspace(기존)

- [ ] **Step 1: 티어 미디어 쿼리 추가**

`@media (min-width: 1024px)` 블록 바로 위에 추가:

```css
/* ── 태블릿 티어 (640–1023px, fluid-pad-tablet-tier 스펙 §4.3–4.4) ──
   컨테이너를 열람 모드와 같은 680px로 넓히고 스테퍼를 한 줄로 편다.
   상한 1023px은 Workspace 분기(App.tsx의 min-width:1024px)와 맞물린다. */
@media (min-width: 640px) and (max-width: 1023px) {
  .app {
    --app-max-width: 680px;
  }

  .hsteppers {
    flex-direction: row;
  }
}
```

- [ ] **Step 2: 게이트 실행**

Run: `npm run typecheck && npm run lint && npm test && npm run check-smp`
Expected: 전부 통과

- [ ] **Step 3: 실행 검증 — 태블릿·경계 해상도**

```bash
for size in 768,1024 639,900 640,900 1023,760 1024,760; do
  w=${size%,*}; h=${size#*,}
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
    --window-size=$w,$h --screenshot=/tmp/verify-$w.png "http://localhost:5173"
done
```

확인 항목: ① 768px — 컬럼 680px·스테퍼 1줄(Pitch·Position·Length)·패드 행 증가
② 639px — 420px 캡·스테퍼 2줄(기존) ③ 640px — 티어 진입 ④ 1023px — 아직 모바일 트리
⑤ 1024px — Workspace 전환(기존과 무변화).

- [ ] **Step 4: Commit**

```bash
git add src/styles/global.css
git commit -m "feat(layout): add tablet tier width and one-row steppers"
```

---

### Task 3: DESIGN.md §7 레이아웃 갱신

**Files:**
- Modify: `docs/DESIGN.md` §7 (≈103–107행)

**Interfaces:**
- Consumes: Task 1–2의 확정 동작
- Produces: 문서-코드 일치 (CLAUDE.md 문서 우선순위 규칙 준수)

- [ ] **Step 1: §7 목록 갱신**

"앱 최대폭 420px 중앙 정렬" 항목과 "세로 흐름" 항목을 다음으로 교체:

```markdown
- 앱 최대폭: 기본(폰 <640px) 420px, 태블릿(640–1023px) 680px(열람 컬럼과 동일) — 중앙 정렬, 흰 배경, 바깥 #f0f0f0.
- 세로 흐름: 헤더(고정 높이) → 악보(내용 높이) → 패드 존(#fafafa, **남는 세로 공간 흡수** — .pad-scroll flex 유동, 하한 156px, 행 높이 17px 불변) → 스테퍼 존(#f5f5f5, 태블릿에서는 Pitch·Position·Length 1줄 가로) → 6버튼줄(하단 도킹 + env(safe-area-inset-bottom)).
```

- [ ] **Step 2: 게이트 실행 후 커밋**

Run: `npm run typecheck && npm run lint && npm test && npm run check-smp`
Expected: 전부 통과

```bash
git add docs/DESIGN.md
git commit -m "docs(design): document fluid pad and tablet tier in layout"
```
