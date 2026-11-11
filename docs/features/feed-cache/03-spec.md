# feed-cache: 목록 상태를 라우트 전환 뒤에도 유지 명세

작성일: 2026-11-11. 모델: fable. 상태: 승인됨 (2026-11-11).
이 문서가 구현과 검증의 유일한 기준이다. 기획서 `01-plan.md` 는 참고 자료다. 경량 트랙이라 디자인 문서는 없다.

## 입력과 출력

입력:
- 목록 필터 `authorId: string | undefined`, `tag: string | undefined`. FeedList 가 지금 받는 prop 그대로다.
- 목록 행 `LickRow[]`, 좋아요 수 `Map<string, number>`(키는 `likeTargetId`), 커서 `string | null`, `done: boolean`, 태그 총 개수 `number | null`. FeedList 가 지금 가진 상태다.
- 창 스크롤 위치 `window.scrollY: number`. 스크롤 컨테이너는 모든 폭에서 window 다.
- 마지막 라우트 전환의 종류 `NavKind = 'history' | 'navigate'`. `history` 는 브라우저 뒤로 가기와 앞으로 가기, 첫 로드다. `navigate` 는 `routing.ts` 의 `navigate()` 호출이다.

출력:
- 복원 마운트의 첫 렌더에 스냅샷의 행이 모두 있는 목록 DOM. 첫 페이지 요청과 태그 총 개수 요청이 없다.
- 복원된 `window.scrollY`.
- 부수 효과. 앱 시작 때 `history.scrollRestoration = 'manual'`. 스냅샷 저장소의 읽기와 쓰기.

스냅샷과 키:

```ts
export const feedKey = (authorId: string | undefined, tag: string | undefined): string =>
  (authorId ?? '') + '|' + (tag ?? '');

export interface FeedSnapshot {
  readonly rows: readonly LickRow[];
  readonly counts: ReadonlyMap<string, number>;
  readonly cursor: string | null;
  readonly done: boolean;
  readonly total: number | null;
  readonly scrollY: number;
}

export interface FeedStore {
  get(key: string): FeedSnapshot | undefined;
  set(key: string, snapshot: FeedSnapshot): void;
  appendPage(key: string, rows: readonly LickRow[], counts: ReadonlyMap<string, number>, done: boolean): void;
  setCount(targetId: string, count: number): void;
  remove(lickId: string): void;
  invalidate(key: string): void;
  clear(): void;
}

export const feedStore: FeedStore;
```

`feedKey` 는 지금 Feed 가 리마운트 key 로 쓰는 식과 같다. `scrollY` 는 0 이상의 정수다. `total` 은 태그 피드만 숫자이고 그 외는 null 이다.

DB 스키마, `src/community/api/`, CSS 변경은 없다.

레이어:
- `src/community/feed-store.ts`: 스냅샷 저장소. React 와 DOM 을 import 하지 않는 모듈이다. 단위 테스트는 `src/community/feed-store.test.ts`.
- `src/community/routing.ts`: 전환 종류 표식 `lastNavKind(): NavKind`. `navigate()` 와 `useRoute()` 가 표식을 세우고 옮긴다.
- `src/community/views/Feed.tsx`: FeedList 의 복원, 되쓰기, 스크롤 복원, 삭제 때 `remove`.
- `src/community/views/LickDetail.tsx`: 좋아요 토글 때 `setCount`, 삭제 성공 때 `remove`.
- `src/community/views/Publish.tsx`: 게시 성공 때 `clear`.
- `src/community/views/MyLicks.tsx`: 이름 바꾸기 성공 때 `invalidate`.
- `src/community/Root.tsx`: 마운트 때 `history.scrollRestoration = 'manual'`. `main.tsx` 는 단위 테스트가 없으므로 Root 에 둔다.

## 규칙

R1. 키.
    저장소의 키는 `feedKey(authorId, tag)` 다. Latest 는 `'|'`, 태그 피드는 `'|jazz'`, 작성자 피드는 `'<uuid>|'` 다.
    내 릭(`/me`)과 내 유저 페이지(`/user/<내 public_id>`)는 authorId 가 같아 같은 키를 쓴다. `deletable` 은 키에 들어가지 않는다.
R2. 저장소 API.
    `get` 은 스냅샷을 돌려주고 없으면 undefined 다.
    `set` 은 그 키의 스냅샷을 통째로 바꾼다.
    `appendPage` 는 행을 뒤에 잇고, counts 를 합치며(같은 키는 새 값), `done` 을 인자로 바꾸고, 커서를 이은 행의 마지막 `created_at` 으로 바꾼다. 행이 비면 커서와 행은 그대로고 `done` 만 바꾼다. 키에 스냅샷이 없으면 아무것도 하지 않는다. 이 기능에서는 부르는 곳이 없고 다음 기능 `lick-page` 의 플레이어가 쓴다.
    `setCount` 는 모든 스냅샷의 counts 에 `targetId` 를 `count` 로 넣는다. 그 대상 행이 없는 스냅샷에도 넣는다.
    `remove` 는 모든 스냅샷에서 `id` 가 같은 행을 뺀다. counts, 커서, `done`, `total`, `scrollY` 는 그대로다. 커서가 뺀 행의 `created_at` 이어도 바꾸지 않는다(keyset 조건 `created_at < cursor` 는 그대로 성립한다).
    `invalidate` 는 그 키의 스냅샷을 지운다. `clear` 는 전부 지운다.
    저장소는 모듈 수준 Map 하나다. 탭마다 따로이고 새로고침이면 빈다. 크기 상한은 두지 않는다(키마다 하나, 세션 한정).
R3. 전환 종류 표식 (routing.ts).
    모듈 변수 `pending: NavKind` 와 `last: NavKind` 를 둔다. 초기값은 둘 다 `'history'` 다.
    `navigate(path)` 는 `pushState` 뒤, 합성 popstate 를 보내기 직전에 `pending = 'navigate'` 로 둔다.
    `useRoute` 의 popstate 핸들러는 라우트를 바꾸기 전에 `last = pending; pending = 'history'` 를 한다.
    `lastNavKind()` 는 `last` 를 돌려준다. 첫 로드는 `'history'` 이고 스냅샷이 없어 새로 받는다.
    `navigate()` 를 거치지 않은 합성 popstate(지금은 PlayOverlay 의 복제 편집)는 `'history'` 로 기록된다. 그 전환은 편집기로 가므로 목록 복원과 무관하다.
R4. 브라우저 자동 복원 끄기.
    Root 는 마운트 때 `history.scrollRestoration = 'manual'` 로 둔다. 한 번만 두고 되돌리지 않는다.
    이유는 둘이다. 브라우저가 history 전환 때 스스로 움직이는 스크롤이 R7 의 복원과 겹치지 않게 한다. 목록을 뒤로 가기로 떠날 때 브라우저가 목적지 항목의 위치로 먼저 움직여 R8 이 틀린 값을 읽는 일을 막는다.
    새로고침은 저장소가 비어 맨 위에서 시작하므로 잃는 것이 없다.
R5. 복원 조건과 복원 마운트.
    FeedList 는 마운트 때 `lastNavKind() === 'history'` 이고 `feedStore.get(key)` 가 있으며 그 `rows.length > 0` 이면 복원 마운트다. 셋 중 하나라도 아니면 새 마운트다.
    복원 마운트는 useState 초기값을 스냅샷에서 가져온다. 행, counts, 커서, `done`, `total` 이 첫 렌더에 모두 있고 `loaded` 는 true, `error` 는 false 다.
    복원 마운트는 첫 페이지 요청(`fetchFeedPage`)과 태그 총 개수 요청(`countLicks`)을 하지 않는다.
    새 마운트는 지금과 같다. 저장소에 남아 있던 스냅샷은 읽지 않고, 언마운트 때 R6 이 덮어쓴다.
R6. 되쓰기.
    FeedList 는 언마운트 때 `rows.length > 0` 이면 `feedStore.set(key, { rows, counts, cursor, done, total, scrollY })` 를 한다.
    `rows.length === 0` 이면 `feedStore.invalidate(key)` 를 한다. 첫 페이지가 실패했거나 빈 목록이었던 키에 옛 스냅샷이 남아 뒤에 복원되는 일을 막는다.
    에러 여부, 삭제 다이얼로그, 오버레이 인덱스는 저장하지 않는다.
R7. 스크롤 복원.
    복원 마운트는 useLayoutEffect 에서 `window.scrollTo(0, snapshot.scrollY)` 를 부르고, 같은 이펙트에서 `requestAnimationFrame` 으로 한 번 더 같은 호출을 예약한다. 두 번째 호출은 카드의 악보 폭이 실측값으로 다시 그려져 카드 높이가 바뀐 뒤의 보정이다(E1). 둘 다 첫 그리기 전에 끝난다.
    문서가 그 위치를 허용하지 않으면 브라우저가 허용 최대값으로 자른다. 그 값을 그대로 둔다.
    새 마운트는 스크롤을 건드리지 않는다.
R8. scrollY 저장 시점.
    FeedList 는 useLayoutEffect 의 정리 함수에서 `window.scrollY` 를 읽어 `Math.round` 한 값을 R6 의 `scrollY` 로 쓴다.
    React 는 삭제되는 서브트리의 레이아웃 정리를 그 DOM 을 떼기 전에 부르고, 새 뷰의 DOM 은 그 뒤에 넣는다. 그래서 이 시점의 `scrollY` 는 떠나는 순간의 값이다. R4 가 브라우저의 선행 복원을 막아 이 값이 바뀌지 않는다.
    R6 의 저장과 R8 의 읽기는 같은 정리 함수에서 한다.
R9. 게시 성공.
    `Publish` 는 `publishLick` 결과가 ok 이면 `navigate('/lick/' + id)` 전에 `feedStore.clear()` 를 부른다.
R10. 삭제 성공.
    `LickDetail` 은 `deleteLick` 이 끝나면 `navigate('/me')` 전에 `feedStore.remove(lick.id)` 를 부른다.
    FeedList 의 삭제 다이얼로그도 `deleteLick` 이 끝나면 상태에서 행을 빼는 것과 함께 `feedStore.remove(id)` 를 부른다. 다른 키(Latest, 태그 피드)의 스냅샷에서도 빠지게 하기 위해서다.
R11. 상세의 좋아요.
    `LickDetail` 의 낙관적 토글은 화면 수를 바꾸는 것과 함께 `feedStore.setCount(likeTargetId(lick), 바뀐 수)` 를 부른다.
    요청이 실패해 되돌릴 때도 `feedStore.setCount(likeTargetId(lick), 되돌린 수)` 를 부른다.
R12. 내 릭의 이름 바꾸기.
    `MyLicksView` 는 `updateDisplayName` 이 ok 이면 `renames` 를 올리기 전에 `feedStore.invalidate(feedKey(user.id, undefined))` 를 부른다. 리마운트된 Feed 는 스냅샷이 없어 새로 받고 카드의 작성자 이름이 새 이름이다.
    거절되면 부르지 않는다.
R13. 에러는 캐시하지 않는다.
    복원 마운트는 `error` 를 false 로 시작한다. 스냅샷에 행이 있고 `done` 이 false 면 센티널이 렌더되어 다음 페이지를 다시 시도한다.
    첫 페이지가 실패한 인스턴스는 행이 없어 R6 에 따라 키를 비운다.
R14. 센티널과 진행 중 요청.
    복원 마운트에서 `done` 이 false 면 센티널을 렌더한다. 센티널이 보이면 지금처럼 `loadMore` 가 스냅샷의 커서로 다음 페이지를 받는다. 복원 직후 센티널이 보이는 위치면 한 번 받는 것을 허용한다.
    언마운트 뒤에 끝난 `loadMore` 결과는 버린다. 커서는 화면에 반영된 마지막 행의 `created_at` 과 항상 같고, 스냅샷의 커서도 그 값이다. 그래서 복원된 목록에 같은 id 의 행이 둘 있는 일이 없다.
    언마운트 뒤 결과를 버리는 것은 FeedList 의 `alive` 플래그로 한다. 진행 중이던 페이지는 복원 뒤 센티널이 다시 받는다.
R15. 태그 총 개수.
    복원 마운트는 스냅샷의 `total` 을 그대로 보이고 `countLicks` 를 부르지 않는다. 새 마운트는 지금과 같다.

## 엣지케이스

E1. 카드의 악보 폭은 `useElementWidth(420)` 이 첫 렌더에 기본값 420 으로 그리고 ref 콜백의 실측으로 같은 커밋 안에서 다시 그린다. 폰(실측 340)은 첫 렌더가 더 짧고 데스크톱(실측 692 열 안)은 첫 렌더가 더 길어 카드 높이가 한 번 바뀐다. R7 의 두 번째 `scrollTo` 가 이것을 보정한다. 둘 다 첫 그리기 전이라 보이는 점프가 없다.
E2. 복원된 위치에서 센티널이 보이면 IntersectionObserver 가 다음 페이지를 한 번 받는다. 머물러 있었어도 같은 일이 일어나므로 허용한다(R14). 중복 행은 생기지 않는다.
E3. 떠날 때 진행 중이던 `loadMore` 는 결과를 버린다(R14). 스냅샷의 커서는 반영된 마지막 행이고, 복원 뒤 센티널이 같은 페이지를 다시 받는다.
E4. 첫 페이지 실패 뒤 떠나면 키를 비운다(R6). 둘째 페이지 실패 뒤 떠나면 받은 행만 저장하고 복원 때 에러 표시 없이 센티널이 다시 시도한다(R13).
E5. 태그 피드의 총 개수는 스냅샷에 있다(R15). 총 개수 조회가 실패해 null 이었다면 복원 때도 헤더에 개수가 없다.
E6. 로그아웃은 `navigate('/')` 라 새 마운트다. 로그인 상태가 바뀌어도 스냅샷은 지우지 않는다. counts 는 사용자와 무관하고, 내 릭의 키는 authorId 라 다른 사용자와 섞이지 않는다.
E7. 유저 페이지는 프로필 요청이 끝난 뒤 Feed 를 마운트한다. 복원은 그때 일어나고 그 사이 "Loading" 이 보인다(지금과 같다). 프로필 요청이 실패하면 Feed 가 마운트되지 않고 스냅샷은 그대로 남는다.
E8. 내 릭의 이름 바꾸기는 popstate 없이 Feed 를 리마운트한다. `lastNavKind()` 가 `'history'` 로 남아 있을 수 있으므로 R12 가 키를 먼저 비운다.
E9. 삭제된 릭의 상세는 "Lick not found" 다. 거기서 뒤로 가기로 목록에 닿으면 R10 이 모든 키에서 뺀 뒤라 그 릭이 없다. 행 하나가 빠져 문서가 짧아지면 `scrollY` 는 허용 최대값으로 잘린다(R7).
E10. 게시 뒤 history 를 거슬러 Latest 항목에 닿으면 R9 로 저장소가 비어 있어 새로 받는다. 새 릭이 맨 위다.
E11. 두 탭에서 같은 목록을 열면 저장소가 따로다. 동기화하지 않는다.
E12. 편집기(`/edit`)와 레거시 열람(`/?mode=view`)은 커뮤니티 셸 전체를 언마운트한다. 저장소는 모듈 수준이라 남는다. 편집기 Exit 는 `navigate` 라 새 마운트이고, 브라우저 뒤로 가기로 편집기에서 목록에 닿으면 복원이다.
E13. Latest 에 있으면서 탭 바 Latest 를 다시 누르면 지금처럼 아무 일도 없다. 같은 요소라 리마운트가 없고 R5 가 돌지 않는다.
E14. `history.scrollRestoration` 을 지원하지 않는 환경은 없다(iOS Safari 11 이상, Chrome 46 이상). 대입이 실패해도 예외가 나지 않는다.

## 시나리오 기준 (S-n)

`.claude/skills/verify/SKILL.md` 방식으로 개발 서버(5199)에서 Playwright 로 실행한다. 데이터는 운영 DB 다. 운영 DB 에는 아무것도 넣지 않는다.
폰 폭은 390x844(isMobile, hasTouch), 데스크톱은 1280x800.
"목록 요청" 은 `/rest/v1/licks` 요청 중 URL 에 `id=eq.` 가 없는 것이다. 첫 페이지, 다음 페이지, 태그 총 개수 조회가 여기 들고 상세의 단건 조회는 들지 않는다. 좋아요 수 조회(`/rest/v1/likes`)는 세지 않는다.
"첫 프레임 측정" 은 뒤로 가기 전에 `page.evaluate` 로 `window.addEventListener('popstate', () => requestAnimationFrame(() => { window.__probe = { cards: document.querySelectorAll('.c-card').length, y: window.scrollY }; }))` 를 심고, 뒤로 가기 뒤 `window.__probe` 를 읽는 것이다. popstate 는 React 가 동기 우선순위로 처리하므로 그 rAF 때 복원 커밋이 끝나 있다.
로그인이 필요한 S5 의 내 릭, S6, S7, S8, S10 은 Playwright 로 로그인할 수 없다(Google OAuth). 이들은 단위 기준으로 저장소에 미치는 효과를 고정하고, verify 에서는 휴대폰에서 확인해 `verdict.md` 의 휴대폰 확인 표에 적는다.

S1. Given 폰 폭 Latest 를 끝까지 두 번 내려 카드 40장이 있고 `window.scrollTo(0, 2400)` 뒤 아홉째 카드가 보이게 둔 상태(scrollY 를 `yBefore` 로 기록). When 그 카드의 `.c-cardhit` 를 눌러 `/lick/:id` 가 열린 뒤 `page.goBack()`. Then 첫 프레임 측정이 `{ cards: 40, y: yBefore }` 이고(1px 이내), 1초 뒤에도 카드 40장과 같은 scrollY 이며, 뒤로 가기 뒤 목록 요청이 0건이다. 증거: `s1-before.png`, `s1-restored.png`.
S2. Given S1 끝 상태. When `page.goForward()` 로 상세가 다시 열린 뒤 `page.goBack()`. Then S1 의 Then 과 같다. 증거: `s2-forward.png`.
S3. Given S1 끝 상태에서 카드로 상세에 다시 들어간 상태. When 탭 바의 Latest 버튼을 누른다. Then 목록 요청이 1건 나가고 카드가 20장이며 scrollY 가 0 이다. 증거: `s3-fresh.png`.
S4. Given 폰 폭 `/tag/jazz` 를 한 페이지 더 내려 카드가 20장을 넘고 헤더 "N licks" 를 기록한 상태. When 보이는 카드로 상세에 간 뒤 `page.goBack()`. Then 첫 프레임 측정의 카드 수와 scrollY 가 떠날 때와 같고, 헤더 "N licks" 가 같으며, 목록 요청이 0건이다(총 개수 조회도 없다). 증거: `s4-tag.png`.
S5. Given 폰 폭 `/user/JSztbE7e`(시드 계정)를 두 페이지 내린 상태. When 카드로 상세에 간 뒤 `page.goBack()`. Then 프로필 요청(`/rest/v1/profiles`)은 1건 나가고 목록 요청은 0건이며, Feed 가 마운트된 뒤 카드 수와 scrollY 가 떠날 때와 같다. 내 릭(`/me`)은 휴대폰에서 같은 순서로 확인한다. 증거: `s5-user.png`, 내 릭은 `verdict.md` 휴대폰 확인 표.
S6. (휴대폰, 로그인) Given Latest 에서 좋아요 0 인 카드를 기억하고 상세로 간다. When 좋아요를 눌러 1 이 된 뒤 뒤로 가기. Then 그 카드의 좋아요 수가 1 이다. 다시 상세에서 눌러 0 으로 만들고 돌아오면 0 이다. 증거: `verdict.md` 휴대폰 확인 표.
S7. (휴대폰, 로그인) Given 내 릭을 내려 아래쪽 카드로 상세에 간다. When 오버플로 메뉴로 삭제한다. Then `/me` 가 새로 받아져 그 릭이 없다. 이어서 뒤로 가기를 두 번 눌러(삭제된 릭의 상세는 "Lick not found") 내 릭 복원본에 닿아도 그 릭이 없다. 증거: `verdict.md` 휴대폰 확인 표.
S8. (휴대폰, 로그인) Given Latest 를 내려 둔 상태에서 Create 로 릭을 만들어 게시해 `/lick/:new` 에 있다. When 탭 바 Latest 를 누른다. Then 새 릭이 맨 위다. 다시 그 릭을 게시하지 않고, 뒤로 가기를 거듭해 처음의 Latest 항목에 닿으면 역시 새 릭이 보인다(새로 받은 목록). 증거: `verdict.md` 휴대폰 확인 표.
S9. Given S1 끝 상태. When `page.reload()`. Then 목록 요청이 1건 나가고 카드가 20장이며 scrollY 가 0 이다. 증거: `s9-reload.png`.
S10. (휴대폰, 로그인) Given 내 릭에서 표시 이름을 바꾼다. Then 목록이 다시 받아져 카드의 작성자 이름이 새 이름이다. 증거: `verdict.md` 휴대폰 확인 표.
S11. Given 데스크톱 1280x800 Latest 를 두 페이지 내려 scrollY 를 기록한 상태. When 카드로 상세에 간 뒤 `page.goBack()`. Then S1 의 Then 과 같다(첫 프레임 측정 포함). 증거: `s11-desktop.png`.
S12. Given 폰 폭 Latest 를 두 페이지 내려 카드 40장이 있고 `window.scrollTo(0, document.body.scrollHeight)` 로 맨 아래(센티널이 보이는 위치)에 둔 상태. 응답 본문의 제목 순서를 페이지마다 기록해 둔다. When 보이는 마지막 카드로 상세에 간 뒤 `page.goBack()` 하고 2초 기다린다. Then 뒤로 가기 뒤 목록 요청이 정확히 1건(셋째 페이지)이고, 카드 수가 40 더하기 셋째 페이지 행 수이며, 카드 제목 순서가 세 페이지 응답의 제목을 이은 것과 같다(중복 없음). 증거: `s12-bottom.png`.

## 단위 기준 (AC-n)

feed-store (`src/community/feed-store.test.ts`, 새 파일. 테스트마다 `clear()` 로 시작한다):
AC-1. `feedKey(undefined, undefined)` 는 `'|'`, `feedKey('u1', undefined)` 는 `'u1|'`, `feedKey(undefined, 'jazz')` 는 `'|jazz'` 다.
AC-2. Given 키에 스냅샷을 `set`. Then `get` 이 같은 값을 돌려준다. 다시 `set` 하면 새 값으로 바뀐다. 모르는 키의 `get` 은 undefined 다.
AC-3. Given 행 2개(created_at 'c2', 'c1'), 커서 'c1' 인 스냅샷. When `appendPage(key, [행 c0], Map{x: 3}, true)`. Then 행이 3개이고 커서가 'c0', `done` 이 true, counts 에 x 가 3 이다. 행이 빈 `appendPage` 는 행과 커서를 그대로 두고 `done` 만 바꾼다. 스냅샷이 없는 키의 `appendPage` 는 아무것도 만들지 않는다.
AC-4. Given 키 두 개에 스냅샷. When `setCount('orig-1', 8)`. Then 두 스냅샷의 counts 에 orig-1 이 8 이다. 대상 행이 없는 스냅샷에도 들어간다.
AC-5. Given 키 두 개의 스냅샷에 id 'sim-1' 행이 있고 한쪽은 그 행이 마지막이라 커서가 그 created_at 이다. When `remove('sim-1')`. Then 두 스냅샷에서 그 행이 없고, 커서, counts, `done`, `total`, `scrollY` 는 그대로다.
AC-6. Given 키 두 개. When `invalidate(a)`. Then a 만 없고 b 는 있다. When `clear()`. Then 둘 다 없다.

routing (`src/community/routing.test.ts`, 기존 파일에 추가. `renderHook(useRoute)` 를 쓴다):
AC-7. Given `useRoute` 가 마운트됐다. Then `lastNavKind()` 는 `'history'` 다. When `navigate('/tag/jazz')`. Then 라우트가 tag 이고 `lastNavKind()` 가 `'navigate'` 다. When `window.dispatchEvent(new PopStateEvent('popstate'))`. Then `lastNavKind()` 가 `'history'` 다.

Feed (`src/community/views/Feed.test.tsx`, 기존 파일에 추가. `../routing` 의 `lastNavKind` 를 mock 으로 바꿔 값을 정하고, `window.scrollTo` 와 `requestAnimationFrame` 을 `vi.fn` 으로 두고, `window.scrollY` 는 `Object.defineProperty` 로 정한다. IntersectionObserver 는 `PlayOverlay.test.tsx` 와 같은 수동 mock 이다):
AC-8. Given `feedStore.set('|', { rows: [original, similar], counts: Map{orig-1: 7}, cursor: similar.created_at, done: false, total: null, scrollY: 1200 })` 과 `lastNavKind` 가 `'history'`. When `render(<Feed .../>)`. Then await 없이 바로 카드가 2장이고 "7" 이 보이며 `fetchFeedPage` 와 `countLicks` 가 불리지 않았고, `window.scrollTo` 가 `(0, 1200)` 으로 불렸고 `requestAnimationFrame` 콜백을 실행하면 한 번 더 `(0, 1200)` 으로 불린다.
AC-9. Given AC-8 과 같은 스냅샷이지만 `lastNavKind` 가 `'navigate'`. When render. Then `fetchFeedPage` 가 커서 null 로 한 번 불리고 `window.scrollTo` 는 불리지 않는다.
AC-10. Given 새 마운트가 첫 페이지 [original, similar] 와 counts 를 받아 그렸고 `window.scrollY` 가 777 이다. When unmount. Then `feedStore.get('|')` 가 `{ rows: [original, similar], counts: Map{orig-1: 7}, cursor: similar.created_at, done: true, total: null, scrollY: 777 }` 이다.
AC-11. Given 태그 피드 새 마운트에서 `countLicks` 가 12 를 돌려줘 "12 licks" 를 그렸다. When unmount 뒤 `lastNavKind` 를 `'history'` 로 두고 같은 tag 로 다시 render. Then `feedStore.get('|jazz').total` 이 12 이고 "12 licks" 가 바로 보이며 `countLicks` 가 다시 불리지 않는다.
AC-12. Given 첫 페이지가 실패해 "Couldn't load the list" 가 보이고 저장소에 그 키의 옛 스냅샷이 있다. When unmount. Then `feedStore.get('|')` 이 undefined 다.
AC-13. Given 첫 페이지 20행(`done` false)을 받은 뒤 IO 콜백으로 센티널이 보여 둘째 페이지가 진행 중(해결되지 않은 Promise)이다. When unmount 뒤 둘째 페이지가 해결된다. Then `feedStore.get('|')` 의 행이 20개이고 커서가 20번째 행의 created_at 이다. 이어서 `lastNavKind` `'history'` 로 다시 render 하고 IO 콜백을 부르면 `fetchFeedPage` 가 그 커서로 한 번 불리고 행이 겹치지 않는다.
AC-14. Given 행이 있고 `done` 이 false 인 스냅샷에서 복원 마운트. Then 센티널(`.c-sentinel`)이 렌더되고 에러 문구가 없다.
AC-15. Given deletable 목록에서 삭제를 확정한다. When `deleteLick` 이 끝난다. Then `feedStore.remove` 가 그 id 로 불린다(`vi.spyOn(feedStore, 'remove')`).

LickDetail (`src/community/views/LickDetail.test.tsx`, 기존 파일에 추가. `feedStore` 는 실제 모듈에 `vi.spyOn`):
AC-16. Given 로그인 사용자, 좋아요 수 7. When 좋아요 클릭. Then `feedStore.setCount('orig-1', 8)` 이 불린다. `addLike` 가 거절되면 `feedStore.setCount('orig-1', 7)` 이 다시 불린다. 유사 릭에서는 대상이 `canonical_id` 다.
AC-17. Given 작성자 로그인. When 삭제 다이얼로그 확정. Then `feedStore.remove('orig-1')` 이 `navigate('/me')` 보다 먼저 불린다.

Publish (`src/community/views/Publish.test.tsx`, 기존 파일에 추가):
AC-18. When 게시가 ok 다. Then `feedStore.clear` 가 `navigate('/lick/abc')` 보다 먼저 불린다. duplicate 나 error 면 불리지 않는다.

MyLicks (`src/community/views/MyLicks.test.tsx`, 기존 파일에 추가):
AC-19. When 이름 저장이 ok 다. Then `feedStore.invalidate('<user.id>|')` 가 불린다. 거절되면 불리지 않는다.

Root (`src/community/Root.test.tsx`, 기존 파일에 추가):
AC-20. When `render(<Root .../>)`. Then `history.scrollRestoration` 이 `'manual'` 이다.

## 구현 태스크

| id | 동작 | 포함 AC | 처음 동작시키는 S | 완료 조건 |
|---|---|---|---|---|
| T1 | 스냅샷 저장소 모듈과 `feedKey` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 | 없음(바탕) | 단위 테스트 통과 |
| T2 | 전환 종류 표식 `lastNavKind` | AC-7 | 없음(바탕) | 단위 테스트 통과, 기존 라우팅 테스트 통과 |
| T3 | `scrollRestoration` manual | AC-20 | 없음(바탕) | 단위 테스트 통과 |
| T4 | FeedList 복원, 되쓰기, 스크롤 복원, 태그 총 개수 | AC-8, AC-9, AC-10, AC-11, AC-12, AC-14 | S1, S2, S3, S4, S5(유저 페이지), S9, S11 | 단위 테스트 통과, `s1-*.png`, `s2-forward.png`, `s3-fresh.png`, `s4-tag.png`, `s5-user.png`, `s9-reload.png`, `s11-desktop.png` |
| T5 | 진행 중 요청 버리기와 센티널 재시도 | AC-13 | S12 | 단위 테스트 통과, `s12-bottom.png` |
| T6 | 저장소에 미치는 사건: 삭제(목록과 상세), 좋아요, 게시, 이름 바꾸기 | AC-15, AC-16, AC-17, AC-18, AC-19 | S6, S7, S8, S10 (휴대폰) | 단위 테스트 통과 |
| T7 | 문서 반영 | 없음 | 없음 | `docs/product/SPEC.md` 4절에 `### 4.2 목록 복원 (feed-cache)` 을 두고 복원 정책 세 줄(뒤로 가기와 앞으로 가기는 복원, navigate 는 새로 받기, 게시와 삭제와 좋아요와 이름 바꾸기의 반영). SPEC 에는 커뮤니티 절이 따로 없어 4.1 옆에 둔다. `harness/DECISIONS.md` 2026-11-11 에 "상세와 플레이어를 `/lick/:id` 라우트로 합치기로 하면서 오버레이 결정을 뒤집는다. 목록 재마운트 문제는 feed-cache 의 스냅샷 저장소로 푼다" 한 줄. `harness/PROGRESS.md` 갱신. 커밋 |

## 테스트 목록

| id | 종류 | 파일 |
|---|---|---|
| S1~S5, S9, S11, S12 | 시나리오 | Playwright 스크립트(스크래치패드, S1 은 `fc-probe.mjs` 를 바탕으로), 증거 `harness/evidence/feed-cache/s*.png` |
| S5(내 릭), S6, S7, S8, S10 | 시나리오(휴대폰) | `harness/evidence/feed-cache/verdict.md` 휴대폰 확인 표 |
| AC-1~AC-6 | 단위 | `src/community/feed-store.test.ts` |
| AC-7 | 단위 | `src/community/routing.test.ts` |
| AC-8~AC-15 | 단위 | `src/community/views/Feed.test.tsx` |
| AC-16, AC-17 | 단위 | `src/community/views/LickDetail.test.tsx` |
| AC-18 | 단위 | `src/community/views/Publish.test.tsx` |
| AC-19 | 단위 | `src/community/views/MyLicks.test.tsx` |
| AC-20 | 단위 | `src/community/Root.test.tsx` |

## 검증 증거

verify 단계에서 `harness/evidence/feed-cache/` 에 남길 것.
- `check.txt`: `harness/check.sh` 출력.
- 시나리오별 스크린샷. 파일명은 시나리오 기준에 적은 대로. 스크린샷과 함께 첫 프레임 측정값, 목록 요청 수, scrollY 전후를 `verdict.md` 의 표에 숫자로 적는다.
- `verdict.md`: 시나리오별 PASS 와 실행 조건(뷰포트, 로그인 여부). 휴대폰 확인 표에는 S5(내 릭), S6, S7, S8, S10 의 확인 날짜와 결과를 적는다.

## 제품 명세와 다른 점

- `docs/product/SPEC.md` 4.1 절의 "닫으면 목록과 스크롤 위치가 그대로다" 는 오버레이의 규칙이고 이 기능은 라우트 전환에 같은 성질을 준다. 충돌은 없다.
- `harness/DECISIONS.md` 2026-11-11 의 "라우트 대신 오버레이" 는 다음 기능 `lick-page` 에서 뒤집힌다. 이 기능은 그 전제(목록 재마운트와 스크롤 손실)를 없애는 바탕이다. T7 이 결정 기록을 남긴다.
