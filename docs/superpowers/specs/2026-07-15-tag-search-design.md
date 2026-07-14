# Tag 필터 & 검색 설계 (2026-07-15)

## 배경과 목표

커뮤니티 화면에 이미 렌더링 중인 태그(카드 `TagChips`, 사이드바 인기 태그)는 클릭해도
아무 일도 일어나지 않고, 데스크톱 `AppBar`의 검색창은 `disabled` placeholder 상태다.
이 둘을 활성화한다:

1. **태그 필터** — 태그를 클릭하면 해당 태그가 붙은 릭만 모아 보는 피드로 이동.
2. **검색** — 릭 제목·태그·유저를 검색. 타이핑 중 실시간 제안(드롭다운) + Enter 시
   전체 결과 페이지. 데스크톱·모바일 모두 지원.

placeholder의 "songs"에 해당하는 엔티티는 DB에 없다(릭 제목이 곡 제목 역할).
검색 대상은 **릭 제목 + 태그 + 유저**이며 placeholder 문구를
"Search licks, tags, users"로 수정한다.

## 접근 방식 결정

- **클라이언트 병렬 질의** (채택): 프론트에서 PostgREST 질의를 병렬로 날리고
  클라이언트에서 섹션별로 합친다. 스키마 변경 제로, anon key + RLS 범위 안에서 동작.
  결과 화면이 섹션(Licks / Users) 구조이므로 통합 랭킹이 필요 없다.
- Postgres RPC 함수(왕복 1회 + 서버 랭킹)는 데이터가 커지면 교체 — API 함수
  시그니처는 그대로 유지 가능하도록 `api/search.ts`에 격리한다.
- 매칭은 단순 부분 문자열(`ilike '%q%'`), 태그는 정확 일치. FTS/trigram은
  현 규모에서 과한 투자로 판단해 배제.

## §1 라우팅과 URL

`routing.ts`의 `Route`에 2개 추가:

```ts
| { name: 'tag'; tag: string }        // /tag/:name  (URL 인코딩된 태그)
| { name: 'search'; query: string }   // /search?q=…
```

- `/tag/bebop` — 해당 태그 릭만 보여주는 피드. 경로 세그먼트는
  `decodeURIComponent`로 복원한다.
- `/search?q=blues` — 검색 결과 페이지. 쿼리를 query param에 두어 뒤로가기·URL
  공유·새로고침이 자연스럽게 동작한다. `q`가 없거나 빈 문자열이면 빈 상태 화면.
- 기존 규칙 준수: URL 해시는 곡 blob(`v1.…`) 전용이므로 건드리지 않는다.

## §2 API 계층

### `fetchFeedPage` 확장 (`api/licks.ts`)

기존 `authorId` 인자와 같은 패턴으로 선택 필터를 받는다:

```ts
fetchFeedPage(cursor: string | null, filter?: { authorId?: string; tag?: string })
// tag → .contains('tags', [tag])  — Postgres tags @> '{tag}'
```

기존 호출부(`Feed`, `UserPage`, `MyLicks`, `Sidebar`)는 시그니처 변경에 맞춰 수정한다.

### 새 파일 `api/search.ts`

```ts
searchLicks(q: string, opts: { limit: number; cursor?: string | null }): Promise<LickRow[]>
searchUsers(q: string, limit: number): Promise<ProfileRow[]>
```

- `searchLicks`: `licks` 테이블 1회 질의.
  `or('title.ilike.*q*,tags.cs.{q}')` — 제목 부분 매칭 OR 태그 정확 일치.
- 입력이 `#`로 시작하면(`#bebop`) 태그 전용 검색 — `#`를 뗀 나머지로
  `contains('tags', […])`만 수행.
- `searchUsers`: `profiles.display_name ilike '%q%'`. 반환 컬럼은
  `public_id, display_name, avatar_url`.
- `ilike` 특수문자 `%`, `_`와 PostgREST `or()` 구문 예약문자(`,`, `(`, `)`)는
  이스케이프한다.
- 드롭다운 제안은 `limit 5`, 결과 페이지는 `PAGE_SIZE`(20) keyset 페이지네이션
  (`created_at` 커서 — 피드와 동일 패턴).

## §3 컴포넌트 구조

```
components/
  SearchBox.tsx          # 입력 + 디바운스(300ms) + 제안 상태 — 공유 로직
  SearchSuggestions.tsx  # 제안 목록 렌더 (Licks/Users 섹션, 키보드 ↑↓·Enter)
views/
  SearchResults.tsx      # /search 페이지 — 섹션별 전체 결과 + 무한 스크롤
```

- **데스크톱**: `AppBar`의 disabled input을 `SearchBox`로 교체. 제안은 입력창에
  앵커된 팝오버.
- **모바일(<1024px)**: `MobileAppBar`에 돋보기 아이콘 추가 → 탭하면 전체 화면
  검색 오버레이(상단 입력창 + 제안 목록이 화면을 채움). `SearchBox` 로직을
  재사용하고 감싸는 껍데기만 다르다.
- **태그 클릭 활성화**: `TagChips`(카드)와 사이드바 인기 태그를 `/tag/:name`
  링크(`navigate`)로 변경.
- **태그 피드**: 별도 view를 만들지 않고 `Feed.tsx`가 `tag` prop을 받아 재사용.
  화면 상단에 `#bebop` 헤더 + 릭 개수를 표시한다.

## §4 동작 상세와 엣지 케이스

- 디바운스 300ms. 질의 최소 길이 2자 — 미만이면 질의하지 않고 제안을 숨긴다.
- 응답 순서 역전 가드: 최신 질의 id(단조 증가 카운터)를 기억하고 이전 응답은 버린다.
- Enter → `/search?q=…` 이동(드롭다운 닫힘). 제안 항목 클릭/Enter →
  해당 `/lick/:id` 또는 `/user/:public_id` 직행.
- Escape·외부 클릭 → 드롭다운 닫힘. 키보드 ↑↓로 제안 항목 이동.
- 결과 0건: "No results for “…”" 빈 상태.
- 검색 제안·결과의 질의 실패는 조용히 빈 목록 처리(사이드바 태그 집계와 동일한
  방어적 태도).
- placeholder: "Search licks, tags, users".

## §5 테스트 (TDD)

- `routing.test.ts`: `/tag/:name`(인코딩 포함), `/search?q=` 파싱, `q` 누락/빈 값.
- `api/search.test.ts`: 질의 빌더 — ilike 이스케이프, `#` 접두 태그 전용 검색,
  limit/cursor 전달 (기존 `likes.test.ts`의 supabase mock 패턴).
- `api/licks.test.ts`(또는 기존 테스트 확장): `tag` 필터가 `.contains`로 전달되는지.
- `SearchBox.test.tsx`: 디바운스, 2자 미만 무시, 키보드 내비, 응답 역전 가드,
  Escape/외부 클릭 닫힘.
- `Feed.test.tsx`: `tag` prop이 fetch 필터로 전달되고 헤더가 렌더되는지.
- 게이트: `npm run typecheck && npm run lint && npm test && npm run check-smp`.

## 비고 (성능·보안)

- 모든 질의는 anon key + RLS(전체 select 공개) 범위 — 새 정책 불필요.
- `ilike '%q%'`는 seq scan이지만 현 데이터 규모에서 문제 없음. 커지면
  pg_trgm GIN 인덱스 또는 RPC 검색 함수로 교체(§2의 API 격리로 교체 비용 최소화).
- 태그 필터(`tags @> …`)도 규모가 커지면 `gin(tags)` 인덱스 추가.
