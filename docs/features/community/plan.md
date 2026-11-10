# ScoreLink 커뮤니티 기능 구현 계획 (React 통합본)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. TDD 필수.

**Goal:** 커뮤니티 설계 v1.1(게시·계정·좋아요·랭킹·유사릭·원본 승계)을 기존 scorelink React 앱 안에 구현한다. codec·Score·Viewer·player는 재사용하고, Supabase 연동과 커뮤니티 화면만 새로 만든다.

**Architecture:** 자체 백엔드 0대. Supabase(Postgres + PostgREST + GoTrue + RLS)가 서버 역할. 프론트는 기존 React 19 + Zustand + Vite 8 앱에 `src/community/` 모듈을 추가하고, 경로 라우터로 편집기(기존 App)와 커뮤니티 화면을 가른다. 게시 blob은 기존 `encodeSong`/`decodeSong`(`v1.` 해시)를 그대로 저장·재생한다.

**설계 스펙:** `docs/superpowers/specs/2026-07-12-community-design.md` (v1.1 확정본, 부록 A SQL 포함).

## Global Constraints (기존 CLAUDE.md + 커뮤니티 추가)

- **TDD 필수**: 순수 로직(melody-hash, api 헬퍼, routing)은 RED→GREEN. React 뷰는 핵심 동작을 testing-library로 검증.
- **게이트**(커밋 전 전부 통과): `npm run typecheck && npm run lint && npm test && npm run check-smp`
- **레이어 규칙**: `ui → adapters → ports`, `engine → core`. core/engine/ports는 순수(react·DOM·zustand·Date·window·Math.random 금지). **`src/community/`는 ui 레이어와 동급**(supabase·DOM·crypto 허용). melody-hash는 `crypto.subtle`을 쓰므로 core가 아니라 `src/community/`에 둔다.
- **SMP 유니코드 음악 기호(U+1D100~U+1D1FF) 금지** — 악보 기호는 전부 SVG 패스(기존 Score 재사용으로 자동 준수).
- **하위 호환**: 기존 `v1.` 해시와 `?mode=view#v1...` 공유 링크가 계속 동작해야 한다.
- **디자인 토큰만 사용**: `src/styles/tokens.css`의 CSS 변수(`--ink`, `--red`, `--line`, `--line2`, `--mut`, `--mut2`, `--radius`, `--font-sans` 등). 하드코딩 색상 금지. `--red`는 유일한 포인트 컬러.
- **UI 텍스트 한국어, 식별자 영어**. 커밋은 Conventional Commits(`feat(community): …`, `fix(community): …`, `test(community): …`, `docs: …`). 기존 repo도 `fix(audio):` 등 사용.
- **환경 변수**는 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 둘. `service_role` key는 코드·env에 절대 넣지 않는다.
- tsconfig: 기존 그대로(`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`). `verbatimModuleSyntax` 때문에 타입 전용 import는 `import type`.
- trailing whitespace 금지.

## 재사용 인터페이스 (기존 코드 — 구현자 필독)

- `src/core/types.ts`: `interface Note { id:number; s:Step; d:number; p:Midi }`, `interface Song { title; tempo; meas; pickup:0|8; accPat; mAcc; notes:readonly Note[]; chords }`. `asStep`, `asMidi`. Step/Midi는 branded number(산술 연산은 number처럼 동작).
- `src/core/codec.ts`: `decodeSong(hash:string):Song|null`, `encodeSong(song:Song):string`. `v1.` 접두사·구버전·미래버전 거부까지 완비.
- `src/core/geometry.ts`: `total(song):Step`, `measStart`, `measLen`, `measOf`, `measCountAll` 등.
- `src/core/demo-song.ts`: `DEMO_SONG` (테스트 픽스처로 재사용 가능). *(존재 확인: `src/core/demo-song.ts`. export 이름은 구현자가 파일을 열어 확인할 것.)*
- `src/ui/components/edit/Score.tsx`: `<Score song mode="view" width={n} onNoteTap={(id)=>…} />` — 멀티라인 열람 악보(SVG). `playheadStep?` 지원.
- `src/ui/components/view/Viewer.tsx`: `<Viewer song playing width playheadStep? onPlayAll onNoteTap onCopyLink onToEdit />` — 히어로+악보+재생 버튼. 커뮤니티 상세에서 참고(래핑 or 부분 재사용).
- `src/adapters/player.ts`: `createPlayer({sink, clock}):Player`. `player.play(song, {melody,accomp,metro}, from:Step, to:Step)`, `player.stop()`, `player.isPlaying()`, `player.onTick(cb)`, `player.onEnded(cb)`. 열람 재생 opts = `{melody:true, accomp:false, metro:false}`.
- `src/ui/components/App.tsx`: 기존 편집/열람 화면. `<App player hashStore initialMode? />`. 그대로 두고 라우터가 편집 경로에서 마운트.
- `src/main.tsx`: `audioCtx`, `createWebAudioSink`, `createRafClock`, `createPlayer`, `createLocationHashStore`로 player/hashStore 생성 후 App 마운트. **T6에서 이 파일을 수정해 Root 라우터를 마운트한다.**

## 라우팅 설계

경로 기반 라우터(해시는 곡 blob이 점유하므로 hash 라우팅 불가). SPA fallback 필요.

| 경로 / 조건 | 렌더 | 비고 |
|---|---|---|
| `?mode=view` 쿼리 존재 | 기존 App (view) | **레거시 공유 링크 하위 호환** |
| `/` | Feed | 커뮤니티 기본 화면 |
| `/edit` (+`#v1…`) | 기존 App (edit) | 편집기 진입점 |
| `/ranking` | Ranking | |
| `/publish` (+옵션 `#v1…`) | Publish | 붙여넣기 게시 |
| `/lick/:id` | LickDetail | 영속 링크 |
| `/user/:publicId` | UserPage | |
| `/me` | MyLicks | 로그인 필요 |
| 그 외 | NotFound | |

"복제해서 편집"·편집기 진입은 `/edit#<blob>`로 이동. 게시 성공 후 `/lick/:id`로 이동.

## 파일 구조 (신규)

```
scorelink/
  .env.example                         # NEW
  supabase/schema.sql                  # NEW (부록 A)
  src/
    community/
      supabase.ts                      # createClient (anon)
      melody-hash.ts                   # melodyTokens(순수)+melodyHash(crypto.subtle)
      melody-hash.test.ts
      routing.ts                       # parseRoute(순수)+useRoute+navigate
      routing.test.ts
      api/
        auth.ts                        # getSessionUser, signInWithGoogle, signOut, onAuthChange
        profiles.ts                    # Profile, fetchProfileByPublicId, fetchProfileById
        licks.ts                       # LickRow, fetchFeedPage, fetchLick, publishLick, deleteLick, RankingRow, fetchRankingPage, PAGE_SIZE
        likes.ts                       # 순수 헬퍼 + fetchLikeCounts/fetchMyLikedSet/addLike/removeLike
        likes.test.ts
      hooks/
        useInfiniteScroll.ts           # IntersectionObserver 훅
      components/
        CommunityHeader.tsx            # 로고+네비+로그인/로그아웃
        LickCard.tsx                   # 목록 카드 (Score view 재사용)
        LikeButton.tsx                 # 하트 토글
      views/
        Feed.tsx  Ranking.tsx  Publish.tsx  LickDetail.tsx  UserPage.tsx  MyLicks.tsx  NotFound.tsx
      Root.tsx                         # 라우터 루트 (편집기 vs 커뮤니티)
      community.css                    # 커뮤니티 전용 클래스 (토큰만)
    main.tsx                           # MODIFY: Root 마운트
    vite-env 또는 env.d.ts             # import.meta.env 타입 (기존 vite/client로 충분하면 생략)
```

---

### Task 1: Supabase 클라이언트와 환경

**Files:**
- Create: `.env.example`, `src/community/supabase.ts`
- Modify: `package.json` (deps에 @supabase/supabase-js 추가 — `npm install`로)

**Interfaces:**
- Produces: `supabase` (SupabaseClient), env 규약. 이후 모든 api 태스크가 소비.

- [ ] **Step 1: 의존성 설치**

```bash
cd /Users/randy/claude_code/lick_share/scorelink
npm install @supabase/supabase-js
```

- [ ] **Step 2: `.env.example` 작성**

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

- [ ] **Step 3: `src/community/supabase.ts` 작성**

```ts
import { createClient } from '@supabase/supabase-js';

/** anon key 클라이언트. 권한은 전부 DB의 RLS가 판정한다. service_role key 사용 금지. */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);
```

- [ ] **Step 4: 타입·게이트 확인**

`import.meta.env.VITE_*`는 `vite/client`(tsconfig `types`에 포함됨)로 `string | undefined` 처리된다. 필요 시 `src/community/env.d.ts`로 좁혀도 되나 v1은 생략.

Run: `npm run typecheck && npm run lint`
Expected: 무오류 (테스트는 아직 없음)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example src/community/supabase.ts
git commit -m "feat(community): add supabase client and env scaffolding"
```

---

### Task 2: melody-hash (TDD)

**Files:**
- Create: `src/community/melody-hash.ts`, `src/community/melody-hash.test.ts`

**Interfaces:**
- Consumes: `Note` (`src/core/types`)
- Produces: `melodyTokens(notes: readonly Note[]): number[][]` (순수), `melodyHash(notes: readonly Note[]): Promise<string>` (SHA-256 hex 64자)

- [ ] **Step 1: 실패하는 테스트 작성** — `src/community/melody-hash.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { asMidi, asStep, type Note } from '../core/types';
import { melodyHash, melodyTokens } from './melody-hash';

const note = (s: number, d: number, p: number, id = s): Note => ({
  id,
  s: asStep(s),
  d,
  p: asMidi(p),
});
const base: Note[] = [note(0, 4, 64), note(4, 2, 69), note(8, 4, 67)];
const shift = (ns: Note[], dp: number): Note[] => ns.map((n) => ({ ...n, p: asMidi(n.p + dp) }));

describe('melodyTokens', () => {
  it('첫 음 기준 [상대 피치, 상대 시작, 길이] 삼중항', () => {
    expect(melodyTokens(base)).toEqual([
      [0, 0, 4],
      [5, 4, 2],
      [3, 8, 4],
    ]);
  });

  it('빈 입력은 빈 배열', () => {
    expect(melodyTokens([])).toEqual([]);
  });

  it('id·정렬 순서에 무관 (시작 스텝 기준 정규화)', () => {
    const unordered = [note(8, 4, 67, 99), note(0, 4, 64, 1), note(4, 2, 69, 2)];
    expect(melodyTokens(unordered)).toEqual(melodyTokens(base));
  });

  it('첫 음 이전 무음(전체 시작 오프셋)은 제외', () => {
    const led = base.map((n) => ({ ...n, s: asStep(n.s + 8) }));
    expect(melodyTokens(led)).toEqual(melodyTokens(base));
  });
});

describe('melodyHash', () => {
  it('64자 hex', async () => {
    expect(await melodyHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('조옮김(+5)·옥타브(+12)는 동일 해시', async () => {
    const h = await melodyHash(base);
    expect(await melodyHash(shift(base, 5))).toBe(h);
    expect(await melodyHash(shift(base, 12))).toBe(h);
  });

  it('리듬(길이)이 다르면 다른 해시', async () => {
    expect(await melodyHash([note(0, 2, 64), note(4, 2, 69), note(8, 4, 67)])).not.toBe(
      await melodyHash(base),
    );
  });

  it('음 사이 쉼표 위치가 다르면 다른 해시', async () => {
    expect(await melodyHash([note(0, 4, 64), note(6, 2, 69), note(8, 4, 67)])).not.toBe(
      await melodyHash(base),
    );
  });

  it('음높이 진행이 다르면 다른 해시', async () => {
    expect(await melodyHash([note(0, 4, 64), note(4, 2, 71), note(8, 4, 67)])).not.toBe(
      await melodyHash(base),
    );
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/community/melody-hash.test.ts`
Expected: FAIL — `Cannot find module './melody-hash'`

- [ ] **Step 3: `src/community/melody-hash.ts` 작성**

```ts
import type { Note } from '../core/types';

/**
 * 멜로디 정규화 토큰: [첫 음 대비 피치 간격, 첫 음 대비 시작 오프셋, 길이].
 * - 피치 델타 → 조옮김·옥타브 이동 불변 (설계 §5.1)
 * - 시작 오프셋이 음 사이 갭(쉼표) 위치·길이를 보존, 첫 음 이전 무음은 제외
 * - 템포·코드·조성·제목·마디 수는 직렬화에 넣지 않는다 — 이것이 §5.1의 구현
 */
export function melodyTokens(notes: readonly Note[]): number[][] {
  const sorted = [...notes].sort((a, b) => a.s - b.s);
  const first = sorted[0];
  if (!first) return [];
  return sorted.map((n) => [n.p - first.p, n.s - first.s, n.d]);
}

export async function melodyHash(notes: readonly Note[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(melodyTokens(notes)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/community/melody-hash.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/community/melody-hash.ts src/community/melody-hash.test.ts
git commit -m "feat(community): add transposition-invariant melody hash"
```

---

### Task 3: Supabase 스키마 파일

**Files:**
- Create: `supabase/schema.sql`

**사용자 액션**: SQL 실행과 OAuth 설정은 사용자가 Supabase 대시보드에서 수행한다(파일 커밋은 에이전트).

- [ ] **Step 1: `supabase/schema.sql` 작성** — 설계 스펙 부록 A 전문을 그대로 복사한다(`docs/superpowers/specs/2026-07-12-community-design.md`의 "부록 A. 통합 SQL 스크립트" 코드 블록 전체). ranking view의 `with (security_invoker = on)` 포함.

- [ ] **Step 2: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(community): add supabase schema with rls and succession trigger"
```

- [ ] **Step 3: 사용자 안내** — ① supabase.com 프로젝트 생성 → ② SQL Editor에서 `supabase/schema.sql` 실행 → ③ Authentication에서 Google OAuth(또는 매직링크) 활성화, redirect URL 등록 → ④ `.env.local`에 URL/anon key 기입. 이후 수동 검증은 이 설정을 전제한다.

---

### Task 4: 라우팅 (TDD)

**Files:**
- Create: `src/community/routing.ts`, `src/community/routing.test.ts`

**Interfaces:**
- Produces:
  - `type Route = {name:'legacyView'} | {name:'feed'} | {name:'edit'} | {name:'ranking'} | {name:'publish'} | {name:'lick';id:string} | {name:'user';publicId:string} | {name:'me'} | {name:'notfound'}`
  - `parseRoute(pathname: string, search: string): Route` (순수)
  - `navigate(path: string): void` (pushState + popstate 이벤트 디스패치)
  - `useRoute(): Route` (React 훅 — popstate 구독)

- [ ] **Step 1: 실패하는 테스트 작성** — `src/community/routing.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { parseRoute } from './routing';

describe('parseRoute', () => {
  it('mode=view 쿼리는 레거시 열람 (경로 무관, 하위 호환)', () => {
    expect(parseRoute('/', '?mode=view')).toEqual({ name: 'legacyView' });
    expect(parseRoute('/', '?mode=view&x=1')).toEqual({ name: 'legacyView' });
  });

  it('경로를 라우트로 해석', () => {
    expect(parseRoute('/', '')).toEqual({ name: 'feed' });
    expect(parseRoute('/edit', '')).toEqual({ name: 'edit' });
    expect(parseRoute('/ranking', '')).toEqual({ name: 'ranking' });
    expect(parseRoute('/publish', '')).toEqual({ name: 'publish' });
    expect(parseRoute('/me', '')).toEqual({ name: 'me' });
    expect(parseRoute('/lick/kX9-3fA_2bQ', '')).toEqual({ name: 'lick', id: 'kX9-3fA_2bQ' });
    expect(parseRoute('/user/Zq81wLm4', '')).toEqual({ name: 'user', publicId: 'Zq81wLm4' });
  });

  it('모르는 경로는 notfound', () => {
    expect(parseRoute('/lick/', '')).toEqual({ name: 'notfound' });
    expect(parseRoute('/xyz', '')).toEqual({ name: 'notfound' });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/community/routing.test.ts`
Expected: FAIL — `Cannot find module './routing'`

- [ ] **Step 3: `src/community/routing.ts` 작성**

```ts
import { useEffect, useState } from 'react';

export type Route =
  | { name: 'legacyView' }
  | { name: 'feed' }
  | { name: 'edit' }
  | { name: 'ranking' }
  | { name: 'publish' }
  | { name: 'lick'; id: string }
  | { name: 'user'; publicId: string }
  | { name: 'me' }
  | { name: 'notfound' };

export function parseRoute(pathname: string, search: string): Route {
  if (new URLSearchParams(search).get('mode') === 'view') return { name: 'legacyView' };
  if (pathname === '/') return { name: 'feed' };
  if (pathname === '/edit') return { name: 'edit' };
  if (pathname === '/ranking') return { name: 'ranking' };
  if (pathname === '/publish') return { name: 'publish' };
  if (pathname === '/me') return { name: 'me' };
  const lick = /^\/lick\/([A-Za-z0-9_-]+)$/.exec(pathname);
  if (lick?.[1]) return { name: 'lick', id: lick[1] };
  const user = /^\/user\/([A-Za-z0-9_-]+)$/.exec(pathname);
  if (user?.[1]) return { name: 'user', publicId: user[1] };
  return { name: 'notfound' };
}

/** SPA 네비게이션. hash(곡 blob)는 인자로 함께 넘길 수 있다 (예: '/edit#v1.…'). */
export function navigate(path: string): void {
  history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    parseRoute(window.location.pathname, window.location.search),
  );
  useEffect(() => {
    const onPop = (): void =>
      setRoute(parseRoute(window.location.pathname, window.location.search));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return route;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/community/routing.test.ts && npm run typecheck`
Expected: PASS (3 tests), 타입 무오류

- [ ] **Step 5: Commit**

```bash
git add src/community/routing.ts src/community/routing.test.ts
git commit -m "feat(community): add path router with legacy view compat"
```

---

### Task 5: API 레이어

**Files:**
- Create: `src/community/api/auth.ts`, `src/community/api/profiles.ts`, `src/community/api/licks.ts`, `src/community/api/likes.ts`, `src/community/api/likes.test.ts`

**Interfaces:**
- Consumes: `supabase` (Task 1)
- Produces:
  - auth: `getSessionUser():Promise<User|null>`, `signInWithGoogle()`, `signOut():Promise<void>`, `onAuthChange(cb:(u:User|null)=>void):() => void`
  - profiles: `type Profile`, `fetchProfileByPublicId(pid):Promise<Profile|null>`, `fetchProfileById(id):Promise<Profile|null>`
  - licks: `type LickRow`, `type RankingRow`, `PAGE_SIZE=20`, `fetchFeedPage(cursor,authorId?)`, `fetchLick(id)`, `publishLick(title,blob,hash):Promise<PublishResult>`, `deleteLick(id)`, `fetchRankingPage(offset)`
  - likes(순수): `likeTargetId`, `canonicalIds`, `toCountMap`, `appendDeduped`
  - likes(api): `fetchLikeCounts(ids)`, `fetchMyLikedSet(userId)`, `addLike(target)`, `removeLike(target)`

- [ ] **Step 1: 실패하는 테스트 작성 (순수 헬퍼)** — `src/community/api/likes.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { appendDeduped, canonicalIds, likeTargetId, toCountMap } from './likes';

describe('likeTargetId', () => {
  it('유사릭이면 원본 id, 원본이면 자기 id (설계 §7)', () => {
    expect(likeTargetId({ id: 'a', canonical_id: null })).toBe('a');
    expect(likeTargetId({ id: 'b', canonical_id: 'a' })).toBe('a');
  });
});

describe('canonicalIds', () => {
  it('카운트 대상 = 원본 id 집합 (중복 제거)', () => {
    expect(
      canonicalIds([
        { id: 'a', canonical_id: null },
        { id: 'b', canonical_id: 'a' },
        { id: 'c', canonical_id: null },
      ]),
    ).toEqual(['a', 'c']);
  });
});

describe('toCountMap', () => {
  it('likes 행 → lick_id별 카운트', () => {
    const m = toCountMap([{ lick_id: 'a' }, { lick_id: 'a' }, { lick_id: 'c' }]);
    expect(m.get('a')).toBe(2);
    expect(m.get('c')).toBe(1);
    expect(m.get('x')).toBeUndefined();
  });
});

describe('appendDeduped', () => {
  it('랭킹 offset 스크롤: 순위 드리프트 중복 제거 (설계 §8.5)', () => {
    expect(appendDeduped([{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }])).toEqual([
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/community/api/likes.test.ts`
Expected: FAIL — `Cannot find module './likes'`

- [ ] **Step 3: `src/community/api/likes.ts` 작성**

```ts
import { supabase } from '../supabase';

type CanonicalRef = { id: string; canonical_id: string | null };

/** 좋아요는 항상 원본 id로 기록 (설계 §7) */
export const likeTargetId = (l: CanonicalRef): string => l.canonical_id ?? l.id;

/** 목록에서 좋아요 카운트를 조회할 원본 id 집합 (설계 §8.2) */
export const canonicalIds = (ls: readonly CanonicalRef[]): string[] => [
  ...new Set(ls.map(likeTargetId)),
];

export const toCountMap = (rows: readonly { lick_id: string }[]): Map<string, number> =>
  rows.reduce((m, r) => m.set(r.lick_id, (m.get(r.lick_id) ?? 0) + 1), new Map<string, number>());

/** 랭킹 offset 스크롤의 순위 드리프트 중복 제거 (설계 §8.5) */
export const appendDeduped = <T extends { id: string }>(
  cur: readonly T[],
  next: readonly T[],
): T[] => {
  const seen = new Set(cur.map((x) => x.id));
  return [...cur, ...next.filter((x) => !seen.has(x.id))];
};

export async function fetchLikeCounts(ids: readonly string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const { data } = await supabase.from('likes').select('lick_id').in('lick_id', [...ids]);
  return toCountMap(data ?? []);
}

export async function fetchMyLikedSet(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from('likes').select('lick_id').eq('user_id', userId);
  return new Set((data ?? []).map((r) => r.lick_id));
}

export async function addLike(target: string): Promise<void> {
  const { error } = await supabase.from('likes').insert({ lick_id: target });
  if (error && error.code !== '23505') throw error; // 중복 클릭은 무해
}

export async function removeLike(target: string): Promise<void> {
  // RLS delete 정책이 본인 행만 지우도록 보장
  const { error } = await supabase.from('likes').delete().eq('lick_id', target);
  if (error) throw error;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/community/api/likes.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: `src/community/api/auth.ts` 작성**

```ts
import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export async function getSessionUser(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

export function signInWithGoogle(): Promise<unknown> {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** 반환값은 구독 해제 함수 */
export function onAuthChange(cb: (user: User | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_evt, session) => cb(session?.user ?? null));
  return () => data.subscription.unsubscribe();
}
```

- [ ] **Step 6: `src/community/api/profiles.ts` 작성**

```ts
import { supabase } from '../supabase';

export interface Profile {
  id: string;
  public_id: string;
  display_name: string;
  avatar_url: string | null;
}

const COLS = 'id, public_id, display_name, avatar_url';

export async function fetchProfileByPublicId(publicId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select(COLS).eq('public_id', publicId).maybeSingle();
  return data as Profile | null;
}

export async function fetchProfileById(id: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select(COLS).eq('id', id).maybeSingle();
  return data as Profile | null;
}
```

- [ ] **Step 7: `src/community/api/licks.ts` 작성**

```ts
import { supabase } from '../supabase';

export const PAGE_SIZE = 20;

export interface LickRow {
  id: string;
  title: string;
  blob: string;
  author_id: string;
  canonical_id: string | null;
  created_at: string;
  profiles: { public_id: string; display_name: string } | null;
}

const LICK_COLS = 'id, title, blob, author_id, canonical_id, created_at, profiles(public_id, display_name)';

/** keyset 커서 무한 스크롤 (설계 §8.5). authorId를 주면 유저 페이지/내 릭. */
export async function fetchFeedPage(cursor: string | null, authorId?: string): Promise<LickRow[]> {
  let q = supabase
    .from('licks')
    .select(LICK_COLS)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (cursor) q = q.lt('created_at', cursor);
  if (authorId) q = q.eq('author_id', authorId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as LickRow[];
}

export async function fetchLick(id: string): Promise<LickRow | null> {
  const { data } = await supabase.from('licks').select(LICK_COLS).eq('id', id).maybeSingle();
  return data as unknown as LickRow | null;
}

export type PublishResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'duplicate' | 'error'; message?: string };

/** 게시 흐름 (설계 §10): 원본 탐색 → canonical_id 지정 insert → 23505는 본인 재게시 */
export async function publishLick(
  title: string,
  blob: string,
  melodyHash: string,
): Promise<PublishResult> {
  const { data: canonical } = await supabase
    .from('licks')
    .select('id')
    .eq('melody_hash', melodyHash)
    .is('canonical_id', null)
    .maybeSingle();
  const { data, error } = await supabase
    .from('licks')
    .insert({ title, blob, melody_hash: melodyHash, canonical_id: canonical?.id ?? null })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') return { ok: false, reason: 'duplicate' };
    return { ok: false, reason: 'error', message: error.message };
  }
  return { ok: true, id: data.id };
}

export async function deleteLick(id: string): Promise<void> {
  // 원본이면 DB trigger가 승계를 처리 (설계 §9)
  const { error } = await supabase.from('licks').delete().eq('id', id);
  if (error) throw error;
}

export interface RankingRow {
  id: string;
  title: string;
  blob: string;
  created_at: string;
  author_public_id: string;
  author_name: string;
  avatar_url: string | null;
  like_count: number;
}

/** 랭킹은 offset 방식 (설계 §8.5) — append 시 appendDeduped 필수 */
export async function fetchRankingPage(offset: number): Promise<RankingRow[]> {
  const { data, error } = await supabase
    .from('ranking')
    .select('*')
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;
  return (data ?? []) as RankingRow[];
}
```

- [ ] **Step 8: 게이트**

Run: `npm run typecheck && npm run lint && npx vitest run src/community/api/likes.test.ts`
Expected: 무오류, PASS

- [ ] **Step 9: Commit**

```bash
git add src/community/api
git commit -m "feat(community): add supabase auth, profiles, licks and likes api"
```

---

### Task 6: Root 라우터 통합 + 헤더

**Files:**
- Create: `src/community/Root.tsx`, `src/community/components/CommunityHeader.tsx`, `src/community/hooks/useInfiniteScroll.ts`, `src/community/community.css`, `src/community/views/NotFound.tsx`, 임시 스텁 뷰 6개(`Feed.tsx`, `Ranking.tsx`, `Publish.tsx`, `LickDetail.tsx`, `UserPage.tsx`, `MyLicks.tsx`)
- Modify: `src/main.tsx`
- Create: `src/community/Root.test.tsx`

**Interfaces:**
- Consumes: `useRoute`, `navigate` (Task 4), auth (Task 5), 기존 `App`, `Player`, `HashStore`
- Produces: `<Root player hashStore />`, `<CommunityHeader user route onSignIn onSignOut />`, `useInfiniteScroll(onLoadMore)`. 각 뷰는 `(props)=>JSX` — Task 7~10에서 실제 구현으로 교체.

- [ ] **Step 1: `src/community/hooks/useInfiniteScroll.ts` 작성**

```ts
import { useEffect, useRef } from 'react';

/**
 * sentinel이 보이면 onLoadMore() 호출 (설계 §8.5). onLoadMore가 false를 반환하면 관찰 중단.
 * 반환한 ref를 목록 끝 요소에 부착한다. 동시 호출은 가드.
 */
export function useInfiniteScroll(onLoadMore: () => Promise<boolean>): (el: HTMLElement | null) => void {
  const busy = useRef(false);
  const cb = useRef(onLoadMore);
  cb.current = onLoadMore;
  const io = useRef<IntersectionObserver | null>(null);

  useEffect(() => () => io.current?.disconnect(), []);

  return (el: HTMLElement | null): void => {
    io.current?.disconnect();
    if (!el) return;
    io.current = new IntersectionObserver(async (entries) => {
      if (!entries.some((e) => e.isIntersecting) || busy.current) return;
      busy.current = true;
      const hasMore = await cb.current();
      busy.current = false;
      if (!hasMore) io.current?.disconnect();
    });
    io.current.observe(el);
  };
}
```

- [ ] **Step 2: `src/community/community.css` 작성** — 토큰만 사용. 최소 레이아웃 클래스: `.community`(max-width 컨테이너), `.c-header`(하단 2px ink), `.c-nav a`(11px/600, `.active`=red), `.c-card`(1px ink, radius 3, 12px), `.c-card .c-title`, `.c-meta`(11px mut2, gap), `.c-eyebrow`(9px letter-spacing .22em mut2), `.c-state`(중앙 11px mut), `.c-toast`, `.c-like.on`(배경 ink/색 white), `.c-danger`(border/color red). 기존 `src/styles/tokens.css`·`global.css`와 충돌하지 않는 `c-` 프리픽스.

- [ ] **Step 3: `src/community/components/CommunityHeader.tsx` 작성**

```tsx
import type { JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import { navigate, type Route } from '../routing';

interface Props {
  readonly user: User | null;
  readonly route: Route;
  readonly onSignIn: () => void;
  readonly onSignOut: () => void;
}

const NavLink = ({ to, label, active }: { to: string; label: string; active: boolean }): JSX.Element => (
  <a
    href={to}
    className={active ? 'active' : ''}
    onClick={(e) => {
      e.preventDefault();
      navigate(to);
    }}
  >
    {label}
  </a>
);

export const CommunityHeader = ({ user, route, onSignIn, onSignOut }: Props): JSX.Element => (
  <header className="c-header">
    <NavLink to="/" label="ScoreLink" active={false} />
    <nav className="c-nav">
      <NavLink to="/" label="최신" active={route.name === 'feed'} />
      <NavLink to="/ranking" label="랭킹" active={route.name === 'ranking'} />
      <NavLink to="/edit" label="만들기" active={route.name === 'edit'} />
      <NavLink to="/publish" label="게시" active={route.name === 'publish'} />
      {user ? (
        <>
          <NavLink to="/me" label="내 릭" active={route.name === 'me'} />
          <button type="button" className="c-linkbtn" onClick={onSignOut}>
            로그아웃
          </button>
        </>
      ) : (
        <button type="button" className="c-linkbtn" onClick={onSignIn}>
          Google 로그인
        </button>
      )}
    </nav>
  </header>
);
```

- [ ] **Step 4: 임시 스텁 뷰 6개 + NotFound 작성** — 각 파일은 최소 렌더만. 예: `src/community/views/Feed.tsx`:

```tsx
import type { JSX } from 'react';
export const Feed = (): JSX.Element => <p className="c-state">최신 — 준비 중</p>;
```

동일 패턴으로 `Ranking`, `Publish`, `LickDetail`, `UserPage`, `MyLicks`, `NotFound`(문구 "없는 페이지예요"). Task 7~10에서 실제 구현으로 교체하되, 실제 시그니처(props)는 각 태스크가 정의한다. 스텁은 no-arg로 두고, Root에서 필요한 props를 넘길 때 함께 확정한다.

- [ ] **Step 5: `src/community/Root.tsx` 작성**

```tsx
import { useCallback, useEffect, useState, type JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Player } from '../adapters/player';
import type { HashStore } from '../ports/hash-store';
import { App } from '../ui/components/App';
import { getSessionUser, onAuthChange, signInWithGoogle, signOut } from './api/auth';
import { CommunityHeader } from './components/CommunityHeader';
import { navigate, useRoute } from './routing';
import { Feed } from './views/Feed';
import { LickDetail } from './views/LickDetail';
import { MyLicks } from './views/MyLicks';
import { NotFound } from './views/NotFound';
import { Publish } from './views/Publish';
import { Ranking } from './views/Ranking';
import { UserPage } from './views/UserPage';
import './community.css';

interface Props {
  readonly player: Player;
  readonly hashStore: HashStore;
}

export const Root = ({ player, hashStore }: Props): JSX.Element => {
  const route = useRoute();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    void getSessionUser().then(setUser);
    return onAuthChange(setUser);
  }, []);

  const onSignIn = useCallback(() => void signInWithGoogle(), []);
  const onSignOut = useCallback(() => {
    void signOut().then(() => navigate('/'));
  }, []);

  // 편집기·레거시 열람은 기존 App을 그대로 마운트 (커뮤니티 헤더 없음)
  if (route.name === 'edit') return <App player={player} hashStore={hashStore} initialMode="edit" />;
  if (route.name === 'legacyView')
    return <App player={player} hashStore={hashStore} initialMode="view" />;

  const view = ((): JSX.Element => {
    switch (route.name) {
      case 'feed':
        return <Feed user={user} player={player} />;
      case 'ranking':
        return <Ranking player={player} />;
      case 'publish':
        return <Publish user={user} />;
      case 'lick':
        return <LickDetail id={route.id} user={user} player={player} />;
      case 'user':
        return <UserPage publicId={route.publicId} player={player} />;
      case 'me':
        return <MyLicks user={user} player={player} />;
      default:
        return <NotFound />;
    }
  })();

  return (
    <div className="community">
      <CommunityHeader user={user} route={route} onSignIn={onSignIn} onSignOut={onSignOut} />
      {view}
    </div>
  );
};
```

주의: 스텁 뷰(Step 4)는 no-arg다. 이 Root는 실제 props를 넘기므로, **Step 4 스텁의 시그니처를 이 Root가 넘기는 props와 맞춘다**(각 뷰 함수의 인자를 `(_props: { … })`로 받아 무시). Task 7~10에서 본 구현으로 교체될 때 동일 props를 사용한다. props 계약:
- `Feed`: `{ user: User|null; player: Player }`
- `Ranking`: `{ player: Player }`
- `Publish`: `{ user: User|null }`
- `LickDetail`: `{ id: string; user: User|null; player: Player }`
- `UserPage`: `{ publicId: string; player: Player }`
- `MyLicks`: `{ user: User|null; player: Player }`

- [ ] **Step 6: `src/main.tsx` 수정** — App 대신 Root 마운트. player/hashStore 생성부는 유지.

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createLocationHashStore } from './adapters/location-hash-store';
import { createPlayer } from './adapters/player';
import { createRafClock } from './adapters/raf-clock';
import { createWebAudioSink } from './adapters/web-audio-sink';
import { Root } from './community/Root';
import './styles/tokens.css';
import './styles/global.css';

const audioCtx = new AudioContext();
document.addEventListener('pointerdown', () => {
  if (audioCtx.state === 'suspended') void audioCtx.resume();
});

const player = createPlayer({
  sink: createWebAudioSink(audioCtx),
  clock: createRafClock(),
});
const hashStore = createLocationHashStore();

const root = document.getElementById('root');
if (!root) throw new Error('#root 요소가 없습니다');
createRoot(root).render(
  <StrictMode>
    <Root player={player} hashStore={hashStore} />
  </StrictMode>,
);
```

- [ ] **Step 7: `src/community/Root.test.tsx` 작성** — 라우팅 스모크 테스트. testing-library로 `history.pushState`한 뒤 Root 렌더 → 각 경로가 맞는 스텁을 그린다. auth와 supabase는 모듈 목으로 차단.

```tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../community/api/auth', () => ({
  getSessionUser: () => Promise.resolve(null),
  onAuthChange: () => () => {},
  signInWithGoogle: () => {},
  signOut: () => Promise.resolve(),
}));

import { Root } from './Root';

const fakePlayer = {
  play: vi.fn(),
  stop: vi.fn(),
  isPlaying: () => false,
  onTick: () => () => {},
  onEnded: () => () => {},
  preview: vi.fn(),
  toggleAcc: vi.fn(),
  toggleMetro: vi.fn(),
} as unknown as import('../adapters/player').Player;
const fakeHashStore = { read: () => '', write: () => {} };

const renderAt = (path: string): void => {
  window.history.pushState(null, '', path);
  render(<Root player={fakePlayer} hashStore={fakeHashStore} />);
};

describe('Root 라우팅', () => {
  beforeEach(() => {
    window.history.pushState(null, '', '/');
  });

  it('/ 는 피드 스텁', () => {
    renderAt('/');
    expect(screen.getByText(/최신/)).toBeTruthy();
  });

  it('/ranking 은 랭킹 스텁', () => {
    renderAt('/ranking');
    expect(screen.getByText(/랭킹/)).toBeTruthy();
  });

  it('알 수 없는 경로는 NotFound', () => {
    renderAt('/zzz');
    expect(screen.getByText(/없는 페이지/)).toBeTruthy();
  });
});
```

(참고: 기존 `src/test-setup.ts`가 jsdom 목을 세팅한다. Player 타입의 실제 메서드 이름은 `src/adapters/player.ts`를 열어 맞출 것.)

- [ ] **Step 8: 게이트**

Run: `npm run typecheck && npm run lint && npx vitest run src/community/Root.test.tsx src/community/routing.test.ts && npm run check-smp`
Expected: 무오류, PASS. 수동: `npm run dev` → `/`(피드 스텁), `/edit`(기존 편집기), `/?mode=view#v1.…`(기존 열람) 동작 확인.

- [ ] **Step 9: Commit**

```bash
git add src/community/Root.tsx src/community/Root.test.tsx src/community/components/CommunityHeader.tsx src/community/hooks/useInfiniteScroll.ts src/community/community.css src/community/views src/main.tsx
git commit -m "feat(community): add root router, header and editor integration"
```

---

### Task 7: 피드 + 릭 카드

**Files:**
- Create: `src/community/components/LickCard.tsx`
- Modify: `src/community/views/Feed.tsx`, `src/community/views/MyLicks.tsx`(스텁 → renderFeed 재사용은 Task 10에서 완성; 여기서는 Feed만)

**Interfaces:**
- Consumes: `fetchFeedPage`, `PAGE_SIZE`, `LickRow`, `deleteLick`, `canonicalIds`, `fetchLikeCounts`, `likeTargetId`, `decodeSong`, `<Score mode="view">`, `navigate`, `useInfiniteScroll`
- Produces: `<LickCard lick likeCount onDelete? />`, `<Feed user player />` (설계 §8.2)

- [ ] **Step 1: `src/community/components/LickCard.tsx` 작성** — `decodeSong(lick.blob)` → `<Score song mode="view" width={420} onNoteTap={()=>navigate('/lick/'+lick.id)} />`(카드 탭=상세 이동). 제목·작성자(탭→`/user/:public_id`)·좋아요 수·날짜·유사릭 배지 표시. `onDelete`가 있으면 `c-danger` 삭제 버튼. blob 디코딩 실패 시 안내 문구. 작성자 이름은 `lick.profiles?.display_name`.

```tsx
import type { JSX } from 'react';
import { decodeSong } from '../../core/codec';
import { Score } from '../../ui/components/edit/Score';
import type { LickRow } from '../api/licks';
import { navigate } from '../routing';

interface Props {
  readonly lick: LickRow;
  readonly likeCount: number;
  readonly onDelete?: (() => void) | undefined;
}

export const LickCard = ({ lick, likeCount, onDelete }: Props): JSX.Element => {
  const song = decodeSong(lick.blob);
  return (
    <article className="c-card">
      <button type="button" className="c-cardhit" onClick={() => navigate('/lick/' + lick.id)}>
        <div className="c-title">{lick.title}</div>
        {song ? <Score song={song} mode="view" width={420} /> : <p className="c-state">악보를 읽을 수 없어요</p>}
      </button>
      <div className="c-meta">
        {lick.profiles && (
          <a
            href={'/user/' + lick.profiles.public_id}
            onClick={(e) => {
              e.preventDefault();
              navigate('/user/' + lick.profiles!.public_id);
            }}
          >
            {lick.profiles.display_name}
          </a>
        )}
        <span>♥ {likeCount}</span>
        <span>{new Date(lick.created_at).toLocaleDateString('ko-KR')}</span>
        {lick.canonical_id && <span>유사릭</span>}
        {onDelete && (
          <button type="button" className="c-danger" onClick={onDelete}>
            삭제
          </button>
        )}
      </div>
    </article>
  );
};
```

(주의: `Score`를 `onNoteTap` 없이 view 모드로 렌더할 때 개별 음표 탭이 재생을 트리거하지 않도록, 카드에서는 `onNoteTap`을 넘기지 않고 카드 전체 버튼으로 상세 이동만 처리한다. Score가 view 모드에서 onNoteTap 필수인지 파일에서 확인하고, 필요하면 no-op 전달.)

- [ ] **Step 2: `src/community/views/Feed.tsx` 작성** — keyset 커서 상태 + `useInfiniteScroll`. `authorId?`를 받는 내부 훅으로 만들어 UserPage/MyLicks가 재사용하도록 설계(공용 `useLickFeed(authorId?)` 훅을 `hooks/`에 두거나 Feed에 authorId prop 추가). 여기서는 Feed에 `authorId?`·`deletable?` prop을 추가해 Task 10이 재사용한다.

```tsx
import { useCallback, useRef, useState, type JSX } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Player } from '../../adapters/player';
import { PAGE_SIZE, deleteLick, fetchFeedPage, type LickRow } from '../api/licks';
import { canonicalIds, fetchLikeCounts, likeTargetId } from '../api/likes';
import { LickCard } from '../components/LickCard';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

interface Props {
  readonly user?: User | null;
  readonly player?: Player;
  readonly authorId?: string;
  readonly deletable?: boolean;
}

export const Feed = ({ authorId, deletable }: Props): JSX.Element => {
  const [licks, setLicks] = useState<LickRow[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [done, setDone] = useState(false);
  const cursor = useRef<string | null>(null);

  const loadMore = useCallback(async (): Promise<boolean> => {
    const page = await fetchFeedPage(cursor.current, authorId);
    cursor.current = page.at(-1)?.created_at ?? cursor.current;
    const c = await fetchLikeCounts(canonicalIds(page));
    setCounts((prev) => new Map([...prev, ...c]));
    setLicks((prev) => [...prev, ...page]);
    const hasMore = page.length === PAGE_SIZE;
    if (!hasMore) setDone(true);
    return hasMore;
  }, [authorId]);

  const sentinelRef = useInfiniteScroll(loadMore);

  const onDelete = (lick: LickRow) => async (): Promise<void> => {
    if (!window.confirm('이 릭을 삭제할까요? 원본이면 좋아요는 다음 유사릭이 승계해요.')) return;
    await deleteLick(lick.id);
    setLicks((prev) => prev.filter((x) => x.id !== lick.id));
  };

  return (
    <div>
      {licks.map((lick) => (
        <LickCard
          key={lick.id}
          lick={lick}
          likeCount={counts.get(likeTargetId(lick)) ?? 0}
          onDelete={deletable ? onDelete(lick) : undefined}
        />
      ))}
      <div ref={sentinelRef} className="c-sentinel" />
      <p className="c-state">{done ? (licks.length ? '끝이에요' : '아직 게시된 릭이 없어요') : '불러오는 중…'}</p>
    </div>
  );
};
```

- [ ] **Step 3: 테스트** — `src/community/views/Feed.test.tsx`. `../api/licks`·`../api/likes` 목으로 1페이지(2건) 반환 → 카드 2개 렌더·좋아요 수 표시 검증. IntersectionObserver는 test-setup 목 또는 수동 목.

- [ ] **Step 4: 게이트 + Commit**

Run: `npm run typecheck && npm run lint && npx vitest run src/community/views/Feed.test.tsx && npm run check-smp`

```bash
git add src/community/components/LickCard.tsx src/community/views/Feed.tsx src/community/views/Feed.test.tsx
git commit -m "feat(community): add latest feed with keyset infinite scroll"
```

---

### Task 8: 게시 화면

**Files:**
- Modify: `src/community/views/Publish.tsx`
- Create: `src/community/views/Publish.test.tsx`

**Interfaces:**
- Consumes: `decodeSong`, `melodyHash`, `<Score mode="view">`, `publishLick`, `navigate`, `User`
- Produces: `<Publish user />` (설계 §10)

- [ ] **Step 1: `src/community/views/Publish.tsx` 작성** — 로그인 안 했으면 안내. 텍스트에어리어에 공유 URL/`v1.` 해시 붙여넣기 → `extractHash`(URL의 `#` 뒤 or 생 해시에서 `v1.`만) → `decodeSong` → 미리보기 `<Score mode="view">` + 제목 입력 + 게시 버튼. 초기값: `location.hash`에 `#v1.`이 있으면 프리필(편집기→게시 동선). 게시: `melodyHash(song.notes)` → `publishLick` → ok면 `navigate('/lick/'+id)`, `duplicate`면 "이미 게시한 릭이에요" 안내, `error`면 메시지.

`extractHash`는 로컬 헬퍼로 둔다:

```ts
const extractHash = (input: string): string | null => {
  const t = input.trim();
  const i = t.indexOf('#');
  const h = i >= 0 ? t.slice(i + 1) : t;
  return h.startsWith('v1.') ? h : null;
};
```

- [ ] **Step 2: 테스트** — `Publish.test.tsx`: 유효 해시 입력 시 미리보기·게시 버튼 노출, 게시 버튼 클릭 시 `publishLick`(목) 호출·`navigate` 이동. 로그인 null이면 안내 문구. `publishLick`이 duplicate 반환 시 안내 문구.

- [ ] **Step 3: 게이트 + Commit**

```bash
git add src/community/views/Publish.tsx src/community/views/Publish.test.tsx
git commit -m "feat(community): add publish flow with hash paste and dedup"
```

---

### Task 9: 릭 상세

**Files:**
- Modify: `src/community/views/LickDetail.tsx`
- Create: `src/community/views/LickDetail.test.tsx`, `src/community/components/LikeButton.tsx`

**Interfaces:**
- Consumes: `fetchLick`, `deleteLick`, `fetchLikeCounts`, `fetchMyLikedSet`, `addLike`, `removeLike`, `likeTargetId`, `decodeSong`, `<Score mode="view">` 또는 `<Viewer>`, `Player`, `asStep`, `total`(geometry), `navigate`
- Produces: `<LickDetail id user player />`, `<LikeButton liked count onToggle />`

- [ ] **Step 1: `src/community/components/LikeButton.tsx` 작성** — `liked` 상태로 `c-like on` 토글, `count` 표시, 클릭 시 `onToggle()`.

- [ ] **Step 2: `src/community/views/LickDetail.tsx` 작성** — 로딩 후 `fetchLick(id)`. 없으면 안내. `decodeSong(blob)` 실패 시 안내. `target = likeTargetId(lick)`. `fetchLikeCounts([target])` + (로그인 시) `fetchMyLikedSet`. 표시:
  - 제목·작성자(→ `/user/:public_id`)·날짜
  - 유사릭이면 "이 릭은 유사릭이에요. 좋아요는 [원본 릭](→`/lick/:canonical_id`)에 모여요 (♥ N)"
  - 악보: `<Score song mode="view" width={420} onNoteTap={(id)=>playFrom(id)} />` — 음표 탭 = 그 음표부터 재생(기존 Viewer 동작 재현). 재생은 `player.play(song, {melody:true,accomp:false,metro:false}, from, asStep(total(song)))`. 전곡 재생/정지 버튼도.
  - `<LikeButton>` — 낙관적 토글(즉시 UI 반영 후 `addLike`/`removeLike`, 실패 시 롤백 + 안내). 비로그인 클릭 시 로그인 안내.
  - 본인(`user?.id === lick.author_id`) 게시물이면 삭제 버튼 → `deleteLick` 후 `navigate('/')`.
  - 언마운트 시 `player.stop()`.

플레이어 재생 상태는 `player.onEnded`/`player.onTick` 구독 또는 로컬 `playing` state로 관리(App.tsx 패턴 참고). playheadStep을 Score에 넘기려면 onTick 구독. v1은 재생/정지 토글 + (선택) playhead. 최소 요건: 재생·정지·음표 탭 재생.

- [ ] **Step 3: 테스트** — `LickDetail.test.tsx`: `fetchLick` 목으로 원본 릭 반환 → 제목·악보·좋아요 버튼 렌더. 유사릭(canonical_id 있음) 반환 → 원본 링크·원본 카운트 문구. 좋아요 토글 클릭 → `addLike`(목) 호출·카운트 +1. 비로그인 클릭 → 안내. player는 fake.

- [ ] **Step 4: 게이트 + Commit**

```bash
git add src/community/views/LickDetail.tsx src/community/views/LickDetail.test.tsx src/community/components/LikeButton.tsx
git commit -m "feat(community): add lick detail with playback, like and delete"
```

---

### Task 10: 랭킹 · 유저 페이지 · 내 릭

**Files:**
- Modify: `src/community/views/Ranking.tsx`, `src/community/views/UserPage.tsx`, `src/community/views/MyLicks.tsx`
- Create: `src/community/views/Ranking.test.tsx`

**Interfaces:**
- Consumes: `fetchRankingPage`, `appendDeduped`, `RankingRow`, `fetchProfileByPublicId`, `decodeSong`, `<Score mode="view">`, `<Feed authorId deletable>` (Task 7), `useInfiniteScroll`, `navigate`
- Produces: `<Ranking player />`, `<UserPage publicId player />`, `<MyLicks user player />`

- [ ] **Step 1: `Ranking.tsx` 작성** — offset 상태 + `useInfiniteScroll`. `fetchRankingPage(offset)` → `appendDeduped`로 병합(순위 드리프트 중복 제거). 카드: 순위·제목·`<Score view>`·작성자(→`/user/:author_public_id`)·♥count·날짜. 카드 탭 → `/lick/:id`. 원본만 노출됨(view가 canonical 필터).

- [ ] **Step 2: `UserPage.tsx` 작성** — `fetchProfileByPublicId(publicId)` → 없으면 안내. 프로필 헤더(아바타·이름) + `<Feed authorId={profile.id} />` 재사용(무한 스크롤).

- [ ] **Step 3: `MyLicks.tsx` 작성** — `user` 없으면 "로그인이 필요해요". 있으면 `<Feed authorId={user.id} deletable />` 재사용.

- [ ] **Step 4: 테스트** — `Ranking.test.tsx`: `fetchRankingPage` 목 2건 → 순위·좋아요 수 렌더, 좋아요 내림차순. (UserPage/MyLicks는 Feed 재사용이라 스모크 수준.)

- [ ] **Step 5: 게이트 + Commit**

```bash
git add src/community/views/Ranking.tsx src/community/views/Ranking.test.tsx src/community/views/UserPage.tsx src/community/views/MyLicks.tsx
git commit -m "feat(community): add ranking, user page and my licks"
```

---

### Task 11: 문서 (README·e2e·CLAUDE.md)

**Files:**
- Modify: `README.md`, `CLAUDE.md`
- Create: `docs/community-e2e-checklist.md`

- [ ] **Step 1: `README.md`에 커뮤니티 섹션 추가** — 배포 절차(설계 §14): supabase 프로젝트 생성 → `supabase/schema.sql` 실행 → Google OAuth(또는 매직링크) + Site URL 등록 → 정적 배포(Vercel/CF Pages) + 환경 변수 2개 + SPA rewrite(`/(.*)→/index.html`). 게시 방법(편집기 공유 링크를 `/publish`에 붙여넣기).

- [ ] **Step 2: `CLAUDE.md`에 커뮤니티 규칙 추가** — `src/community/`는 ui 동급(supabase·DOM·crypto 허용, core 순수 규칙 밖). 좋아요 대상은 항상 `canonical_id ?? id`. 라우팅은 경로 기반(hash는 곡 blob 점유). service_role key 금지.

- [ ] **Step 3: `docs/community-e2e-checklist.md` 작성** — 로그인/게시/중복 판정/좋아요/목록/삭제·승계/재생 수동 체크리스트(설계 §5·§7·§8·§9 항목별).

- [ ] **Step 4: Commit**

```bash
git add README.md CLAUDE.md docs/community-e2e-checklist.md
git commit -m "docs: add community deploy guide, rules and e2e checklist"
```

---

## Self-Review (스펙 대조)

| 설계 요구 | 태스크 |
|---|---|
| 게시(blob 저장), 재생(decodeSong 재사용) | T5·T8·T9 |
| OAuth + profiles trigger | T3·T5 |
| 좋아요·원본 귀속·이중 카운트 차단 | T3(PK)·T5(likeTargetId)·T9 |
| 랭킹(원본만·실시간 집계) | T3(view)·T10 |
| 최신순 게시판 + 내 릭 | T7·T10 |
| 본인 재게시 차단(unique+23505) | T3·T8 |
| 유사릭 허용 + canonical | T3·T8·T9 |
| 멜로디 단일 기준 동일 판정 | T2 |
| 원본 삭제 승계 | T3(trigger), e2e 검증 |
| 영속 링크 /lick/:id·/user/:public_id | T3(id)·T4(router) |
| 무한 스크롤(keyset+랭킹 offset dedupe) | T5·T6·T7·T10 |
| 하위 호환(v1. 해시·?mode=view) | T4·T6 |
| UI 요구(유사릭 원본 링크·카운트·하트·삭제) | T7·T9 |
| 기존 codec·Score·Viewer·player 재사용 | 전반 |
