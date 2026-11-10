# 배포 시 해시태그 추가 — 설계

- 작성일: 2026-07-13
- 상태: 승인됨 (구현 대기)
- 관련: `docs/superpowers/specs/2026-07-12-community-design.md` (§범위 제외에서 태그·검색을 성장 후로 유보한 결정을 이 스펙이 부분 해제 — 단, **태그 저장·표시까지만**, 검색·브라우즈는 여전히 유보)

## 1. 목적과 범위

배포(Publish) 시 사용자가 릭에 자유 입력 해시태그를 붙이고, 그 태그를 DB에 저장하며, 커뮤니티 카드·상세에 칩으로 표시한다.

### 범위 포함
- 배포 화면의 태그 칩 입력 UI
- 태그 정규화 (순수 함수)
- `licks` 테이블에 태그 저장
- 카드(`LickCard`)·상세(`LickDetail`)에 태그 칩 렌더링

### 범위 제외 (의도적)
- 태그 검색 / 텍스트 검색
- 태그로 필터링·브라우즈 (태그 칩 클릭 → 목록)
- 태그 자동완성·추천
- 배포 후 태그 수정 (게시 수정 자체가 커뮤니티 스펙상 범위 밖 — 삭제 후 재게시로 갈음)

태그 칩은 현재 **클릭 비활성**(순수 표시). 향후 검색 도입 시 링크화할 여지만 남긴다.

## 2. 데이터 모델

`supabase/schema.sql`의 `licks` 테이블(현재 line 42-51 블록)에 컬럼 추가:

```sql
tags text[] not null default '{}'
  check (array_length(tags, 1) is null or array_length(tags, 1) <= 3)
```

- **`text[]` 선택 근거**: 태그는 릭 하나에 종속된 값이고, 현재 검색이 없어 조인 테이블·GIN 인덱스가 불필요하다. 향후 검색이 필요하면 이 컬럼에 GIN 인덱스만 추가하면 되며 스키마를 파괴하지 않는다.
- **개수 상한(3개)** 은 DB CHECK 제약으로 방어한다. **원소 길이(15자)와 정규화**는 앱 계층(`normalizeTags`)에서 강제한다.
- `not null default '{}'` — 태그는 선택 사항이므로 기본값은 빈 배열. 기존 행도 마이그레이션 없이 빈 배열로 채워진다.
- **`melody_hash`에는 태그를 절대 포함하지 않는다** (CLAUDE.md 규칙: melody_hash 직렬화 대상은 피치 델타·시작 오프셋·길이 삼중항뿐). 태그는 곡 동일성과 무관하므로 중복 판정에 영향을 주지 않는다.
- **`ranking` 뷰**(현재 line 93-105)의 select 목록에도 `tags`를 추가한다 — 랭킹 화면 카드도 동일하게 칩을 표시하기 위함.

`docs/superpowers/specs/2026-07-12-community-design.md` Appendix A의 DDL 사본도 동일하게 갱신한다(문서 정합성).

## 3. 정규화 — 신규 순수 함수 `src/community/tags.ts`

```ts
/** 자유 입력 raw 문자열 하나 → 정규 태그 or null */
export const normalizeTag = (raw: string): string | null => { /* ... */ };

/** raw 배열 → 정규 태그 배열 (null 제거·중복 제거·최대 3개) */
export const normalizeTags = (raws: readonly string[]): string[] => { /* ... */ };
```

### `normalizeTag(raw)` 규칙 (순서대로)
1. `trim()`
2. 앞의 `#` 제거 (`'#jazz'` → `'jazz'`)
3. `toLowerCase()` — 한글은 영향 없음
4. 공백 런(1개 이상 연속 공백) → 하이픈 1개
5. 허용 문자 `[a-z0-9가-힣ㄱ-ㅎㅏ-ㅣ-]` 외 문자 제거 (이모지·특수문자 제거)
6. 연속 하이픈 → 1개, 양끝 하이픈 제거
7. 15자로 truncate
8. 빈 문자열이면 `null` 반환

### `normalizeTags(raws)` 규칙
- 각 원소에 `normalizeTag` 적용 → `null` 제거
- 중복 제거 (첫 등장 순서 유지)
- 앞 3개만 취함 (초과분 버림)

### 테스트 (TDD — RED 먼저)
`src/community/tags.test.ts`:
- `'#Jazz Blues'` → `'jazz-blues'`
- 대소문자 통일: `'Bebop'`, `'bebop'` → 중복으로 1개
- 4개 입력 → 3개로 컷
- 15자 초과 → 15자로 컷
- 이모지·특수문자 제거, 한글 유지 (`'재즈'` → `'재즈'`)
- 앞뒤·연속 하이픈 정리 (`'  --jazz--  '` → `'jazz'`)
- 빈 입력·공백만 → 제외

## 4. API — `src/community/api/licks.ts`

- `LickRow` 인터페이스(line 5-13)에 `readonly tags: string[]` 추가
- `LICK_COLS` 프로젝션(line 17-18)에 `tags` 추가 → 피드·상세 fetch 시 함께 조회
- `RankingRow` 인터페이스(line 74-83)에도 `tags` 추가
- `publishLick` 시그니처를 `publishLick(title, blob, melodyHash, tags: readonly string[])` 로 확장하고, insert 객체(line 56-59)에 `tags`를 포함

## 5. 입력 UI — `src/community/views/Publish.tsx`

제목 input 아래에 **태그 칩 입력** 추가:

- 컴포넌트: `TagInput`(신규, `src/community/components/TagInput.tsx`) — 제어 컴포넌트, `value: string[]` / `onChange(next: string[])`
- 상호작용:
  - 텍스트 필드에서 `Enter` 또는 `,` 입력 → 현재 입력을 `normalizeTag` 적용 후 칩으로 커밋(정규화 결과가 `null`이거나 이미 존재하면 무시)
  - 칩의 `×` 클릭 → 해당 칩 제거
  - 빈 입력 필드에서 `Backspace` → 마지막 칩 제거
  - 칩이 3개면 입력 필드 비활성화 + 안내 문구
- `Publish.tsx`에 `const [tags, setTags] = useState<string[]>([])` 추가
- `onPublish()`에서 최종 방어로 `normalizeTags(tags)` 재적용 후 `publishLick(..., normalizeTags(tags))` 호출
- 태그 0개도 정상 배포

## 6. 표시 — `LickCard.tsx`, `LickDetail.tsx`

- 기존 메타(작성자·♥·날짜) 영역 근처에 태그 칩 목록 렌더링
- `community.css`에 `.c-tag` (칩) 클래스 추가 — 색상은 반드시 `src/styles/tokens.css` CSS 변수 사용(하드코딩 색상 금지)
- 태그가 빈 배열이면 아무것도 렌더링하지 않음
- 칩은 클릭 비활성(순수 표시)

## 7. 레이어·규칙 준수 확인

- `src/community/`는 ui 동급 레이어 — DOM·supabase 사용 허용. `tags.ts`는 순수 문자열 로직이지만 community 레이어에 두어 core 순수 규칙(정규식·문자 처리 자체는 무해)과 무관하게 관리.
- 의존 화살표: community → core만 허용(코드 방향 유지).
- SMP 유니코드 음악 기호 미사용 — 해당 없음.
- URL 해시는 곡 blob이 점유 — 태그는 라우팅과 무관(경로/상태로만 다룸).
- `service_role` key 미사용 — anon key + RLS 유지. 태그 insert는 기존 `"insert own lick"` RLS 정책으로 커버됨.

## 8. 검증 게이트

`npm run typecheck && npm run lint && npm test && npm run check-smp` 전부 통과.
골든 스냅샷(FakeAudioSink 로그)은 오디오와 무관하므로 영향 없음.

## 9. 구현 순서 (요약)

1. `tags.ts` 테스트 작성(RED) → `normalizeTag`/`normalizeTags` 구현(GREEN)
2. `schema.sql` + Appendix A DDL에 `tags` 컬럼·CHECK·ranking 뷰 갱신
3. `api/licks.ts` 타입·`LICK_COLS`·`publishLick` 확장
4. `TagInput` 컴포넌트 + `Publish.tsx` 배선
5. `LickCard`/`LickDetail` 칩 렌더링 + `.c-tag` 스타일
6. 게이트 통과 후 커밋
