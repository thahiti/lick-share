# 토큰 리브랜드 + 커뮤니티 데스크톱 레이아웃 — 설계

- 작성일: 2026-07-13
- 상태: 승인됨 (구현 대기)
- 관련: `2026-07-12-community-design.md`(커뮤니티 기능·데이터), `2026-07-13-publish-tags-design.md`(tags 컬럼 — 병렬 진행 중),
  `2026-07-13-editor-workspace-design.md`(에디터 측 개편 — 본 문서의 토큰을 공유)

## 1. 배경과 목표

Swiss 모노(잉크+레드 포인트) 팔레트는 에디터 프로토타입에는 맞았지만, 커뮤니티 피드·랭킹이
추가되면서 "제품"으로서의 시각 아이덴티티가 부족해졌다. deep teal 브랜드 팔레트를 도입해
전역(모바일 포함) 색을 리브랜드하고, 데스크톱(≥1024px) 커뮤니티에 3컬럼 셸
(AppBar / Sidebar / 메인 / Top Licks 위젯)을 도입한다.

## 2. 범위

### 포함
- `src/styles/tokens.css` `:root` 브랜드 토큰 추가 + 기존 UI의 색 재배선 (전역 — 모바일 포함)
- 데스크톱(≥1024px) 커뮤니티 셸: AppBar · Sidebar · 2열 피드 그리드 · Top Licks 우측 패널
- 피드 정렬 pill "Latest"/"Popular" (Popular = 기존 ranking 데이터 정렬 재사용)
- 랭킹 페이지 순위 뱃지 (1~3위 amber 강조)
- 사이드바 인기 태그 섹션 (클라이언트 집계, 방어적 렌더)
- 카드 리디자인: 제목+날짜 / 작성자 / 악보 미리보기 / 액션 행(재생·하트)

### 제외 (후속 스펙으로 유보 — 의도적)
- **검색** — AppBar 검색창은 disabled placeholder + "Search coming soon" 툴팁만
- **조회수(눈 아이콘)·조옮김 C|Bb|Eb 선택** — 카드에 구현하지 않음
- **랭킹 기간 필터(주간/월간/전체)** — DB ranking view가 전체 기간뿐. Top Licks 위젯도 전체 기간
- 태그 칩 클릭(필터/검색) — 순수 표시 (publish-tags 스펙과 동일 방침)
- 다크 모드

## 3. 불변 조건

- 커뮤니티 라우팅은 경로 기반 유지. URL 해시는 곡 blob 전용.
- <1024px 커뮤니티는 현행 레이아웃(420px 컬럼 + CommunityHeader) 그대로 fallback.
- 색상은 tokens.css 변수만 사용(하드코딩 금지). SMP 유니코드 음악 기호 금지 — 아이콘 전부 SVG 패스.
- 골든 스냅샷(FakeAudioSink) 불변 — 오디오 경로 무변경.
- **Publish는 사이드바·AppBar에 넣지 않는다** — 게시 진입은 에디터 Share 경유만
  (`2026-07-13-share-menu-edit-from-view-design.md` 결정 유지).
- 게이트 4종(`typecheck / lint / test / check-smp`) 통과.

## 4. 토큰 (tokens.css :root에 추가 — 전역 적용)

```css
--brand-primary: #0F6E56;      /* deep teal — primary 버튼·활성 상태 */
--brand-primary-text: #E1F5EE; /* brand 위 텍스트 */
--brand-tint: #E1F5EE;         /* 연한 brand 배경 (활성 내비·선택 세그먼트) */
--brand-tint-text: #085041;    /* tint 위 텍스트 */
--brand-outline: #1D9E75;      /* 포커스·선택 보더 */
--note-block: #5DCAA5;         /* 패드·피아노롤 켜진 셀 */
--note-block-selected: #0F6E56;/* 선택 음표/셀 */
--playhead: #D85A30;           /* 재생 헤드 (코랄) */
--rank-accent: #BA7517;        /* 랭킹 1위 amber */
--bg-page: #F7F6F3;            /* 페이지 배경 (off-white) */
--bg-card: #FFFFFF;            /* 카드 표면 */
--radius-card: 12px;           /* 신규 커뮤니티·데스크톱 카드 */
--radius-ctl: 6px;             /* 신규 컨트롤 (6~8px 계열) */
```

### 재배선 규칙
- Primary 버튼·활성 상태(icon-btn.on, popover .on, c-btn, c-like.on 등)·선택 음표 = brand 계열.
- 재생 헤드(악보·피아노롤) = `--playhead`.
- 패드·피아노롤 켜진 셀 = `--note-block`, 선택 = `--note-block-selected`.
- `--red`는 **삭제·경고 전용**으로 축소 (삭제 버튼, warn 버튼, c-danger).
- 페이지 배경 `--bg-outer`의 값을 `--bg-page`로 재지정. 카드 = `--bg-card` + hairline(`--line`) +
  미세 그림자. 흰 배경 위 흰 카드 금지 — 카드가 놓이는 면은 항상 `--bg-page`.
- 라운드: 신규 커뮤니티·데스크톱 표면은 카드 12px / 컨트롤 6~8px. **기존 모바일 에디터의
  2px 라운드(`--radius`)는 유지** (모바일 회귀 방지).
- 타이포: 카드 제목 17~18px/500, 본문 14~15px, 메타 13px muted. 아이콘은 라인 스타일 통일.
- hover: 카드 보더 강조 + 재생버튼 brand 활성. 버튼·링크 hover 필수, `@media (hover: hover)`
  가드, `:focus-visible` 아웃라인(`--brand-outline`).

## 5. 데스크톱 커뮤니티 셸 (≥1024px)

```
Root.tsx
├─ AppBar (.c-appbar — <1024px에서 숨김)
│   음표 로고 + "Lick Share" 워드마크(brand)
│   중앙 검색창 (pill, max-width 480px, disabled + "Search coming soon" 툴팁)
│   [+ Create] primary 버튼 → navigate('/edit')
│   이니셜 아바타 드롭다운 (My licks / Sign out) · 비로그인 시 Sign in 버튼
└─ .community-shell (max-width 1240px 중앙, grid: 200px | 1fr | 260px)
    ├─ Sidebar: Latest · Ranking · My licks 내비
    │   (활성 = --brand-tint 배경 + --brand-tint-text + 6px 라운드)
    │   + 구분선 + 인기 태그 섹션
    ├─ 메인: 기존 라우트 뷰. 피드는 2열 그리드(gap 16~20px)
    │   + 정렬 pill "Latest"/"Popular"
    └─ RightPanel: "Top Licks" 위젯 — ranking 상위 5,
        1위 숫자 amber(--rank-accent) + 트로피 아이콘(SVG 라인)
```

- ≥1024px에서 기존 `CommunityHeader` 세그먼트 탭은 CSS로 숨긴다(AppBar/Sidebar가 대체).
  <1024px에서는 AppBar/Sidebar/RightPanel을 숨기고 기존 헤더 유지 — 미디어쿼리로만 전환
  (DOM은 항상 동일, jsdom 테스트는 구조 존재만 검증).
- 사이드바 내비는 라우트 기반 활성 표시. **Publish 항목 없음.**

### 5.1 인기 태그 (Sidebar)
- 데이터원: `licks.tags`(text[] — 병렬 브랜치에서 스키마 추가 중). 이미 로드된 피드 행
  (첫 페이지)을 클라이언트에서 집계해 상위 태그를 표시한다. 전용 엔드포인트 없음.
- 집계는 순수 함수 `topTags(rows, limit)` (`src/community/popular-tags.ts`):
  빈도 내림차순, 동률은 첫 등장 순.
- **방어 처리(필수)**: row에 `tags` 필드가 없거나(컬럼이 아직 DB에 없을 수 있음) 집계 결과가
  비면 섹션 자체를 렌더링하지 않는다.
- 태그 칩은 클릭 비활성(순수 표시).

### 5.2 피드 정렬 pill
- "Latest"(기본) / "Popular". Popular는 **기존 ranking DB view 데이터 정렬을 재사용** —
  Popular 선택 시 랭킹 목록 컴포넌트를 그대로 마운트한다. 신규 쿼리 없음.
- pill은 홈 피드(`/`)에만 표시. 기간 필터 없음(§2 제외).

### 5.3 카드 구성 (LickCard)
1. 제목(17~18px/500) + 날짜(13px muted) 행
2. 작성자 링크(13px)
3. 악보 미리보기(카드 폭)
4. 액션 행: 원형 재생 버튼(멜로디만, 토글 정지) · 하트 + 좋아요 수 · (내 릭이면 Delete)
- 유사릭 배지("similar")는 날짜 옆 유지. 조회수·조옮김은 §2 제외.

### 5.4 Ranking 페이지
- 카드에 순위 뱃지 — 1~3위는 `--rank-accent` 강조.
- 기간 필터는 구현하지 않음(§2 제외). Top Licks 위젯도 동일하게 전체 기간.

### 5.5 Top Licks 위젯 (RightPanel)
- `fetchRankingPage(0)` 상위 5건: 순위 숫자·제목·작성자·♥수. 클릭 = 상세 이동.
- 1위 숫자는 amber + 트로피 SVG 라인 아이콘. 로드 실패·빈 목록이면 위젯 숨김.

## 6. 파일 영향

| 파일 | 변경 |
|---|---|
| `src/styles/tokens.css` | 브랜드 토큰 추가, `--bg-outer` 재지정, `.daw` 노트 토큰 재배선 |
| `src/styles/global.css` | 활성/선택/포커스 색 재배선 (구조 불변) |
| `src/ui/components/edit/Score.tsx` | 선택 음표·음영·♯ → brand, 재생 헤드 → `--playhead` |
| `src/community/popular-tags.ts` (+test) | 신규 — `topTags` 순수 집계 |
| `src/community/components/AppBar.tsx` (+test) | 신규 |
| `src/community/components/Sidebar.tsx` (+test) | 신규 (인기 태그 포함) |
| `src/community/components/TopLicks.tsx` (+test) | 신규 |
| `src/community/components/LickCard.tsx` | 카드 리디자인 + 재생 버튼 |
| `src/community/views/Feed.tsx` | 정렬 pill (홈 전용) |
| `src/community/views/Ranking.tsx` | 순위 뱃지 |
| `src/community/Root.tsx` | AppBar + 셸 grid 조립 |
| `src/community/community.css` | 셸·카드·pill·위젯 스타일 |

## 7. 테스트 전략

- `topTags`: 빈도·동률·tags 없는 행·빈 배열 방어.
- AppBar: 로고·Create 내비, 로그인/비로그인 분기, 검색 disabled.
- Sidebar: 내비 활성 표시, 태그 없으면 섹션 미렌더.
- TopLicks: 상위 5 슬라이스, 실패 시 숨김.
- LickCard: 재생 버튼 → player.play(멜로디만), 기존 Feed/Ranking 테스트 유지.
- CSS 미디어쿼리 전환은 jsdom 검증 불가 → e2e 체크리스트 수동 확인.

## 8. 완료 정의 (DoD)

1. 전역 리브랜드: primary·활성·선택·재생 헤드가 새 토큰으로 렌더, `--red`는 삭제·경고 전용.
2. ≥1024px 커뮤니티: AppBar + 3컬럼 셸 + 2열 피드 + Top Licks 위젯.
3. <1024px 커뮤니티·모바일 에디터 회귀 없음.
4. 게이트 4종 통과, 골든 스냅샷 불변.
