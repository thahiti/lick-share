# 배포 시 해시태그 추가 구현 계획

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. TDD 필수 — 테스트 먼저(RED) → 구현(GREEN) → 게이트 → 커밋.

**Goal:** 배포(Publish) 시 자유 입력 해시태그를 정규화해 `licks.tags(text[])`에 저장하고, 카드(`LickCard`)·상세(`LickDetail`)·랭킹 카드에 칩으로 표시한다. 검색·필터·자동완성·태그 수정은 범위 제외.

**설계 스펙:** `docs/superpowers/specs/2026-07-13-publish-tags-design.md` (승인됨).

## Global Constraints

- **게이트**(커밋 전 전부 통과): `npm run typecheck && npm run lint && npm test && npm run check-smp`
- `melody_hash`에 태그 절대 미포함 — 태그는 중복 판정과 무관.
- UI 텍스트 영어, 코드 주석 한국어, trailing space 금지, SMP 유니코드 금지.
- 색상은 `src/styles/tokens.css` CSS 변수만 사용 (`.c-tag` 신규 클래스).
- 커밋: Conventional Commits, atomic (하나의 커밋 = 하나의 논리적 변경).
- 원격 Supabase DB 적용은 하지 않는다 — `supabase/schema.sql` 갱신 + 마이그레이션 SQL은 보고로 전달.

## Tasks

### T1. 태그 정규화 순수 함수 — `src/community/tags.ts`

- [ ] `src/community/tags.test.ts` 작성 (RED):
  - `'#Jazz Blues'` → `'jazz-blues'` (# 제거·소문자·공백→하이픈)
  - `'Bebop'`/`'bebop'` → 중복 1개
  - 4개 입력 → 3개 컷
  - 15자 초과 → 15자 truncate
  - 이모지·특수문자 제거, 한글 유지 (`'재즈'` → `'재즈'`)
  - `'  --jazz--  '` → `'jazz'` (양끝·연속 하이픈 정리)
  - 빈 입력·공백만 → `null`/제외
- [ ] `normalizeTag(raw): string | null`, `normalizeTags(raws): string[]` 구현 (GREEN)
- [ ] 게이트 → 커밋 `feat(community): add tag normalization helpers`

### T2. 스키마 — `supabase/schema.sql` + 설계 문서 DDL 정합

- [ ] `licks` 테이블에 `tags text[] not null default '{}'` + CHECK(최대 3개) 추가
- [ ] `ranking` 뷰 select 목록·group by에 `l.tags` 추가
- [ ] `docs/superpowers/specs/2026-07-12-community-design.md` 부록 A DDL 사본 동일 갱신
- [ ] 게이트 → 커밋 `feat(community): add tags column to licks schema`

### T3. API — `src/community/api/licks.ts`

- [ ] `LickRow`·`RankingRow`에 `tags: string[]` 추가, `LICK_COLS`에 `tags` 추가
- [ ] `publishLick(title, blob, melodyHash, tags)` 로 확장, insert 객체에 `tags` 포함
- [ ] 기존 테스트 픽스처(`Feed.test.tsx`, `LickDetail.test.tsx`, `Publish.test.tsx` mock)에 `tags` 반영
- [ ] `Publish.tsx` 호출부는 임시로 `[]` 전달 (T4에서 실제 배선)
- [ ] 게이트 → 커밋 `feat(community): fetch and publish tags in licks API`

### T4. 입력 UI — `TagInput` + `Publish.tsx` 배선

- [ ] `src/community/components/TagInput.test.tsx` 작성 (RED):
  - Enter/`,` 로 칩 커밋 (normalizeTag 적용, null·중복 무시)
  - 칩 `×` 클릭 → 제거
  - 빈 입력에서 Backspace → 마지막 칩 제거
  - 3개 도달 → 입력 비활성 + 안내 문구
- [ ] `src/community/components/TagInput.tsx` 구현 (제어 컴포넌트: `value`/`onChange`) (GREEN)
- [ ] `Publish.test.tsx`에 태그 포함 게시 케이스 추가 (RED) → `Publish.tsx`에 `tags` state + `TagInput` + `publishLick(..., normalizeTags(tags))` (GREEN)
- [ ] 게이트 → 커밋 `feat(community): tag chip input on publish`

### T5. 표시 — 칩 렌더링 + 스타일

- [ ] 카드·상세 테스트에 태그 칩 표시/빈 배열 미표시 케이스 추가 (RED)
- [ ] `TagChips` 공용 컴포넌트(빈 배열이면 null) → `LickCard`·`LickDetail`·`Ranking`에 렌더 (GREEN)
- [ ] `community.css`에 `.c-tag` 추가 (tokens 변수만, 클릭 비활성 순수 표시)
- [ ] 게이트 → 커밋 `feat(community): render tag chips on cards and detail`

## 범위 제외 (구현 금지)

태그 검색·텍스트 검색, 태그 필터·브라우즈(칩 클릭 동작), 자동완성·추천, 배포 후 태그 수정.
