# lick-page: 릭 상세와 넘기기 플레이어를 /lick/:id 한 화면으로 통합 명세

작성일: 2026-11-13. 모델: opus (Fable 사용량 한도로 대행). 상태: 초안, 취소됨 (2026-11-14, 승인 전).
이 문서가 구현과 검증의 유일한 기준이다. 기획서 `01-plan.md` 와 디자인 `02-design.md`, 시안 `mockup.html` 은 참고 자료다.
디자인 문서의 "레이아웃 티어" 절(공통, 티어별 치수 표)은 이 문서 R5 가 그대로 가져다 쓰는 기준이다.
화면 글자 안의 `heart icon` 은 지금 코드가 좋아요 수 앞에 쓰는 하트 문자(U+2665, SMP 문자 아님)를 말로 적은 것이다. 코드와 테스트 기대값에는 그 문자를 그대로 쓴다.

## 입력과 출력

입력:
- 라우트 `/lick/:id` 의 `id: string`. `parseRoute` 의 정규식 `[A-Za-z0-9_-]+` 를 통과한 값이다.
- 그 history 항목의 `history.state`. `readEntryState` 로 읽은 `EntryState` (R2).
- 마지막 라우트 전환의 종류 `lastNavKind(): 'history' | 'navigate'` (feed-cache R3).
- 출처 목록의 스냅샷 `feedStore.get(from)` (feed-cache R2, 이 문서 R31).
- `user: User | null`, `player: Player`. Root 가 넘긴다.
- 서버 응답. `fetchLick(id)`, `fetchLikeCounts(ids)`, `fetchMyLikedSet(userId)`, `fetchFeedPage(cursor, filter)`, `deleteLick(id)`, `addLike(target)`, `removeLike(target)`. 모두 지금 있는 함수 그대로다.

출력:
- 소리. `player.play({ ...song, tempo }, { melody: true, accomp: true, metro: true }, from, total(song), { gapBeats: 4 })` (R10).
- 화면. `src/community/views/LickPage.tsx` 의 `LickPage` 한 장 모드 또는 목록 모드 (R6).
- 부수 효과. `history.pushState` (navigate), `history.replaceState` (넘기기와 삭제), `feedStore.appendPage`, `setCount`, `remove`, `setLastViewed`, localStorage 키 `swipe-play-hint` 값 `1`, `navigate` 호출.

타입과 함수:

```ts
// src/community/routing.ts
/** history.state 에 넣는 항목 정보 (lick-page R2) */
export interface EntryState {
  /** 출처 목록의 feedKey. 목록 카드가 아닌 진입은 null */
  readonly from: string | null;
  /** 카드 재생 버튼으로 만든 항목이면 true */
  readonly autoplay: boolean;
  /** 이 문서 안에서 navigate 가 쌓은 깊이. navigate 가 만든 항목은 1 이상이다 */
  readonly depth: number;
}
/** navigate 의 둘째 인자. depth 는 navigate 가 정한다 */
export interface NavState {
  readonly from: string | null;
  readonly autoplay: boolean;
}
export function readEntryState(raw: unknown): EntryState;
export function navigate(path: string, state?: NavState): void;
/** popstate 마다 1 씩 오르는 일련번호. LickPage 의 key 다 (R3) */
export function routeSeq(): number;
/** 편집기 Exit 의 목적지. navigate 가 떠나는 커뮤니티 항목을 기록한다 (R33) */
export function lastCommunityEntry(): { readonly path: string; readonly state: EntryState };
// useRoute(): Route 는 지금과 같다. 반환 타입을 바꾸지 않는다

// src/community/feed-store.ts
export interface FeedSnapshot {
  readonly rows: readonly LickRow[];
  readonly counts: ReadonlyMap<string, number>;
  readonly cursor: string | null;
  readonly done: boolean;
  readonly total: number | null;
  readonly scrollY: number;
  /** 화면이 다른 장으로 넘긴 뒤 마지막으로 본 릭 id. 넘기지 않았으면 키 자체가 없다 (R32) */
  readonly lastViewedId?: string;
}
export interface FeedStore {
  // get, set, appendPage, setCount, remove, invalidate, clear 는 지금과 같다
  setLastViewed(key: string, lickId: string): void;
}
export const parseFeedKey: (key: string) => {
  readonly authorId: string | undefined;
  readonly tag: string | undefined;
};
export const feedLabel: (key: string, rows: readonly LickRow[]) => string;

// src/community/views/LickPage.tsx
export const LickPage: (props: {
  readonly id: string;
  readonly user: User | null;
  readonly player: Player;
}) => JSX.Element;
```

DB 변경은 없다. `supabase/schema.sql` 과 운영 DB 에 적용할 마이그레이션 SQL 이 없다.
`src/community/api/` 의 질의도 바뀌지 않는다.

레이어:
- `src/community/routing.ts`: `EntryState`, `readEntryState`, `navigate(path, state?)`, `routeSeq`, `lastCommunityEntry`.
- `src/community/feed-store.ts`: `lastViewedId`, `setLastViewed`, `parseFeedKey`, `feedLabel`. React 와 DOM 을 import 하지 않는다(feed-cache 와 같다).
- `src/community/views/LickPage.tsx`: 새 화면. 한 장 모드와 목록 모드, 상단 바, 장, 재생, 템포, 액션, 삭제, 키보드.
- `src/community/Root.tsx`: lick 라우트를 `LickPage` 로 바꾸고 key 를 `routeSeq()` 로 둔다. 셸 클래스 `community--lick`. 편집기 Exit.
- `src/community/views/Feed.tsx`: LickCard 에 `from={key}` 를 넘기고, 오버레이를 빼고, 복원 마운트의 앵커 스크롤.
- `src/community/components/LickCard.tsx`: `onPlay` 대신 `from`. 카드 루트에 `data-lick-id`.
- `src/community/components/LickActions.tsx`: Share 라벨을 `<span class="c-share-label">` 로 감싸고 버튼에 `aria-label="Share"`.
- `src/community/components/OverflowMenu.tsx`: 열려 있을 때 문서 keydown 의 Escape 로 닫는다(R28).
- `src/community/views/UserPage.tsx`, `MyLicks.tsx`: swipe-play 커밋 `1152f70` 이 더한 `user`, `player` 전달을 되돌린다(지우는 것 절).
- `src/community/community.css`, `src/styles/tokens.css`: 스타일과 토큰. 색은 tokens.css 토큰만.
- core, engine, ports, `src/adapters/player.ts`, `src/ui/components/edit/Score.tsx` 는 바뀌지 않는다.

## 규칙

R1. 화면과 라우트.
    `/lick/:id` 는 `LickPage` 하나다. Root 의 `case 'lick'` 은 `<LickPage key={routeSeq()} id={route.id} user={user} player={player} />` 를 돌려준다.
    `LickDetail` 은 없다. `LickPage` 는 `id` prop 을 마운트 때만 읽는다. 넘기기로 바뀐 현재 릭은 화면 자신의 상태다. (AC-7, AC-8)

R2. history.state 와 navigate.
    `readEntryState(raw)` 는 raw 가 null 이 아닌 객체가 아니면 `{ from: null, autoplay: false, depth: 0 }` 이다.
    객체면 `from` 은 문자열일 때 그 값 아니면 null, `autoplay` 는 `=== true` 일 때만 true, `depth` 는 0 이상의 정수일 때 그 값 아니면 0 이다.
    `navigate(path, state)` 는 `history.pushState({ from: state?.from ?? null, autoplay: state?.autoplay ?? false, depth: readEntryState(history.state).depth + 1 }, '', path)` 뒤에 지금처럼 `pending = 'navigate'` 와 합성 popstate 를 보낸다.
    둘째 인자 없이 부르는 지금의 모든 호출은 `from: null`, `autoplay: false` 다.
    브라우저는 `history.state` 를 항목마다 저장하고 뒤로 가기, 앞으로 가기, 새로고침에 그 항목의 값을 돌려준다. 주소 입력과 외부 링크로 만든 항목은 null 이라 depth 0 이다. (AC-1, AC-2)

R3. 항목 일련번호와 화면 key.
    routing 의 모듈 변수 `seq` 는 0 에서 시작한다. `useRoute` 의 popstate 핸들러는 `last = pending; pending = 'history'` 다음, `setRoute` 전에 `seq += 1` 을 한다. `routeSeq()` 는 `seq` 를 돌려준다.
    navigate 와 브라우저 뒤로 가기, 앞으로 가기마다 key 가 바뀌어 LickPage 가 새로 마운트된다. 같은 id 로 다시 navigate 해도(유사 릭 장에서 진입 id 와 같은 원본으로) 새로 마운트된다.
    `history.replaceState` 는 popstate 를 내지 않으므로 넘기기는 key 를 바꾸지 않는다. Root 가 user 변경으로 다시 렌더해도 key 는 같다.
    `useRoute` 는 지금처럼 `Route` 를 돌려준다. feed-cache AC-7 테스트는 바꾸지 않는다. (AC-3, AC-8)

R4. 셸 분기.
    Root 는 `route.name === 'lick'` 일 때 셸 루트 클래스를 `community community--lick` 으로, 그 밖에는 `community` 로 둔다. DOM 구조는 바꾸지 않는다. `AppBar`, `MobileAppBar`, `Sidebar`, `TopLicks`, `TabBar` 는 모든 라우트에서 지금처럼 렌더된다.
    CSS 가 표시를 정한다.
    - 1023px 이하: `.community--lick .c-mappbar` 와 `.community--lick .c-tabbar` 는 `display: none`, `.community--lick` 의 `padding-bottom` 은 0, `.community--lick .c-main` 의 `padding` 은 0.
    - 639px 이하: `.community--lick` 의 `max-width` 는 `none` 이다(화면 폭 전체). 640 ~ 1023px 은 지금의 `--app-max-width: min(94vw, 760px)` 을 그대로 쓴다.
    - 1024px 이상: 셸 규칙을 더하지 않는다. 데스크톱 앱 바, 사이드바, Top Licks, 3열 그리드가 그대로이고 화면은 가운데 열(`.c-main`)에 들어간다. (AC-7, S1, S19)

R5. 레이아웃과 치수.
    DOM 구조는 다음과 같다. 클래스 이름은 테스트와 시나리오가 쓰는 셀렉터다.
    `.c-lp` 안에 `.c-lp-panel` 과 `.c-lp-keys`. `.c-lp-panel` 안에 `.c-lp-top`, `.c-lp-pager`, 토스트, 힌트, `DeleteLickDialog`. `.c-lp-pager` 안에 장마다 `section.c-lp-page[data-index]`. 장 안에 `.c-lp-body` 와 `LickActions` 의 `.c-actions`.
    치수는 `02-design.md` 의 "레이아웃 티어" 표 그대로다. 시나리오로 재는 값은 다음이다.
    - 폰과 태블릿(1023px 이하): `.c-lp` 높이 100dvh. `.c-lp-top` 높이 56px + `env(safe-area-inset-top)`. `.c-actions` 높이 64px + `env(safe-area-inset-bottom)`. 390x844 에서 `.c-lp` 폭 390, 태블릿 768 폭에서 `.c-lp` 폭은 min(94vw, 760px) 로 약 722.
    - 데스크톱(1024px 이상): `.c-lp-panel` 높이 `max(480px, calc(100dvh - 119px))`, 1280x800 에서 681px, 폭은 가운데 열 692px. 표면은 `--bg-card`, 1px `--line` 테두리, `--radius-card`, `--shadow-card`. `.c-lp-keys` 는 패널 아래 8px, 11px `--mut2`, 가운데.
    - `.c-lp-keys` 는 1023px 이하에서 `display: none` 이다.
    - 장 본문 `.c-lp-body` 는 패딩 4px 16px 12px, 세로 간격 10px. 좌우 패딩은 `max(16px, env(safe-area-inset-left))`, `max(16px, env(safe-area-inset-right))`.
    LickPage 는 마운트 때 레이아웃 이펙트에서 `window.scrollTo(0, 0)` 을 한 번 부른다. 데스크톱 창이 599px 보다 낮아 창이 스크롤될 때 목록에서 가져온 스크롤 위치가 남지 않게 한다. 떠나는 FeedList 의 scrollY 저장(feed-cache R8)은 이보다 먼저 끝난다. (AC-16, S1, S17, S19)

R6. 모드 판정.
    LickPage 는 마운트 때 레이아웃 이펙트에서 한 번 판정한다. 렌더 중(useState 초기값)에 저장소를 읽지 않는다. 목록에서 navigate 로 올 때 떠나는 FeedList 가 스냅샷을 쓰는 레이아웃 정리는 새 화면의 렌더보다 늦고 새 화면의 레이아웃 이펙트보다 이르다(feed-cache 의 커밋 순서).
    `entry = readEntryState(history.state)` 이고 `entry.from !== null` 이며 `snap = feedStore.get(entry.from)` 이 있고 `snap.rows` 에 `id` 와 같은 행이 있으면 목록 모드다. 그 밖은 한 장 모드다.
    목록 모드는 `rows`, `counts`, `cursor`, `done` 을 스냅샷에서 복사하고 현재 인덱스를 그 행의 위치로 둔다. 단건 조회(`fetchLick`)와 좋아요 수 조회(`fetchLikeCounts`)를 하지 않는다.
    레이아웃 이펙트의 setState 는 첫 그리기 전에 반영되므로 판정 전의 빈 화면은 보이지 않는다. 판정 전 렌더는 `.c-lp-top` 에 닫기 버튼만 그린다. (AC-16, AC-32)

R7. 한 장 모드 불러오기와 상태 화면.
    한 장 모드는 `fetchLick(id)` 를 인스턴스마다 한 번 부른다(StrictMode 이중 이펙트에서도 한 번, 지금 LickDetail 의 `started` 패턴).
    - 기다리는 동안: `.c-lp-page[aria-busy="true"]` 에 제목, 메타, 악보 프레임(경계 보임, 안쪽 300px), 태그, 액션 행 자리를 `.c-skel` 블록으로 그린다. 상단 바는 닫기만.
    - null: 상단 바는 닫기만. `.c-lp-state` 에 "Lick not found" 와 `button.c-lp-statebtn` "Back to Latest". 버튼은 `navigate('/')`.
    - 실패(reject): 상단 바는 닫기만. `.c-lp-state` 에 "Couldn't load this lick." 와 `button.c-lp-statebtn` "Retry". Retry 는 `fetchLick(id)` 를 다시 부르고 성공하면 장을 그린다.
    - 행이 오면 장 하나를 그린다. blob 을 읽지 못해도 장을 그린다(R8 의 깨진 악보).
    행이 오면 `fetchLikeCounts([likeTargetId(lick)])` 를 한 번 부르고 그 값을 `counts` 에 둔다. (AC-16, AC-17)

R8. 장 구성.
    `.c-lp-body` 안은 위에서 아래로 다음이다.
    - `.c-lp-head`: `.c-lp-titlerow`(줄바꿈 허용) 안에 `h2.c-lp-title`(17px 600, 줄 높이 1.3), `.c-badge` "Key of C", 곡을 읽었으면 `.c-badge` "{N} bars" (N 은 `measCountAll(song) - (song.pickup ? 1 : 0)`). 그 아래 `.c-meta` 에 작성자 링크 `a.c-lp-author`(`profiles` 가 있을 때, `--brand-primary` 600, 밑줄 없음)와 날짜 `new Date(created_at).toLocaleDateString('en-US')`.
    - `canonical_id` 가 있으면 `p.c-notice` "This is a similar lick. Likes are collected on the " + 링크 "original lick" + " (heart icon {원본 좋아요 수})". 수는 `counts.get(likeTargetId(lick)) ?? 0` 이다.
    - 악보 프레임 `.c-lp-frame`(1px `--ink`, `--radius-card`, 패딩 10px 12px, 툴바 없음). 곡을 읽었으면 실측 폭의 `Score`(mode view, `onNoteTap` 있음). 현재 장에만 `playheadStep`, 카운트다운 `.c-lp-count`, 멈춤 표시 `.c-lp-paused` 를 넘긴다(R15).
      곡을 읽지 못하면 `.c-lp-frame--bad`(최소 높이 120px)에 `p.c-state` "Couldn't read this score" 만 그린다.
    - `TagChips`(태그가 없으면 그리지 않는다).
    - 목록 모드 마지막 장의 끝 캡션 또는 불러오기 실패(R19).
    - 긴 릭 캡션(R21).
    장 하단에는 본문 스크롤과 무관하게 `LickActions` 가 고정된다(R34). (AC-16, AC-18, AC-27)

R9. 상단 바.
    `.c-lp-top` 는 페이저 밖 한 줄이고 `position: relative` 다. 왼쪽부터 닫기 버튼 `button.c-lp-close[aria-label="Close"]`(34px 원, 1px `--ink`), 카운터 `.c-lp-counter`, 출처 라벨 `.c-lp-source`(남는 폭 전부, `min-width: 0`, 한 줄 말줄임), 템포(`TempoControl`), 오버플로(`OverflowMenu`). 간격 8px, 아래 테두리 없음.
    - 카운터는 `"{현재 인덱스 + 1} / {rows.length}"`, 출처 라벨은 `feedLabel(from, rows)` 다. 둘 다 목록 모드에만 있다. 한 장 모드는 그 자리를 빈 공간으로 둔다.
    - 템포는 현재 장의 곡을 읽었을 때만 있다. 로딩, 실패, 없는 릭 화면과 깨진 악보 장에는 없다.
    - 오버플로는 `<OverflowMenu key={현재 릭 id} isOwner={user?.id === 현재 릭.author_id} ... />` 다. 작성자가 아니면 OverflowMenu 가 null 을 돌려준다(지금 동작).
    - 템포 팝오버 자리: `.c-lp-top .c-tb-tempo { position: static }`, `.c-lp-top .c-tb-pop { top: 100%; left: auto; right: 12px; max-width: calc(100% - 24px) }`, `.c-lp-top .c-tb-range { width: auto; flex: 1 1 120px; min-width: 48px }`. 메뉴 `.c-menu` 는 지금 CSS(오른쪽 끝 버튼의 오른쪽 정렬) 그대로 상단 바 오른쪽 12px 에 온다.
    - 열린 버튼 표시: `.c-lp-top .c-tb-btn[aria-expanded="true"]` 배경 `--brand-tint`. (AC-16, AC-18, AC-40)

R10. 재생 호출과 반복 구간.
    i 번째 장을 step 부터 재생하는 호출은 `player.play({ ...song, tempo }, { melody: true, accomp: true, metro: true }, asStep(step), asStep(total(song)), { gapBeats: 4 })` 하나다. `tempo` 는 그 장의 세션 템포 `bpm ?? song.tempo` 다(R16). 곡을 읽지 못한 장이면 `player.stop()` 만 부른다.
    반복 옵션은 늘 `{ gapBeats: 4 }` 다. 반복 토글은 없다.
    간격 뒤 다시 시작하는 스텝은 그 재생을 시작한 step 이다(player 의 swipe-play R1 그대로, `src/adapters/player.ts` 를 바꾸지 않는다). 0 부터 연 재생은 0 부터, 음표 탭은 그 음부터, 재개와 재생 중 템포 변경은 그 스텝부터 반복한다. 열린 질문 Q1.
    곡은 `decodeSong(lick.blob)` 이고 목록 모드는 행마다 한 번(`useMemo`) 디코딩한다. (AC-19, AC-20)

R11. 자동 재생.
    목록 모드이고 `lastNavKind() === 'navigate'` 이고 `entry.autoplay === true` 일 때만 마운트 때 현재 장을 0 부터 재생하고 재생 의도 `playing` 을 true 로 둔다.
    그 밖은 모두 멈춘 채 연다. 카드 본문 탭(`autoplay: false`), 한 장 모드 전부, 뒤로 가기와 앞으로 가기와 새로고침(`'history'`), 편집기 Exit(`autoplay: false`)가 여기 든다.
    개발 모드 StrictMode 의 이중 이펙트(마운트, 정리의 `player.stop()`, 다시 마운트) 뒤에도 재생 중이어야 한다. 판정을 한 번만 하게 막는 ref 를 두지 않는다. (AC-33)

R12. 빈 곳 탭(멈춤과 재개).
    현재 장의 `.c-lp-frame` 클릭이 R13 과 R14 에 걸리지 않으면 `playing` 을 뒤집는다.
    true 에서 false: 간격 중인지(`onGap` 이 마지막으로 알린 값이 숫자인지)를 먼저 읽고 `player.stop()`. 간격 중이었으면 `lastEl` 을 `total(song)` 으로 둔다. 플레이헤드는 `lastEl` 자리에 남는다.
    false 에서 true: `lastEl < total(song)` 이면 `floor(lastEl)` 부터, 아니면 0 부터 R10 으로 재생한다. 멈춘 채 연 장은 `lastEl` 이 0 이라 0 부터다.
    곡을 읽지 못한 장에서는 아무것도 하지 않는다. 제목, 메타, 태그 줄의 탭은 재생과 무관하다. (AC-19, AC-21)

R13. 음표 탭과 이중 처리 방지.
    `Score` 의 `onNoteTap(noteId)` 는 그 음표의 `s` 부터 R10 으로 재생하고 `playing` 을 true 로 둔다. 멈춘 상태였으면 재생이 시작되고, 재생 중이면 그 음부터 다시 시작하며, 간격 중이면 간격을 버리고(새 play) 그 음부터다.
    같은 클릭이 프레임으로 올라와 R12 가 다시 도는 것은 프레임 핸들러가 막는다. 프레임의 onClick 은 `(event.target as Element).closest('[data-note]')` 가 있으면 아무것도 하지 않는다. `Score.tsx` 는 고치지 않는다. 음표 핸들러에서 전파를 막는 방법은 쓰지 않는다. (AC-20)

R14. 팝오버나 메뉴가 열린 채 시작한 탭.
    `.c-lp` 의 pointerdown 캡처 단계(`onPointerDownCapture`)에서 `.c-lp` 안에 `.c-tb-pop` 이나 `.c-menu` 가 있는지를 ref `dismissing` 에 적는다. pointerdown 마다 다시 적는다.
    `dismissing` 이 true 면 프레임 클릭(R12)과 음표 탭(R13)은 아무것도 하지 않는다. 팝오버와 메뉴는 지금처럼 문서 mousedown 으로 스스로 닫힌다. 재생 상태는 그대로다. (AC-22)

R15. 플레이헤드, 멈춤 표시, 카운트다운.
    `player.onTick` 값은 `lastEl` 에 두고 현재 장의 `Score` 에 `playheadStep` 으로 넘긴다. 다른 장에는 넘기지 않는다.
    `player.onGap` 값이 숫자면 현재 장 프레임에 `.c-lp-frame--dim`(svg 불투명도 0.35)과 `.c-lp-count`(숫자 `.c-lp-count-num`, 캡션 "Again in", 점 4개 중 지난 박만 `.on`)를 그린다. null 이면 지운다.
    현재 장이고 `playing` 이 false 이고 곡을 읽었으면 `.c-lp-paused`(64px `--ink` 원 0.8, 재생 아이콘)를 그린다. 멈춤 표시와 카운트다운은 `pointer-events: none` 이다.
    구독은 마운트 때 하고 언마운트 때 해제하며 언마운트 때 `player.stop()` 을 부른다. (AC-19, AC-21)

R16. 템포.
    상단 바의 `TempoControl` 은 `<TempoControl key={현재 릭 id} bpm={bpm ?? song.tempo} onChange={onBpmChange} />` 다. `TempoControl.tsx` 는 바뀌지 않는다(40 ~ 240, 5 단위 버튼과 range).
    `onBpmChange(v)`: `bpm` 을 v 로 둔다. `playing` 이 true 이고 간격 중이면 0 부터, 간격이 아니면 `floor(lastEl)` 부터 템포 v 로 R10 재생한다. `playing` 이 false 면 값만 바꾸고 다음 재생부터 쓴다.
    `bpm` 은 그 장에 머무는 동안만 유효하다. 현재 장이 바뀌면 null 로 돌아가 새 장의 곡 템포가 보인다. key 가 바뀌어 열려 있던 팝오버도 닫힌다. (AC-23, AC-34)

R17. 페이저와 현재 장.
    `.c-lp-pager` 는 `scroll-snap-type: y mandatory`, `overscroll-behavior: contain`, `overflow-y: auto` 이고 `.c-lp-page` 는 높이 100%, `scroll-snap-align: start` 다.
    현재 인덱스는 IntersectionObserver(root 는 페이저, 임계값 0.6)로 60% 이상 보인 상태가 120ms 유지된 장이다(swipe-play R6 그대로).
    목록 모드로 정해지면 첫 그리기 전에 `pager.scrollTop = pager.clientHeight * 현재 인덱스` 로 시작 장을 보인다. 마운트 때 시작 장이 현재로 판정돼도 같은 인덱스라 아래 절차를 하지 않는다.
    현재 인덱스가 i 로 바뀌면 이 순서로 한다.
    1. 현재 인덱스를 i 로, `lastEl` 을 0 으로, 플레이헤드를 null 로, `bpm` 을 null 로 둔다.
    2. 힌트가 보이면 숨기고 `swipe-play-hint` 에 `1` 을 쓴다(R20).
    3. `history.replaceState(history.state, '', '/lick/' + rows[i].id)`. state 의 `from`, `autoplay`, `depth` 가 그대로 남고 `history.length` 는 바뀌지 않는다. Root 는 다시 렌더하지 않는다.
    4. `feedStore.setLastViewed(from, rows[i].id)` (R32).
    5. `playing` 이 true 면 i 번째 곡을 0 부터 R10 으로 재생한다. false 면 `player.stop()` 만 부른다.
    한 번에 두 장을 지나가면 중간 장은 60% 를 120ms 채우지 못해 현재가 되지 않고 재생되지 않는다.
    한 장 모드는 장이 하나라 현재가 바뀌지 않는다. (AC-34, AC-35)

R18. 미리 받기 (목록 모드).
    현재 인덱스가 `rows.length - 2` 이상이고 `done` 이 false 이고 진행 중인 요청이 없으면 다음 페이지를 받는다. 마운트 때 시작 장이 이미 그 위치여도 받는다.
    순서는 FeedList 의 loadMore 와 같다. `fetchFeedPage(cursor, parseFeedKey(from))` 뒤 `fetchLikeCounts(canonicalIds(page))`.
    둘 다 끝나고 화면이 마운트돼 있으면 `cursor` 를 `page.at(-1)?.created_at ?? cursor` 로, `rows` 에 page 를 잇고, `counts` 를 합치고, `done` 을 `page.length < PAGE_SIZE` 로 두고, `feedStore.appendPage(from, page, 받은 counts, done)` 을 부른다.
    언마운트 뒤에 끝난 요청은 버린다(`alive` ref). 저장소의 커서는 반영된 마지막 행 그대로다.
    곡 목록이 늘어도 현재 장을 다시 재생하지 않는다. 재생 함수는 곡 배열을 ref 로 읽는다. (AC-36, AC-38)

R19. 목록 끝과 불러오기 실패.
    `done` 이 true 이고 실패가 아닌 마지막 장의 태그 아래에 `p.c-lp-end` "This is the last lick in {feedLabel}" 을 그린다.
    R18 의 요청이 실패하면 마지막 장에 `p.c-lp-end` "Couldn't load more" 와 `button.c-btn` "Retry" 를 그린다. Retry 는 R18 의 요청을 다시 한다. 실패해도 받은 장은 그대로 넘길 수 있다. (AC-37)

R20. 힌트 (목록 모드만).
    localStorage `swipe-play-hint` 가 `1` 이 아니면 목록 모드로 정해질 때 `.c-lp-hint` "Swipe up for the next lick"(위 화살표 아이콘)을 보인다. 키는 swipe-play 와 같아 이미 본 사람에게는 다시 보이지 않는다.
    R17 의 2 에서 숨기고 저장한다. 읽기와 쓰기 실패는 무시한다(보인다). 한 장 모드에는 없다. 1024px 이상에서는 `display: none` 이다.
    자리는 `.c-lp-panel` 기준 가운데, 아래에서 84px + `env(safe-area-inset-bottom)`. (AC-39)

R21. 긴 릭.
    `.c-lp-body` 는 `overflow-y: auto` 다. 본문이 넘치고 끝까지 내리지 않았을 때(`scrollHeight - clientHeight - scrollTop > 2`)만 `.c-lp-body--more`(프레임 아래쪽 `--scroll-shade` 그늘)와 `.c-lp-scrollcue` "Scroll for the rest of the score" 를 그린다. ResizeObserver 와 본문 scroll 이벤트로 다시 잰다.
    끝까지 내린 뒤 한 번 더 밀면 페이저가 넘어간다(중첩 스크롤의 기본 동작). (AC-31)

R22. 좋아요.
    대상은 `likeTargetId(lick)` 이다. 수는 `counts.get(대상) ?? 0` 이다. 목록 모드는 스냅샷의 counts, 한 장 모드는 R7 의 조회 결과다.
    내 좋아요 집합은 `user` 가 있으면 `fetchMyLikedSet(user.id)` 로 받는다. 마운트 때와 `user?.id` 가 바뀔 때(새로고침 뒤 세션 복원으로 null 에서 사용자로) 한 번씩이다. 장을 넘길 때는 받지 않는다.
    누르면:
    - 비로그인: 토스트 "Sign in to like". 상태와 요청 없음.
    - 로그인: 그 대상의 요청이 진행 중이면 무시한다(대상마다 단일 요청, 진행 중에는 `LikeButton` 의 `disabled`). 아니면 눌림을 뒤집고, `counts` 를 `c ± 1` 로, `feedStore.setCount(대상, c ± 1)` 을 부른 뒤 `addLike` 또는 `removeLike` 를 보낸다.
    - 실패: 눌림과 `counts` 를 되돌리고 `feedStore.setCount(대상, c)` 를 부르고 토스트 "Like failed". 저장소 되돌리기는 언마운트 뒤에도 한다(feed-cache R11 과 같다).
    c 는 누르기 전 수다. (AC-24, AC-41)

R23. 공유.
    URL 은 `${location.origin}/s/${lick.id}` 다. `navigator.share` 가 함수면 `navigator.share({ title: lick.title, url })` (거절은 무시), 아니면 `navigator.clipboard.writeText(url)` 뒤 토스트 "Link copied", 클립보드도 없으면 `window.prompt('Copy this link', url)` 이다(상세와 같다). (AC-25)

R24. 복제 편집.
    `navigate('/edit#' + lick.blob)` 이다. 소리는 언마운트의 `player.stop()` 이 멈춘다. 오버레이의 `replaceState` 방식은 쓰지 않는다. (AC-26)

R25. 링크.
    작성자 링크는 `href="/user/{public_id}"` 이고 클릭은 `preventDefault` 뒤 `navigate('/user/' + public_id)` 다. 태그 칩은 `TagChips` 그대로(`navigate('/tag/' + encodeURIComponent(tag))`). 원본 링크는 `href="/lick/{canonical_id}"` 이고 클릭은 `preventDefault` 뒤 `navigate('/lick/' + canonical_id)` 다. 셋 다 둘째 인자가 없어 도착한 화면은 한 장 모드다.
    뒤로 가기로 돌아오면 그 항목의 state 가 그대로라 R6 으로 같은 장이 같은 카운터로 열리고 R11 로 멈춰 있다. (AC-27)

R26. 삭제.
    현재 릭의 작성자에게만 `OverflowMenu` 의 "Delete lick" 이 있고 누르면 `DeleteLickDialog` 를 연다. 다이얼로그는 `.c-lp` 안에 렌더한다. Cancel 은 진행 중이 아닐 때 닫고 오류를 지운다.
    Delete 를 누르면 `deleteLick(id)` 를 보낸다.
    - 성공: `feedStore.remove(id)`. 이어서
      - 목록 모드이고 다른 행이 남으면: `rows` 에서 그 행을 빼고 새 인덱스를 `min(지운 인덱스, 남은 행 수 - 1)` 로 둔다(다음 장, 마지막이었으면 이전 장). 첫 그리기 전에 `pager.scrollTop` 을 새 인덱스 위치로 두고, R17 의 1 ~ 5 를 그 새 인덱스로 한다(인덱스 숫자가 같아도 한다). 다이얼로그를 닫고 토스트 "Lick deleted".
      - 한 장 모드이거나 남는 행이 없으면: `navigate('/me')`. `feedStore.remove` 가 navigate 보다 먼저다.
    - 실패: 다이얼로그 안에 "Delete failed. Please try again." 이고 다이얼로그는 열려 있다. (AC-28, AC-42)

R27. 닫기.
    닫기 버튼과 Esc(R28)는 `readEntryState(history.state).depth > 0` 이면 `history.back()`, 아니면 `navigate('/')` 다. 딥링크로 연 화면의 닫기는 사이트 밖으로 나가지 않는다.
    넘기기의 `replaceState` 가 state 를 옮기므로 몇 장을 넘겼어도 같다. 새로고침은 state 를 지우지 않으므로 navigate 로 만든 항목은 새로고침 뒤에도 `history.back()` 이다.
    직전 항목이 편집기(편집기 Exit 로 온 경우)나 게시 화면(게시 직후)이면 `history.back()` 이 그 화면으로 간다. 열린 질문 Q2. (AC-29)

R28. 키보드.
    LickPage 는 마운트 동안 `window.addEventListener('keydown', onKey, true)` (캡처) 하나로 페이지 키를 받는다. 마운트 때 닫기 버튼에 포커스를 둔다.
    이 순서로 거른다.
    1. `altKey`, `ctrlKey`, `metaKey` 중 하나라도 true 면 받지 않는다.
    2. 이벤트 대상이 `document.body` 도 아니고 `.c-lp` 안도 아니면 받지 않는다(데스크톱 앱 바 검색 입력, 사이드바).
    3. 대상이 `[role="dialog"]` 나 `[role="menu"]` 안이면 받지 않는다(템포 팝오버, 오버플로 메뉴, 삭제 다이얼로그. range 의 화살표는 템포만 바꾼다).
    4. `.c-lp` 안에 `[role="dialog"]` 나 `[role="menu"]` 가 있으면 받지 않는다. 열린 것은 스스로 Esc 로 닫힌다(TempoControl 은 지금 문서 Esc, DeleteLickDialog 는 지금 자체 Esc, OverflowMenu 는 이 기능이 더하는 문서 Esc). 포커스 위치와 상관없이 Esc 는 열린 것만 닫고 페이지를 닫지 않는다.
    받는 키:
    - `Escape`: R27.
    - `ArrowDown`, `ArrowUp`: 목록 모드면 `pager.scrollBy({ top: (Down 이면 1, Up 이면 -1) * pager.clientHeight, behavior: 'smooth' })` 와 `preventDefault()`. 한 장 모드는 아무것도 하지 않고 기본 동작도 막지 않는다.
    - `' '`(Space): `preventDefault()` 와 R12 의 토글. 포커스가 버튼(닫기 버튼 포함)이어도 페이지 토글이다. keydown 의 `preventDefault` 가 버튼의 Space 실행을 막는다. 버튼 실행은 Enter 로 한다(swipe-play R13 과 같다).
    `OverflowMenu` 는 열려 있는 동안 문서 keydown 의 `Escape` 로 닫힌다. 바깥 mousedown 으로 닫는 지금 이펙트에 같이 둔다. 메뉴 안의 화살표 이동은 그대로다. (AC-15, AC-30, AC-43)

R29. 토스트.
    `div.c-toast.c-lp-toast[role="status"]` 를 `.c-lp-panel` 안에 그리고 1600ms 뒤 지운다. `.c-lp-toast` 는 `position: absolute`, 가운데, 아래 84px + `env(safe-area-inset-bottom)` 이고 힌트보다 위에 그린다. 게시 화면의 `.c-toast`(하단 16px)는 그대로다.
    문구는 "Sign in to like", "Like failed", "Link copied", "Lick deleted" 넷이다. (AC-24)

R30. 카드 진입.
    `LickCard` 는 `onPlay` 대신 `from?: string | undefined`(출처 목록의 feedKey)를 받는다.
    - 카드 본문 `.c-cardhit`: `from` 이 있으면 `navigate('/lick/' + id, { from, autoplay: false })`, 없으면 `navigate('/lick/' + id)` (인자 하나).
    - 재생 버튼 `.c-card-play[aria-label="Play"]`: `from` 이 있고 blob 을 읽었을 때만 그린다(swipe-play R3 재승인 그대로). 누르면 `navigate('/lick/' + id, { from, autoplay: true })`.
    - 카드 루트 `article.c-card` 에 `data-lick-id={id}` 를 둔다(R32).
    FeedList 는 모든 카드에 `from={feedKey(authorId, tag)}` 를 넘긴다(Latest, 태그 피드, 유저 페이지, 내 릭). 검색 결과(`SearchResults`)는 넘기지 않는다.
    랭킹 행, Top Licks, 검색 제안, 게시 직후(`Publish`)는 지금처럼 `navigate('/lick/' + id)` 이고 한 장 모드다. (AC-10, AC-11, AC-12)

R31. 저장소 추가.
    `setLastViewed(key, lickId)` 는 그 키의 스냅샷이 있으면 `{ ...cur, lastViewedId: lickId }` 로 바꾸고 없으면 아무것도 하지 않는다.
    `appendPage`, `setCount`, `remove` 는 지금처럼 `...cur` 를 펼치므로 `lastViewedId` 를 그대로 둔다. `set` 은 통째로 바꾸므로 넘긴 객체에 칸이 없으면 칸이 없다.
    `parseFeedKey(key)`: 첫 `'|'` 의 위치를 i 라 하면 `authorId = key.slice(0, i) || undefined`, `tag = key.slice(i + 1) || undefined`. `'|'` 가 없으면 둘 다 undefined. (태그는 `normalizeTag` 가 `'|'` 를 지우고 authorId 는 UUID 라 첫 `'|'` 가 구분자다.)
    `feedLabel(key, rows)`: `tag` 가 있으면 `'#' + tag`, 없고 `authorId` 가 있으면 `rows[0]?.profiles?.display_name ?? 'Licks'`, 둘 다 없으면 `'Latest'` (swipe-play R14 와 같다). (AC-5, AC-6)

R32. 돌아온 목록 앵커.
    쓰기: LickPage 는 현재 장이 바뀔 때마다 `feedStore.setLastViewed(from, 그 릭 id)` 를 부른다(R17 의 4, R26). 진입 장으로 열기만 하고 넘기지 않으면 부르지 않는다.
    비우기: FeedList 의 되쓰기(feed-cache R6)는 지금처럼 `feedStore.set(key, { rows, counts, cursor, done, total, scrollY })` 이고 `lastViewedId` 를 넣지 않는다. 목록을 떠날 때마다 칸이 비므로 다음 화면에서 넘기지 않으면 칸이 없다.
    읽기: FeedList 의 복원 마운트(feed-cache R5)는 지금처럼 useState 초기값에서 스냅샷을 잡는다. 장을 바꿀 때마다 쓰므로 떠나는 LickPage 의 정리보다 먼저 도는 이 초기값에 값이 보인다. StrictMode 의 이중 레이아웃 이펙트에서도 잡아 둔 값을 쓴다.
    스크롤: feed-cache R7 의 두 `scrollTo` (레이아웃 이펙트 한 번, 같은 이펙트가 예약한 rAF 한 번)의 목표를 매번 다음 식으로 계산한다.
    `snapshot.lastViewedId` 가 있고 목록 컨테이너 안에 `.c-card[data-lick-id="{그 id}"]` 가 있으면 `Math.round(card.getBoundingClientRect().top + window.scrollY - 12)`, 아니면 `snapshot.scrollY`.
    12 는 Feed.tsx 의 모듈 상수 `ANCHOR_TOP` 이다(폰 목록의 카드 간격, 디자인 답 A). 목록 끝이라 그만큼 내려갈 수 없으면 브라우저가 자른 값 그대로다. 앱 바는 sticky 가 아니라 화면 위로 올라가 있다.
    rAF 의 두 번째 계산은 카드 악보 폭이 실측으로 다시 그려진 뒤의 카드 위치를 쓴다(feed-cache E1). (AC-13, AC-14, AC-35)

R33. 편집기 Exit.
    routing 의 모듈 변수 `lastCommunity` 는 `{ path: '/', state: { from: null, autoplay: false, depth: 0 } }` 에서 시작한다.
    `navigate` 는 pushState 전에 지금 위치의 라우트(`parseRoute(location.pathname, location.search)`)가 `edit`, `legacyView`, `publish`, `share` 가 아니면 `lastCommunity = { path: location.pathname, state: readEntryState(history.state) }` 로 둔다. 넘기기로 바뀐 URL 도 그대로 잡힌다.
    `lastCommunityEntry()` 는 그 값을 돌려준다. Root 의 `lastCommunityPath` ref 와 그 이펙트는 지운다.
    Root 의 편집기 `onExit` 는 `const { path, state } = lastCommunityEntry(); navigate(path, { from: state.from, autoplay: false })` 다. 출처 스냅샷이 남아 있으면 목록 모드로 같은 장이 멈춘 채 열린다. 게시로 저장소가 비었으면 한 장 모드다. (AC-4, AC-9)

R34. 액션 행.
    `LickActions` 가 장마다 하나이고 `.c-lp-page` 의 마지막 자식이다. 순서는 Duplicate & edit, 좋아요 수, Share 다.
    `.c-actions` 는 그리드 `1fr auto auto`, 간격 8px, 패딩 `10px 16px calc(10px + env(safe-area-inset-bottom))` (1024px 이상은 `10px 16px`), 위 1px `--line`, 배경 `--paper`. 버튼은 최소 높이 44px, `--radius-ctl`, 13px 600 이다(지금 `.c-play-actions` 와 같은 모양).
    Share 버튼은 `aria-label="Share"` 이고 글자는 `span.c-share-label` 안에 있다. 359px 이하에서 `.c-share-label` 은 `display: none` 이다(아이콘만). (AC-25, S1, S17)

## 지우는 것과 남기는 것

지운다 (태스크 T2, T3, T11 이 지운다).
- 파일: `src/community/components/PlayOverlay.tsx`, `PlayOverlay.test.tsx`, `src/community/views/LickDetail.tsx`, `LickDetail.test.tsx`, `src/community/components/ScoreFrame.tsx`.
- `Feed.tsx`: `playAt` 상태, `PlayOverlay` 마운트, 출처 라벨 계산, `onCount`. `Props` 와 `ListProps` 의 `player`, `user` 와 그 import.
- swipe-play 커밋 `1152f70` 이 더한 전달: Root 가 `Feed` 에 넘기는 `player`, `user`, Root 가 `UserPage` 에 넘기는 `user`, `UserPage` 의 `user` prop 과 `User` import, `MyLicksView` 의 `player` 인자와 `Feed` 에 넘기는 `player`, `user`. `UserPage` 와 `MyLicks` 의 `Props.player` 는 그 커밋 전부터 있던 미사용 prop 이라 둔다.
- Root: `LickDetail` import, `lastCommunityPath` ref 와 이펙트(R33 이 routing 으로 옮긴다).
- CSS: `.c-detail`, `.c-detail-title`, `.c-lickhead`, `.c-lickhead-title`, `.c-skel-title`, `.c-skel-frame`, `.c-skel-tb`, `.c-skel-score`, `.c-skel-actions`, `.c-frame`, `.c-frame-divider`, `.c-frame-score`, `.c-footer`, 푸터 절의 `.c-actions` 2열 그리드와 `.c-actions .c-dup` 와 `.c-tags { order: -1 }`, 1024px 이상 푸터 절의 `.c-footer`, `.c-actions`, `.c-actions .c-dup`, `.c-dup, .c-actions .c-like, .c-share { min-height: 0 }`, `.c-tags { order: 0; margin-left: auto; ... }`. `.c-play` 로 시작하는 규칙 전부.
  푸터 절의 `.c-tags` 규칙은 상세 푸터용이었다. 카드의 `.c-tags` 는 블록 안이라 `order` 와 `margin-left: auto` 가 효과가 없고 태그 셋(15자 이하)은 카드 폭에서 한 줄에 들어가 보이는 변화가 없다. 남겨 두면 `.c-lp-body`(세로 flex) 안의 태그가 맨 위로 올라가고 데스크톱에서 오른쪽으로 붙는다.
- 토큰: `src/styles/tokens.css` 의 `--scrim`.
- 주석의 옛 이름: `TempoControl.tsx`, `LikeButton.tsx` 의 "호출부(LickDetail)" 는 "호출부(LickPage)" 로, `UserPage.tsx`, `Publish.tsx`(두 곳), `Feed.tsx`, `Root.test.tsx`(두 곳)의 `LickDetail` 은 `LickPage` 로, `Feed.test.tsx` 의 `PlayOverlay.test.tsx` 는 `LickPage.test.tsx` 로 고친다. S24 의 grep 이 이것을 확인한다.

남긴다.
- `ScoreToolbar.tsx` 와 반복 버튼, `.c-toolbar*`. `Publish.tsx` 가 그대로 쓴다.
- `TempoControl`(코드 그대로), `OverflowMenu`(문서 Esc 만 더한다), `DeleteLickDialog`, `TagChips`, `LikeButton`, `LickActions`(Share 라벨과 스타일만 바뀐다).
- `.c-notice`, `.c-badge`, `.c-meta`, `.c-state`, `.c-btn`, `.c-tb-*`, `.c-menu*`, `.c-dialog*`, `.c-tags`, `.c-tag`, `.c-toast`(게시 화면), `.c-skel` 와 `c-skel-pulse` 와 모션 최소화 규칙, `.c-card-play`.
- 토큰 `--scroll-shade`, `--shadow-float`. localStorage 키 `swipe-play-hint`.
- `src/adapters/player.ts` 와 그 테스트(swipe-play AC-1 ~ AC-4). `Score.tsx`.
- 새 스타일은 `.c-play*` 를 `.c-lp*` 로 옮겨 쓴 것에서 시작한다. 첫 묶음 동안 두 벌이 같이 있고 둘째 묶음 T11 이 `.c-play*` 를 지운다.

swipe-play 단위 기준의 처리.

| swipe-play | 처리 | 새 자리 |
|---|---|---|
| AC-1 ~ AC-4 (player) | 그대로 | `src/adapters/player.test.ts` |
| AC-5 (재생 버튼은 onPlay 만) | 바뀐다: navigate 가 `{ from, autoplay: true }` 로 불린다 | AC-10 |
| AC-6 (onPlay 없으면 버튼 없음) | 바뀐다: `from` 이 없으면 버튼 없음 | AC-11 |
| AC-7 (마운트, pushState, 즉시 재생) | 옮긴다: pushState 대신 모드 판정, 자동 재생 조건이 붙는다 | AC-32, AC-33 |
| AC-8 (악보 탭 멈춤과 재개) | 옮긴다 | AC-19 |
| AC-9 (장 전환과 재생) | 옮긴다: replaceState, 앵커, 템포 리셋이 더해진다 | AC-34 |
| AC-10 (미리 불러오기) | 옮긴다: `appendPage` 가 더해진다 | AC-36 |
| AC-11 (popstate 가 닫는다) | 버린다 | 없음 |
| AC-12 (키보드) | 옮긴다: Esc 는 R27 | AC-43, AC-29 |
| AC-13 (힌트) | 옮긴다: 목록 모드만 | AC-39 |
| AC-14 (좋아요, onCount) | 옮긴다: onCount 대신 `setCount` | AC-24, AC-41 |
| AC-15 (복제 편집 replaceState) | 바뀐다: `navigate('/edit#' + blob)` | AC-26 |
| AC-16 (카운트다운) | 옮긴다 | AC-21 |
| AC-17 (출처 라벨) | 옮긴다: 키에서 유도 | AC-6, AC-40 |
| AC-18 (깨진 blob) | 옮긴다 | AC-18 |
| AC-19 (Feed 가 오버레이를 마운트) | 버린다 | AC-12 가 오버레이가 없음을 확인 |
| 이름 없는 테스트 R7 (카운트다운 중 탭) | 옮긴다 | AC-21 |
| E2, R9 (불러오기 실패, 끝 캡션) | 옮긴다 | AC-37 |
| R11 (공유) | 옮긴다 | AC-25 |
| R12 (작성자와 태그는 표시만) | 버린다. 링크로 뒤집힌다 | AC-27 |
| R13 (닫기 버튼 포커스) | 옮긴다 | AC-29 |
| R4 (스크림 클릭) | 버린다 | 없음 |
| E4 (목록이 줄면 마지막 장, 비면 닫기) | 삭제 경로로 바뀐다 | AC-42 |

상세 테스트(`LickDetail.test.tsx`)의 처리.

| 지금 테스트 | 처리 | 새 자리 |
|---|---|---|
| Share 단축 URL 클립보드 | 옮긴다 | AC-25 |
| 시안 C 구조(툴바와 악보가 한 프레임) | 버린다. 툴바가 없다 | 없음 |
| 조옮김과 다운로드 UI 없음 | 옮긴다 | AC-16 |
| 로드 실패와 Retry | 옮긴다 | AC-17 |
| 원본 릭 제목, 악보, 좋아요 수 | 옮긴다 | AC-16 |
| 태그 칩 링크 / 태그 없으면 칩 없음 | 옮긴다 | AC-27 / AC-16 |
| 유사 릭 안내와 원본 링크 | 옮긴다 | AC-27 |
| Duplicate & edit | 옮긴다 | AC-26 |
| 로그인 좋아요 토글, single-flight, 비로그인 | 옮긴다 | AC-24 |
| 오버플로 작성자만, 삭제 확인, 삭제 취소 | 옮긴다 | AC-28 |
| 툴바 Play 와 `loop=false`, 언마운트 정지 | 바뀐다: Play 버튼 없음, 빈 곳 탭과 `{ gapBeats: 4 }` | AC-19, AC-26 |
| feed-cache AC-16 (좋아요 setCount) | 옮긴다 | AC-24 |
| feed-cache AC-17 (삭제 remove 가 navigate 보다 먼저) | 옮긴다 | AC-28 |

그 밖의 테스트 변경.
- `Feed.test.tsx`: describe "Feed: 넘기기 재생 오버레이 (swipe-play R4)" 의 세 테스트(AC-19 둘, AC-17)를 지운다. AC-12, AC-40 이 대신한다. 모든 `render(<Feed ... />)` 에서 `player`, `user` prop 을 빼고 `fakePlayer` 생성과 그 import 를 지운다. 기대값은 바꾸지 않는다.
- `LickCard.test.tsx`: AC-5, AC-6 테스트를 AC-10, AC-11 로 바꿔 쓴다.
- `UserPage.test.tsx`: `render(<UserPage ... />)` 에서 `user` prop 을 뺀다. 기대값은 바꾸지 않는다.
- `PlayOverlay.test.tsx`, `LickDetail.test.tsx`: 위 두 표대로 옮긴 뒤 지운다.
- feed-cache AC-7 (`routing.test.ts`), AC-8 ~ AC-15 (`Feed.test.tsx`), AC-20 (`Root.test.tsx`)은 기대값을 바꾸지 않고 통과한다.

## 엣지케이스

E1. 출처 스냅샷에 URL 의 id 가 없다(새로고침으로 저장소가 빔, 같은 키가 다른 방문으로 덮임, 지워짐). 한 장 모드다(R6).
E2. 출처와 같은 키의 목록을 링크로 다녀온다(예: `/tag/jazz` 에서 연 장에서 #jazz 칩을 누르고 돌아옴). 떠날 때 FeedList 가 새 첫 페이지로 스냅샷을 덮는다. 돌아온 장의 id 가 새 스냅샷에 있으면 그 인덱스로, 없으면 한 장 모드다.
E3. `history.state` 가 없는 항목(주소 입력, 외부 링크, 메신저 링크)은 한 장 모드이고 depth 0 이라 닫기가 `navigate('/')` 다.
E4. 새로고침은 `history.state` 를 지우지 않는다. 저장소는 비어 한 장 모드이고 depth 는 남아 닫기가 `history.back()` 이다. 직전 항목은 같은 사이트다. (기획 구조 2 의 "새로고침은 state 가 없어 0" 은 기획 사실 절의 브라우저 사실과 어긋나 사실 쪽을 따른다.)
E5. 템포 팝오버가 열린 채 넘기면 TempoControl key 가 바뀌어 닫힌다(R16). 팝오버 안의 range 와 버튼은 페이지 키를 받지 않는다(R28).
E6. 간격 중 템포를 바꾸면 0 부터 새 템포다(R16).
E7. 목록 모드에서 마지막 남은 장을 지우면 `/me` 다. 한 장 모드의 삭제도 `/me` 다(R26).
E8. 로그인하지 않았으면 오버플로 버튼이 없다. 열려 있는 동안 로그인 상태가 바뀌면 다음 렌더부터 오버플로가 생기거나 없어지고 내 좋아요 집합을 그 사용자로 받는다(R22).
E9. `fetchMyLikedSet` 은 장마다 받지 않는다(R22).
E10. 한 장 모드의 `fetchLick` 실패는 "Couldn't load this lick." 과 Retry 다(R7).
E11. 음표 탭 한 번에 토글이 같이 돌지 않는다(R13).
E12. 넘기는 동안 다음 페이지가 이어져도 현재 장을 다시 시작하지 않는다(R18).
E13. 떠날 때 진행 중이던 다음 페이지는 버린다. 스냅샷 커서는 반영된 마지막 행이고 복원된 목록의 센티널이 같은 커서로 다시 받는다(R18, feed-cache R14).
E14. 페이저의 `overscroll-behavior: contain` 으로 당겨서 새로 고침이 끼어들지 않는다. iOS 의 가장자리 가로 스와이프(뒤로 가기)는 세로 넘기기와 겹치지 않는다.
E15. 화면 회전과 리사이즈는 장 높이(CSS 100%)와 악보 폭(`useElementWidth`)을 다시 잰다. 재생은 이어진다.
E16. 템포 60 의 4박 간격은 4초, 240 은 1초다. 카운트다운은 박마다 4, 3, 2, 1 이다.
E17. 편집기에서 Share 로 게시하면 저장소가 비므로(feed-cache R9) Exit 로 돌아와도 한 장 모드다.
E18. 유사 릭의 좋아요 수와 안내의 수는 `likeTargetId` 로 원본 것이다. 두 모드 모두 같다.
E19. blob 이 깨진 장은 소리가 없고, "N bars" 배지와 템포 버튼과 멈춤 표시가 없으며, 탭과 Space 가 아무것도 하지 않는다. 다음 장은 정상이다. 행 데이터로 제목, 메타, 태그, 액션 행은 그린다. 한 장 모드도 같다(상세의 "Couldn't read this score" 와 Back to Latest 단독 화면 대신).
E20. 다음 페이지 실패 뒤에도 받은 장은 넘길 수 있다(R19).
E21. 두 장을 한 번에 지나가면 중간 장은 재생되지 않는다(R17). 두 번 나눠 넘겨 중간 장이 120ms 넘게 60% 이상 보이면 재생되는 것은 2026-11-11 결정 그대로다.
E22. 카드 재생 버튼을 연타해도 첫 탭의 navigate 로 목록이 언마운트돼 항목은 하나다.
E23. AudioContext 가 suspended 면 카드 탭의 pointerdown 이 `main.tsx` 의 전역 리스너로 먼저 resume 한다. 간격 뒤 재시작은 제스처가 필요 없다.
E24. 뒤로 가기, 앞으로 가기, 새로고침으로 닿은 화면은 제스처가 없어 소리를 못 내므로 멈춘 채 연다(R11).
E25. 넘긴 뒤 진입 장으로 다시 넘겨 돌아오면 칸에 진입 장 id 가 있어 돌아온 목록은 진입 카드가 위 12px 에 온다. 떠날 때 scrollY 가 아니다(R32).
E26. 앵커 카드가 목록에 없으면(다른 탭에서 지워져 스냅샷에서 빠짐) scrollY 로 돌아간다. 이 화면에서 지운 경우는 이웃 장 id 가 칸에 있다(R26).
E27. 앵커 카드가 목록 끝 근처라 윗변을 12px 에 둘 만큼 내려갈 수 없으면 브라우저가 맞춘 최대 위치다.
E28. 팝오버나 메뉴가 열린 채 악보를 탭하면 그것만 닫히고 재생 상태는 그대로다(R14). 메뉴와 다이얼로그가 열려 있는 동안 소리는 이어진다.
E29. 데스크톱 창 높이가 599px 보다 낮으면 패널 최소 높이 480px 때문에 창이 스크롤된다.
E30. 359px 이하 폭에서 Share 는 아이콘만 보이고 접근 이름은 "Share" 다. 320px 폭에서 템포 팝오버는 `max-width: calc(100% - 24px)` 로 range 가 줄어 왼쪽 여백 12px 안에 들어간다.
E31. 앞으로 가기로 닿은 장은 스냅샷에 그 id 가 남아 있어 목록 모드이고 카운터와 출처가 같다.
E32. 검색 결과 카드 본문은 한 장 모드이고 재생 버튼이 없다(R30). 검색과 랭킹 목록은 출처가 되지 않는다(범위 밖).
E33. 출처 키의 스냅샷 행이 비어 있는 경우는 없다(feed-cache R6 이 지운다). 있어도 id 를 찾지 못해 한 장 모드다.
E34. 개발 모드 StrictMode 의 이중 이펙트에서 `fetchLick` 은 한 번이고 자동 재생은 재생 중으로 끝난다(R7, R11).
E35. 가로 모드는 장 좌우 거터가 safe-area 보다 작지 않다(R5).
E36. 데스크톱 한 장 모드는 넘길 장이 없어 키 안내가 "Space pauses. Esc closes." 다. 목록 모드는 "Up and Down keys move between licks. Space pauses. Esc closes." 다.
E37. 목록 모드에서 출처 목록이 `done` 이고 장이 하나뿐이어도 목록 모드다. 카운터는 "1 / 1" 이고 넘겨지지 않는다.

## 시나리오 기준 (S-n)

기획의 종료 시나리오 S1 ~ S24 를 같은 번호로 옮겼다. 이 기능의 종료 조건이다.

실행 방법.
- 개발 서버: `npm run dev -- --port 5199`. Playwright 는 `.claude/skills/verify/SKILL.md` 방식(npx 캐시 심링크, 스크래치패드의 ESM 스크립트)이다.
- 브라우저: `chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] })`. 이 플래그가 없으면 자동 재생 시나리오가 소리 정책에 막힌다.
- 폰은 390x844(isMobile, hasTouch, deviceScaleFactor 2), 태블릿은 768x1024(isMobile, hasTouch), 데스크톱은 1280x800 이다. 따로 적지 않으면 폰이다.
- 데이터는 운영 DB 의 피드다. 운영 DB 에는 아무것도 쓰지 않는다. 응답 치환은 `page.route` 로 S16, S17, S23 에서만 한다.
- S20 을 뺀 모든 시나리오는 `addInitScript` 로 localStorage `swipe-play-hint` 를 `1` 로 두고 시작한다.
- 클립보드 경로를 보려면(S13) 헤드리스 모바일 컨텍스트에 있는 `navigator.share` 를 `addInitScript(() => { delete Navigator.prototype.share; })` 로 지우고 `clipboard-read`, `clipboard-write` 권한을 준다.
- 소스를 고치는 중에는 Vite HMR 이 페이지를 다시 마운트해 상태가 바뀐다. 편집이 끝난 뒤에 돌린다.

측정 정의.
- "목록 요청": `/rest/v1/licks` 요청 중 URL 에 `id=eq.` 가 없는 것(feed-cache 와 같다). 단건 조회와 `/rest/v1/likes` 는 세지 않는다. 사이드바의 첫 로드 요청은 라우트 전환 뒤 수에 들지 않는다.
- "넘긴다": `page.$eval('.c-lp-pager', (el, n) => el.scrollBy({ top: n * el.clientHeight, behavior: 'smooth' }), n)` 뒤 700ms 기다린다. n 은 위로 넘기면 1, 아래로 넘기면 -1 이다.
- "장 i": `.c-lp-page[data-index="i"]`. "현재 장" 은 `.c-lp-counter` 의 앞 숫자 - 1 이다.
- "플레이헤드 x": 장 i 의 `[data-playhead] line` 의 `getBoundingClientRect().x`. 없으면 null.
- "재생 중": 장 i 의 플레이헤드 x 를 300ms 간격으로 두 번 재서 둘 다 null 이 아니고 다르다(swipe-play 와 같다).
- "멈춤": 장 i 의 플레이헤드가 없거나 300ms 간격 두 번이 같고, 장 i 에 `.c-lp-paused` 가 보인다.
- "빈 곳 탭": 장 i 의 `.c-lp-frame` bbox 의 왼쪽 위에서 (6, 6) 픽셀 지점을 누른다. 프레임 패딩 안이라 음표가 아니다.
- "줄": 장 i 의 `[data-note]` bbox 의 top 으로 묶은 악보 줄. 폰 4마디 릭은 줄당 1마디다.
- "첫 프레임 측정(scrollY)": 뒤로 가기 전에 `window.addEventListener('popstate', () => requestAnimationFrame(() => { window.__probe = { cards: document.querySelectorAll('.c-card').length, y: window.scrollY }; }))` 를 심고 뒤로 가기 뒤 `window.__probe` 를 읽는다(feed-cache 와 같다).
- "첫 프레임 측정(앵커)": 위와 같되 rAF 안에서 rAF 를 한 번 더 걸고 그 안에서 `{ cards, top: document.querySelector('.c-card[data-lick-id="<id>"]').getBoundingClientRect().top }` 를 적는다. 첫 rAF 는 FeedList 의 보정 rAF 보다 먼저 돌기 때문에 첫 그린 프레임의 상태를 보려면 다음 프레임에서 잰다.
- Web Audio 시계: 맥의 기본 출력 장치가 잠들면 Web Audio 시계가 멈춰 플레이헤드가 움직이지 않는다. 재생 중 판정이 실패하면 같은 페이지에서 `const c = new AudioContext(); await c.resume(); const t0 = c.currentTime; await new Promise(r => setTimeout(r, 500)); return c.currentTime - t0;` 를 잰다. 0 이면 시나리오 실패가 아니라 환경 문제로 보고하고 멈춘다.
- 로그인이 필요한 S14, S15, S22 는 Playwright 로 로그인할 수 없다(Google OAuth). 저장소에 미치는 효과는 AC 로 고정하고 verify 에서 휴대폰으로 확인해 `verdict.md` 의 휴대폰 확인 표에 적는다.

S1. Given 폰에서 Latest 가 열려 있다. When 셋째 카드의 `.c-card-play` 를 누른다. Then URL 이 `/lick/{셋째 카드 data-lick-id}` 이고, 누른 뒤 1초 안에 장 2 에 `[data-playhead]` 가 있으며 장 2 가 재생 중이다. `.c-lp-counter` 는 "3 / 20", `.c-lp-source` 는 "Latest", 템포 버튼은 "{N} bpm" 이다. 장 2 에 `h2.c-lp-title`, "Key of C" 와 `/^\d+ bars$/` 배지, `a.c-lp-author` 와 날짜, svg 악보, 태그가 있는 릭이면 `a.c-tag`, `.c-actions` 의 "Duplicate & edit", `.c-like`, "Share" 가 보인다. 셸: `.c-mappbar` 와 `.c-tabbar` 가 보이지 않고, `.community` 의 computed `padding-bottom` 이 `0px` 이며, `.c-lp` 폭 390, `.c-lp-top` 높이 56, 장 2 의 `.c-actions` 아래 변이 844 다. 태블릿 768x1024 에서 같은 조작을 하면 `.c-mappbar` 와 `.c-tabbar` 가 보이지 않고 `.c-lp` 폭이 722(1px 이내)다. 증거: `s1-open.png`, `s1-tablet.png`.

S2. Given 폰 Latest. When 셋째 카드의 `.c-cardhit` 를 누른다. Then URL 이 `/lick/{셋째 id}` 이고 카운터가 "3 / 20" 이며 1초 뒤 장 2 가 멈춤이고 `[data-playhead]` 가 없다. When 장 2 를 빈 곳 탭한다. Then 1초 안에 장 2 가 재생 중이고 플레이헤드가 첫 줄에 있다. 증거: `s2-paused.png`, `s2-playing.png`.

S3. Given S1 상태(재생 중)이고 `history.length` 를 L 로 적었다. When 위로 한 장 넘긴다. Then 카운터가 "4 / 20", URL 이 `/lick/{넷째 id}`, `history.length` 가 L 이고, 1초 안에 장 3 이 재생 중이며 장 2 에 `[data-playhead]` 가 없다. When 아래로 한 장 넘긴다. Then 카운터가 "3 / 20", URL 이 `/lick/{셋째 id}` 이고 1초 안에 장 2 의 플레이헤드가 첫 줄에서 재생 중이다. 증거: `s3-next.png`, `s3-prev.png`.

S4. Given S1 상태. When `.c-lp-count` 가 보일 때까지 최대 30초 기다린다. Then 100ms 마다 읽은 `.c-lp-count-num` 이 4, 3, 2, 1 순서로 나오고, "Again in" 이 보이며, 장 2 svg 의 computed opacity 가 0.35 다. 카운트다운이 사라진 뒤 1초 안에 플레이헤드가 첫 줄에서 재생 중이다. When 다시 카운트다운이 보일 때 위로 한 장 넘긴다. Then `.c-lp-count` 가 없고 1초 안에 장 3 이 재생 중이다. 증거: `s4-countdown.png`, `s4-restart.png`, `s4-swipe.png`.

S5. Given S2 의 멈춤 상태(장 2). When 장 2 둘째 줄의 첫 음표 `[data-note]` bbox 가운데를 누른다. Then 250ms 뒤 장 2 의 플레이헤드가 둘째 줄(플레이헤드 선의 y 범위가 그 음표 가운데 y 를 포함)에 있고 x 가 그 음표 bbox 왼쪽 - 4 이상이며 `.c-lp-paused` 가 없다. When 재생 중에 첫 줄의 둘째 음표를 누른다. Then 250ms 뒤 플레이헤드가 첫 줄에 있고 x 가 그 음표 bbox 왼쪽 - 4 이상이며, 이어서 장 2 가 재생 중이고 `.c-lp-paused` 가 없다. 증거: `s5-note.png`, `s5-renote.png`.

S6. Given S1 상태. When 장 2 를 빈 곳 탭한다. Then 장 2 가 멈춤이고 플레이헤드가 남아 있다(x 를 P 로 적는다). When 다시 빈 곳 탭한다. Then 600ms 안에 플레이헤드 x 가 P 보다 크고 장 2 가 재생 중이다. When 카운트다운이 보일 때 빈 곳 탭한다. Then `.c-lp-count` 가 없고 `.c-lp-paused` 가 보인다. When 다시 빈 곳 탭한다. Then 1초 안에 플레이헤드가 첫 줄에서 재생 중이다. 증거: `s6-paused.png`, `s6-resumed.png`, `s6-gap-restart.png`.

S7. Given S1 상태이고 템포 버튼 글자가 "{N} bpm" 이다. When 템포 버튼을 누른다. Then `.c-tb-pop` 이 보이고 그 오른쪽 변이 378(1px 이내), 왼쪽 변이 0 이상이며 템포 버튼의 `aria-expanded` 가 `true` 다. When "Faster" 를 누른다. Then 템포 버튼이 "{N + 5} bpm" 이고, 누르기 직전 플레이헤드 x 를 Q 라 하면 300ms 뒤 x 가 Q 보다 크며 같은 줄이다(처음으로 돌아가지 않는다). When 위로 한 장 넘긴 뒤 다시 아래로 한 장 넘긴다. Then 넘긴 직후 `.c-tb-pop` 이 없고, 장 2 로 돌아온 템포 버튼이 "{N} bpm" 이다. 증거: `s7-tempo.png`, `s7-reset.png`.

S8. Given 폰 Latest 에서 목록 요청을 세기 시작했다. When 셋째 카드의 재생 버튼으로 연 뒤 위로 두 장 넘겨 카운터가 "5 / 20" 이 되고 `page.goBack()`. Then `.c-lp` 가 없고 URL 이 `/` 이며, 첫 프레임 측정(앵커, 다섯째 카드 id)이 `{ cards: 20, top: 12 }`(1px 이내)이고, 1초 뒤에도 다섯째 카드 윗변이 12(1px 이내)이며, 뒤로 가기 뒤 목록 요청이 0건이다. Given 다시 Latest 를 새 컨텍스트로 열어 `window.scrollTo(0, 1200)` 뒤 scrollY 를 yBefore 로 적었다. When 보이는 카드의 `.c-cardhit` 로 연 뒤 넘기지 않고 `page.goBack()`. Then 첫 프레임 측정(scrollY)이 `{ cards: 20, y: yBefore }`(1px 이내)이고 1초 뒤에도 같으며 목록 요청이 0건이다. 증거: `s8-anchor.png`, `s8-noswipe.png`.

S9. Given S8 의 앞 절 끝 상태(앵커로 복원된 Latest). When `page.goForward()`. Then URL 이 `/lick/{다섯째 id}`, 카운터가 "5 / 20", 출처가 "Latest" 이고 1초 뒤 장 4 가 멈춤이다. 증거: `s9-forward.png`.

S10. Given 폰 Latest 에서 셋째 카드의 `.c-cardhit` 로 연 상태. When `page.reload()`. Then `.c-lp-counter` 와 `.c-lp-source` 가 없고, `.c-lp-page` 가 하나이며, `.c-lp-paused` 가 보이고 `.c-lp-hint` 가 없다. 위로 한 장 넘겨도 URL 과 장 수가 같다. When 닫기 버튼을 누른다. Then URL 이 `/` 이고 카드가 보인다. Given 새 컨텍스트에서 `page.goto('/lick/{셋째 id}')` 로 바로 열고 `history.length` 를 L 로 적었다. When 닫기 버튼을 누른다. Then URL 이 `/`, `history.length` 가 L + 1, 카드가 보인다. 증거: `s10-reload.png`, `s10-deeplink-closed.png`.

S11. Given 폰 `/ranking`. When 첫 행의 `.c-cardhit` 를 누른다. Then S10 의 첫 Then 과 같은 한 장 화면이 멈춘 채 열린다. Given 폰 Latest. When `.c-msearch-btn` 을 눌러 Latest 첫 카드 제목의 첫 단어(2자 이상)를 입력하고 1.2초 뒤 첫 릭 제안 `.c-sug` 를 누른다. Then 같은 한 장 화면이다. Given 데스크톱 Latest. When `.c-toplicks-list button` 첫째를 누른다. Then 같은 한 장 화면이 가운데 열에 열리고 `.c-appbar`, `.c-side` 가 보인다. 증거: `s11-ranking.png`, `s11-search.png`, `s11-toplicks.png`.

S12. Given 폰 Latest 에서 태그가 있는 첫 카드(k 번째)를 `.c-cardhit` 로 연 상태. When 작성자 링크 `a.c-lp-author` 를 누른다. Then URL 이 `/user/{public_id}` 다. When `page.goBack()`. Then URL 이 `/lick/{그 id}`, 카운터가 "{k} / 20", 장이 멈춤이다. When 그 장의 첫 `a.c-tag` 를 누른다. Then URL 이 `/tag/{태그}` 다. When `page.goBack()`. Then 같은 URL, 같은 카운터, 멈춤이다. 증거: `s12-user-back.png`, `s12-tag-back.png`.

S13. Given 폰, 비로그인, `navigator.share` 를 지우고 클립보드 권한을 준 Latest 에서 셋째 카드의 `.c-cardhit` 로 연 상태. When `.c-like` 를 누른다. Then "Sign in to like" 토스트가 보이고 좋아요 수가 그대로다. When "Share" 를 누른다. Then 클립보드가 `{origin}/s/{셋째 id}` 이고 "Link copied" 토스트의 아래 변이 760(2px 이내)이다. When 위로 한 장 넘겨 "4 / 20" 이 된 뒤 "Duplicate & edit" 를 누른다. Then URL 이 `/edit#v2` 로 시작한다. When 편집기의 Back(`[data-btn="back"]`)을 누른다. Then URL 이 `/lick/{넷째 id}`, 카운터가 "4 / 20", 장 3 이 멈춤이다. 증거: `s13-like.png`, `s13-share.png`, `s13-edit-back.png`.

S14. (폰, 로그인) Given Latest 에서 좋아요 수가 c 인 카드를 `.c-cardhit` 로 연 상태. When 좋아요를 눌러 c + 1 이 된 뒤 뒤로 가기. Then 그 카드의 좋아요 수가 c + 1 이다. 다시 열어 눌러 c 로 되돌리고 돌아오면 c 다. 증거: `verdict.md` 휴대폰 확인 표.

S15. (폰, 로그인) Given 내 릭에서 카드(k 번째, n 장 중)를 `.c-cardhit` 로 연 상태. When More actions, Delete lick, Delete 를 누른다. Then "Lick deleted" 토스트와 함께 다음 릭(마지막이었으면 이전 릭)이 보이고 카운터 분모가 n - 1 이다. When 뒤로 가기. Then 내 릭에 지운 릭이 없다. Given 한 장 모드(새로고침 뒤)의 내 릭. When 같은 순서로 지운다. Then `/me` 로 간다. 증거: `verdict.md` 휴대폰 확인 표.

S16. Given `page.route` 로 Latest 첫 페이지 응답의 셋째 행 `canonical_id` 를 첫 행 id 로 바꾸고 `id=eq.{셋째 id}` 단건 응답도 같게 바꾼 폰 Latest. When 셋째 카드의 `.c-cardhit` 를 누른다. Then `p.c-notice` 의 글자가 "This is a similar lick. Likes are collected on the original lick (heart icon {m})" 이고 `.c-like` 의 수가 m 이다. When "original lick" 링크를 누른다. Then URL 이 `/lick/{첫 행 id}` 이고 한 장 화면(카운터 없음)이다. When `page.goBack()`. Then URL 이 `/lick/{셋째 id}`, 카운터 "3 / 20", 멈춤이고 안내가 보인다. 증거: `s16-similar.png`, `s16-original.png`.

S17. Given `page.route` 로 Latest 첫 페이지 응답의 셋째 행 blob 을 8마디 v2 해시(swipe-play S15 와 같은 방법, 마디 수는 `npm run dump` 로 확인)로 바꾼 폰 Latest. When 셋째 카드의 `.c-cardhit` 를 누른다. Then 장 2 의 `.c-lp-body` 가 `scrollHeight > clientHeight` 이고 `.c-lp-scrollcue` "Scroll for the rest of the score" 가 보이며 장 2 의 `.c-actions` 아래 변이 844 다. When 본문을 `scrollTop = scrollHeight` 로 내린다. Then 캡션이 없다. When 위로 한 장 넘긴다. Then 카운터가 "4 / 20" 이다. 증거: `s17-long.png`, `s17-end.png`.

S18. Given 폰 Latest 에서 목록 요청을 세기 시작했다. When 열여덟째 카드의 `.c-cardhit` 로 연 뒤 위로 한 장 넘긴다. Then 카운터가 "19 / 20" 이 되고 3초 안에 "19 / 40" 이 되며 그 사이 목록 요청이 1건이다. When `page.goBack()` 하고 1초 기다린다. Then `.c-card` 가 40장이고 `data-lick-id` 가 모두 다르며 뒤로 가기 뒤 목록 요청이 0건이다. 증거: `s18-prefetch.png`, `s18-back.png`.

S19. Given 데스크톱 1280x800 Latest. When 셋째 카드의 재생 버튼을 누른다. Then `.c-appbar`, `.c-side` 가 보이고, `.c-lp-panel` 이 `.c-main` 안에 있으며 폭 692, 높이 681(각 1px 이내)이고, `.c-lp-keys` 가 "Up and Down keys move between licks. Space pauses. Esc closes." 이며, `document.activeElement` 가 `.c-lp-close` 이고, 1초 안에 장 2 가 재생 중이다. When ArrowDown. Then 1초 안에 카운터가 "4 / 20" 이다. When Space(포커스는 닫기 버튼 그대로). Then URL 이 그대로이고 장 3 이 멈춤이다. When 템포 버튼을 눌러 `.c-tb-range` 에 포커스를 두고 ArrowDown. Then 카운터가 "4 / 20" 그대로이고 템포 값이 1 줄었다. When Escape. Then `.c-tb-pop` 이 없고 URL 이 `/lick/{넷째 id}` 그대로다. When Escape. Then URL 이 `/` 이고 카드가 보인다. 증거: `s19-desktop.png`, `s19-range.png`, `s19-closed.png`.

S20. Given localStorage 를 비운 폰 Latest(힌트 키를 미리 두지 않는다). When 셋째 카드의 `.c-cardhit` 를 누른다. Then `.c-lp-hint` "Swipe up for the next lick" 이 보이고 아래 변이 760(2px 이내)이다. When 위로 한 장 넘긴다. Then 힌트가 없고 localStorage `swipe-play-hint` 가 `1` 이다. When localStorage 를 비우고 `page.reload()`(한 장 모드). Then 힌트가 없다. 증거: `s20-hint.png`, `s20-single.png`.

S21. Given S1 상태이고 각 장에 `[data-playhead]` 가 붙는 것을 기록하는 MutationObserver 를 심었다. When `page.$eval('.c-lp-pager', el => el.scrollBy({ top: 2 * el.clientHeight, behavior: 'smooth' }))` 로 두 장을 한 번에 넘기고 1.5초 기다린다. Then 카운터가 "5 / 20" 이고 장 4 가 재생 중이며 기록에 장 3 이 없다. 증거: `s21-fast.png`.

S22. (폰, 로그인) Given Create 로 릭을 만든 편집기. When Share 로 게시를 마친다. Then `/lick/{new}` 가 한 장 화면으로 멈춘 채 열린다. When 닫기를 누른다. Then R27 대로 게시 화면으로 돌아간다(Q2). When 탭 바 Latest 를 누른다. Then 새 릭이 맨 위다. 증거: `verdict.md` 휴대폰 확인 표.

S23. Given 폰. When `page.goto('/lick/zzzzzzzzzzz')`(없는 id). Then 상단 바에 닫기만 있고 "Lick not found" 와 "Back to Latest" 버튼이 보인다. "Back to Latest" 를 누르면 URL 이 `/` 다. Given `page.route` 로 Latest 첫 페이지 응답의 셋째 행 blob 을 `v2AAAA` 로 바꾼 폰 Latest. When 셋째 카드의 `.c-cardhit` 를 누른다. Then 장 2 에 "Couldn't read this score" 가 보이고 "bars" 배지, 템포 버튼, `.c-lp-paused` 가 없으며, 빈 곳 탭 뒤 1초 동안 `[data-playhead]` 가 없다. When 위로 한 장 넘기고 빈 곳 탭한다. Then 장 3 이 재생 중이다. 증거: `s23-notfound.png`, `s23-badscore.png`.

S24. Given 둘째 묶음까지 끝난 작업 트리. When 다음 명령을 실행한다. `test ! -e src/community/components/PlayOverlay.tsx && test ! -e src/community/components/PlayOverlay.test.tsx && test ! -e src/community/views/LickDetail.tsx && test ! -e src/community/views/LickDetail.test.tsx && test ! -e src/community/components/ScoreFrame.tsx`, `grep -rn "PlayOverlay\|LickDetail\|ScoreFrame\|c-play-\|\.c-play \|--scrim" src`, `bash harness/check.sh`. Then 첫 명령이 0 으로 끝나고, grep 출력이 없고, check.sh 가 통과한다. 증거: `s24-grep.txt`, `check.txt`.

## 단위 기준 (AC-n)

이 기능의 단위 테스트 이름은 파일과 상관없이 `LP-AC-n` 으로 시작한다. 예: `it('LP-AC-20 음표를 누르면 그 음부터 재생하고 프레임 토글은 돌지 않는다', ...)`.
같은 파일에 swipe-play 와 feed-cache 의 `AC-n` 테스트가 남아 있어 접두로 구분한다. 이 문서 안에서는 `AC-n` 으로 줄여 쓴다.

routing (`src/community/routing.test.ts`, 기존 파일에 추가):
AC-1. Given `history.replaceState(null, '', '/')` 와 `renderHook(useRoute)`. When `navigate('/tag/jazz')`. Then `history.state` 가 `{ from: null, autoplay: false, depth: 1 }` 이다. When `navigate('/lick/a', { from: '|', autoplay: true })`. Then `{ from: '|', autoplay: true, depth: 2 }` 이고 라우트가 `{ name: 'lick', id: 'a' }` 다.
AC-2. `readEntryState(null)`, `readEntryState('x')`, `readEntryState({ swipePlay: true })` 는 `{ from: null, autoplay: false, depth: 0 }` 이다. `readEntryState({ from: '|jazz', autoplay: true, depth: 3 })` 은 같은 값이다. `readEntryState({ from: 7, autoplay: 'yes', depth: -1 })` 은 `{ from: null, autoplay: false, depth: 0 }`, `depth: 1.5` 는 0 이다.
AC-3. Given `renderHook(useRoute)` 와 `s = routeSeq()`. When `navigate('/lick/a')`. Then `routeSeq()` 가 s + 1 이다. When `window.dispatchEvent(new PopStateEvent('popstate'))`. Then s + 2 다. When `history.replaceState(history.state, '', '/lick/b')`. Then s + 2 그대로이고 `result.current` 는 `{ name: 'lick', id: 'a' }` 그대로다.
AC-4. Given `/lick/a` 항목(state `{ from: '|', autoplay: true, depth: 1 }`)에서 `history.replaceState(history.state, '', '/lick/b')`. When `navigate('/edit#v2x')` 뒤 `navigate('/publish#v2x')` 뒤 `navigate('/edit#v2x')`. Then `lastCommunityEntry()` 가 `{ path: '/lick/b', state: { from: '|', autoplay: true, depth: 1 } }` 다(편집과 게시 위치에서의 navigate 는 덮지 않는다).

feed-store (`src/community/feed-store.test.ts`, 기존 파일에 추가):
AC-5. Given 키 `'|'` 에 스냅샷. When `setLastViewed('|', 'b')`. Then `get('|').lastViewedId` 가 `'b'` 다. 이어서 `appendPage`, `setCount`, `remove('zz')` 뒤에도 `'b'` 다. `set('|', 칸 없는 스냅샷)` 뒤에는 `'lastViewedId' in get('|')` 가 false 다. 스냅샷이 없는 키의 `setLastViewed` 는 `get` 이 undefined 그대로다.
AC-6. `parseFeedKey('|')` 는 둘 다 undefined, `parseFeedKey('|jazz')` 는 `{ authorId: undefined, tag: 'jazz' }`, `parseFeedKey('u1|')` 는 `{ authorId: 'u1', tag: undefined }`, `parseFeedKey('|a|b')` 는 `{ authorId: undefined, tag: 'a|b' }` 다. `feedLabel('|', rows)` 는 "Latest", `feedLabel('|jazz', rows)` 는 "#jazz", `feedLabel('u1|', [display_name 'Author Z' 행])` 는 "Author Z", `feedLabel('u1|', [profiles null 행])` 와 `feedLabel('u1|', [])` 는 "Licks" 다.

Root (`src/community/Root.test.tsx`, 기존 파일에 추가):
AC-7. When `renderAt('/lick/abc')`. Then `.community` 가 `community--lick` 클래스를 갖고, `.c-lp` 가 있으며, `.c-appbar`, `.c-side`, `.c-mappbar`, `.c-tabbar` 가 DOM 에 있다. `renderAt('/')` 의 `.community` 는 `community--lick` 이 없다.
AC-8. Given `fetchLick` 을 호출 수를 세는 `vi.fn` 으로 바꾸고 `renderAt('/lick/abc')`. When `act(() => navigate('/lick/abc'))`. Then `fetchLick` 이 두 번 불렸다(새 마운트). When `act(() => history.replaceState(history.state, '', '/lick/def'))`. Then 세 번째 호출이 없다.
AC-9. Given `/lick/abc` 에서 `history.replaceState({ from: '|', autoplay: true, depth: 1 }, '', '/lick/def')` 뒤 `act(() => navigate('/edit#' + 유효한 v2 해시))` 로 편집기가 렌더됐다. When 편집기의 Back(`[data-btn="back"]`)을 누른다. Then `location.pathname` 이 `/lick/def` 이고 `history.state` 의 `from` 이 `'|'`, `autoplay` 가 false 다.

LickCard (`src/community/components/LickCard.test.tsx`, AC-5 와 AC-6 테스트를 바꿔 쓴다. `../routing` 의 navigate 를 `vi.fn` 으로 mock):
AC-10. Given 읽을 수 있는 blob 의 행 a 와 `from="|"`. Then `[aria-label="Play"]` 가 `.c-cardhit` 밖에 있다. When Play 클릭. Then `navigate` 가 `('/lick/a', { from: '|', autoplay: true })` 로 한 번 불린다. When `.c-cardhit` 클릭. Then `('/lick/a', { from: '|', autoplay: false })` 로 불린다.
AC-11. Given `from` 이 없다. Then Play 버튼이 없고, `.c-cardhit` 클릭은 `navigate` 를 인자 하나 `'/lick/a'` 로 부른다(`mock.calls[0]` 의 길이가 1). Given `from="|"` 이지만 blob 이 `'invalid-blob'` 이다. Then Play 버튼이 없다.

Feed (`src/community/views/Feed.test.tsx`, 기존 파일에 추가. routing mock 에 `navigate: vi.fn()` 을 더한다):
AC-12. Given 읽을 수 있는 blob 의 행 p 를 받는 Latest 새 마운트. When 카드의 Play 클릭. Then `navigate` 가 `('/lick/p', { from: '|', autoplay: true })` 로 불리고 `.c-play` 와 `.c-lp` 가 없다. 같은 조작이 `tag="bebop"` 이면 `from: '|bebop'`, `authorId="author-1"` 이면 `from: 'author-1|'` 다.
AC-13. Given 스냅샷 `{ rows: [original, similar], ..., scrollY: 1200, lastViewedId: 'sim-1' }`, `lastNavKind` `'history'`, `Element.prototype.getBoundingClientRect` 가 `data-lick-id="sim-1"` 카드에 top 900, 그 밖에 top 0 을 돌려주는 spy, `window.scrollY` 0. When render. Then 카드 루트에 `data-lick-id` 가 있고 `window.scrollTo` 가 `(0, 888)` 로 불렸다. spy 를 top 500 으로 바꾸고 rAF 콜백을 실행하면 `(0, 488)` 로 한 번 더 불린다. Given `lastViewedId: 'gone'` 이면 두 호출 모두 `(0, 1200)` 이다.
AC-14. Given AC-13 의 스냅샷으로 복원 마운트한 뒤 `window.scrollY` 를 640 으로 둔다. When unmount. Then `feedStore.get('|')` 에 `lastViewedId` 키가 없고 `scrollY` 가 640 이다.

OverflowMenu (`src/community/components/OverflowMenu.test.tsx`, 새 파일):
AC-15. Given `<OverflowMenu isOwner onDelete={fn} />` 와 그 밖의 `<button>바깥</button>`. When More actions 클릭으로 메뉴를 연 뒤 바깥 버튼에 포커스를 두고 `fireEvent.keyDown(document, { key: 'Escape' })`. Then `[role="menu"]` 가 없다. 메뉴 안 ArrowDown 은 지금처럼 항목 포커스를 옮긴다.

LickPage 한 장 모드 (`src/community/views/LickPage.test.tsx`, 새 파일. player 는 `createFakeAudioSink` 와 `createFakeClock` 으로 만든 실제 player 이고 호출 인자는 `vi.spyOn(player, 'play')` 로 본다. `../api/licks`, `../api/likes` 는 `LickDetail.test.tsx` 의 mock 을 옮긴다. `../routing` 은 실제 모듈에 `navigate: vi.fn()`, `lastNavKind: vi.fn()` 을 덮는다. IntersectionObserver 는 `PlayOverlay.test.tsx` 의 수동 mock 이다. `window.scrollTo` 와 `history.back` 은 `vi.spyOn` 으로 막는다. 테스트마다 `feedStore.clear()` 와 `history.replaceState(null, '', '/lick/orig-1')` 로 시작한다):
AC-16. Given `history.state` null, `fetchLick` 이 original(태그 없음)을, `fetchLikeCounts` 가 `{ orig-1: 3 }` 을 돌려준다. When `render(<StrictMode><LickPage id="orig-1" user={null} player={player} /></StrictMode>)`. Then `fetchLick` 이 한 번, `fetchLikeCounts` 가 `['orig-1']` 로 불리고, `window.scrollTo` 가 `(0, 0)` 으로 불렸으며, 구조가 `.c-lp > .c-lp-panel > .c-lp-top` 와 `.c-lp-pager > .c-lp-page[data-index="0"] > .c-lp-body` 와 `.c-actions` 다. `.c-lp-page` 가 하나, `.c-lp-counter` 와 `.c-lp-source` 가 없다. "Original lick", "Key of C", "{barCount} bars", "Author A" 링크, 날짜, svg, "Duplicate & edit", "heart icon 3", "Share" 가 있고 `.c-tags` 가 없으며 "Transpose", "Download" 글자가 없다. `player.isPlaying()` 이 false 이고 `.c-lp-paused` 가 있다.
AC-17. Given `fetchLick` 이 해결되지 않는다. Then `.c-lp-page[aria-busy="true"]` 와 `.c-skel` 이 있고 상단 바에 닫기 버튼만 있다. Given null. Then "Lick not found" 와 "Back to Latest" 버튼이 있고 누르면 `navigate('/')`. Given 한 번 reject 뒤 original. Then "Couldn't load this lick." 와 Retry 가 있고 Retry 를 누르면 "Original lick" 이 보이며 `fetchLick` 이 두 번 불렸다.
AC-18. Given blob 이 `'invalid-blob'` 인 행. Then "Couldn't read this score", 제목, "Key of C" 가 있고 "bars" 배지, `[aria-label^="Tempo"]`, `.c-lp-paused` 가 없다. When 프레임 클릭과 Space keydown. Then sink 에 이벤트가 없다. 목록 모드에서 그 행이 현재 장이 돼도 같다.
AC-19. Given AC-16 의 한 장 모드. When 프레임의 빈 곳(`.c-lp-frame` 자신)을 클릭. Then `play` 가 `(demoSong 과 같은 곡, { melody: true, accomp: true, metro: true }, 0, total(demoSong), { gapBeats: 4 })` 로 불리고 `.c-lp-paused` 가 없다. 시각을 4 스텝 흘려 tick 을 받은 뒤 다시 클릭하면 `isPlaying()` 이 false, `[data-playhead]` 가 남는다. 다시 클릭하면 `play` 의 fromStep 이 4 다. 언마운트하면 `isPlaying()` 이 false 다.
AC-20. Given AC-16 의 한 장 모드(멈춤). When `s` 가 0 이 아닌 음표의 `[data-note]` 를 클릭. Then `play` 가 한 번, fromStep 이 그 음표의 `s`, 다섯째 인자가 `{ gapBeats: 4 }` 이고 `isPlaying()` 이 true 다(프레임 토글이 같이 돌았다면 false). When 다른 음표를 클릭. Then fromStep 이 그 음표의 `s` 로 한 번 더 불리고 재생 중이다. When 간격에 들어가 `onGap` 이 3 을 알린 뒤 음표를 클릭. Then 카운트다운이 사라지고 그 음표의 `s` 부터 재생한다.
AC-21. Given 재생 중. When 곡 끝을 지나 `onGap` 이 4 를 알린다. Then `.c-lp-count-num` "4", "Again in", `.c-lp-frame--dim` 이 있다. When 한 박 뒤. Then "3" 이고 `.on` 점이 하나다. When 프레임 클릭. Then `.c-lp-count` 가 없고 `.c-lp-paused` 가 있다. When 다시 클릭. Then fromStep 0 으로 재생한다(간격 전에 스텝 50 tick 을 흘려 둔다).
AC-22. Given 재생 중. When 템포 버튼으로 팝오버를 열고 프레임에 `pointerDown`, `mouseDown`, `click` 을 차례로 보낸다. Then `.c-tb-pop` 이 없고 `isPlaying()` 이 true 이며 `play` 호출 수가 그대로다. 같은 순서를 `[data-note]` 에 보내도 같다. Given 작성자 로그인으로 More actions 메뉴를 연 상태. Then 같은 순서 뒤 `.c-menu` 가 없고 재생 상태가 그대로다.
AC-23. Given 템포 100 곡이 재생 중이고 tick 이 스텝 6.5 다. When 템포 버튼, Faster 클릭. Then 버튼이 "105 bpm", `play` 가 `({ ...song, tempo: 105 }, ..., 6, total, { gapBeats: 4 })` 로 불린다. Given 간격 중. When Faster. Then fromStep 0 이다. Given 멈춤. When Slower. Then 버튼이 "95 bpm" 이고 `play` 가 불리지 않으며 다음 빈 곳 탭의 곡 템포가 95 다.
AC-24. Given user null. When `.c-like` 클릭. Then 토스트 "Sign in to like" 가 `.c-lp-panel` 안의 `.c-toast.c-lp-toast[role="status"]` 이고 `addLike` 가 안 불린다. 1600ms 뒤 토스트가 없다. Given user2, 수 7. When 클릭. Then `addLike('orig-1')`, "heart icon 8", `feedStore.setCount('orig-1', 8)`. 해결 전 재클릭은 무시된다(`addLike` 한 번, 버튼 disabled). `addLike` 가 reject 면 "heart icon 7", `setCount('orig-1', 7)`, "Like failed". 유사 릭이면 대상이 `'orig-1'` 이다. Given `user={null}` 로 마운트 뒤 `rerender` 로 user2. Then `fetchMyLikedSet('author-2')` 가 한 번 불린다.
AC-25. Given `navigator.share` 가 없고 `navigator.clipboard.writeText` 가 spy. When `getByRole('button', { name: 'Share' })` 클릭. Then `writeText` 가 `${location.origin}/s/orig-1` 로 불리고 "Link copied" 토스트가 있다. 버튼 안에 `.c-share-label` 이 있다. Given `navigator.share` 가 spy. Then `{ title: 'Original lick', url }` 로 불리고 `writeText` 는 안 불린다.
AC-26. When "Duplicate & edit" 클릭. Then `navigate` 가 `'/edit#' + blob` 으로 불린다. Given 재생 중. When unmount. Then `isPlaying()` 이 false 다.
AC-27. Given 태그 `['jazz']` 인 유사 릭(canonical `orig-1`, 원본 수 7). Then `p.c-notice` 글자가 "This is a similar lick. Likes are collected on the original lick (heart icon 7)" 이다. When "original lick" 클릭. Then `navigate` 가 인자 하나 `'/lick/orig-1'` 로 불린다. When "Author B" 클릭. Then `navigate('/user/pub-2')`. When "#jazz" 클릭. Then `navigate('/tag/jazz')`. 세 링크의 `href` 는 각각 `/lick/orig-1`, `/user/pub-2`, `/tag/jazz` 다.
AC-28. Given user2(작성자 아님). Then More actions 가 없다. Given user1(작성자). When More actions, "Delete lick", Delete. Then `deleteLick('orig-1')`, `feedStore.remove('orig-1')` 가 `navigate('/me')` 보다 먼저 불린다. Cancel 이면 `deleteLick` 과 `navigate` 가 안 불리고 다이얼로그가 닫힌다. `deleteLick` 이 reject 면 다이얼로그 안에 "Delete failed. Please try again." 이 있고 `navigate` 가 안 불린다.
AC-29. Given `history.state` null. Then 마운트 뒤 `document.activeElement` 가 `.c-lp-close` 다. When 닫기 클릭. Then `navigate('/')`, `history.back` 은 안 불린다. Given state `{ from: null, autoplay: false, depth: 1 }`. When 닫기 클릭. Then `history.back` 이 불리고 `navigate` 는 안 불린다. 두 경우 모두 `fireEvent.keyDown(document.body, { key: 'Escape' })` 도 같다.
AC-30. Given 재생 중. When 닫기 버튼에 `keyDown(' ')`. Then `isPlaying()` 이 false, 이벤트의 `defaultPrevented` 가 true, `navigate` 와 `history.back` 이 안 불린다. Given 템포 팝오버가 열림. When `.c-tb-range` 에 `keyDown('ArrowDown')`. Then 재생 상태가 그대로다. When `.c-lp-close` 에 `keyDown('Escape')`. Then `.c-tb-pop` 이 없고 `navigate` 와 `history.back` 이 안 불린다. Given 작성자로 메뉴가 열리고 포커스를 `.c-lp-close` 로 옮겼다. When `keyDown('Escape')`. Then `.c-menu` 가 없고 화면이 닫히지 않는다. Given `.c-lp` 밖의 `<input>`. When 거기에 `keyDown(' ')`. Then 재생 상태가 그대로다. When `keyDown(' ', { metaKey: true })` 를 body 에. Then 그대로다.
AC-31. Given 장 본문의 `scrollHeight` 1000, `clientHeight` 700, `scrollTop` 0 (`Object.defineProperty`). When 본문에 scroll 이벤트. Then `.c-lp-body--more` 와 "Scroll for the rest of the score" 가 있다. `scrollTop` 을 299 로 두고 scroll 이벤트. Then 둘 다 없다.

LickPage 목록 모드 (`src/community/views/LickPage.test.tsx`, 같은 파일. 행은 `PlayOverlay.test.tsx` 의 첫 음이 다른 세 곡 a, b, c 다. 테스트마다 `feedStore.set('|', { rows: [a, b, c], counts: Map{a: 3}, cursor: c.created_at, done: true, total: null, scrollY: 0 })` 과 `history.replaceState({ from: '|', autoplay: false, depth: 1 }, '', '/lick/b')`. `.c-lp-pager` 의 `clientHeight` 는 `Object.defineProperty` 로 500):
AC-32. When `render(<LickPage id="b" .../>)`. Then 장이 셋, 카운터 "2 / 3", 출처 "Latest", 페이저 `scrollTop` 1000 이고 `fetchLick` 과 `fetchLikeCounts` 가 안 불렸다. Given URL id 가 `zz`(행에 없음). Then 한 장 모드(`fetchLick('zz')`). Given state 의 `from` 이 null. Then 한 장 모드. Given 저장소에 스냅샷이 없고, 같은 커밋에서 언마운트되는 컴포넌트가 `useLayoutEffect` 정리에서 그 스냅샷을 `set` 한다(`render(<Writer/>)` 뒤 `rerender(<LickPage id="b" .../>)`). Then 목록 모드다.
AC-33. Given `lastNavKind` 가 `'navigate'`, state `autoplay: true`. When `render` 를 `StrictMode` 로 감싼다. Then `isPlaying()` 이 true 이고 sink 의 첫 melody 가 b 의 첫 음, t 0 이다. Given `'history'` 와 `autoplay: true`. Then 멈춤이다. Given `'navigate'` 와 `autoplay: false`. Then 멈춤이다. Given 한 장 모드(행에 없는 id)와 `'navigate'`, `autoplay: true`. Then 멈춤이다.
AC-34. Given AC-33 의 재생 중. When IO 콜백으로 장 2 가 60% 보이고 200ms 지난다. Then c 가 0 부터 재생되고, `history.replaceState` 가 `({ from: '|', autoplay: true, depth: 1 }, '', '/lick/c')` 로 불렸고, `pushState` 는 안 불렸으며, 카운터가 "3 / 3", 템포 버튼이 c 의 템포다. 장 1 에서 템포를 바꿔 둔 뒤 넘겼으면 c 의 원 템포이고, 팝오버를 열어 둔 뒤 넘겼으면 `.c-tb-pop` 이 없다. Given 멈춤. When 같은 넘김. Then `play` 가 안 불린다.
AC-35. When 마운트만 한다(IO 가 시작 장 1 을 알려도). Then `feedStore.get('|')` 에 `lastViewedId` 키가 없다. When 장 0 으로 넘긴다. Then `lastViewedId` 가 `'a'` 다. 이어서 장 1 로 넘기면 `'b'` 다.
AC-36. Given 스냅샷 `done: false`, 커서 `c.created_at`, 키 `'|jazz'`(state `from: '|jazz'`), URL `/lick/a`, `fetchFeedPage` 가 해결되지 않는 Promise. When 장 1 로 넘긴다. Then `fetchFeedPage` 가 `(c.created_at, { authorId: undefined, tag: 'jazz' })` 로 한 번 불린다. 해결 전에 장 2 로 넘겨도 다시 불리지 않는다. When 행 d 와 counts `{ d: 2 }` 로 해결된다. Then 장이 넷, 카운터 분모 4, `feedStore.appendPage` 가 `('|jazz', [d], Map{d: 2}, true)` 로 불렸다(`PAGE_SIZE` 미만이라 done). Given 같은 상태에서 해결 전에 unmount. When 해결된다. Then `appendPage` 가 안 불리고 저장소 행이 셋이다.
AC-37. Given `done: true`, URL `/lick/c`. Then 장 2 에 "This is the last lick in #jazz"(키 `'|jazz'`) 가 있다. Given `done: false` 이고 `fetchFeedPage` 가 reject. When 마지막에서 두 번째 장에 이른다. Then 마지막 장에 "Couldn't load more" 와 Retry 가 있고 Retry 를 누르면 `fetchFeedPage` 가 한 번 더 불린다.
AC-38. Given b 가 재생 중이고 미리 받기가 진행 중이다. When 다음 페이지가 반영된다. Then `play` 호출 수가 그대로다.
AC-39. Given localStorage 가 비었다. Then `.c-lp-hint` 가 있다. When 현재 장이 바뀐다. Then 힌트가 없고 `swipe-play-hint` 가 `'1'` 이다. 처음부터 `'1'` 이면 없다. 한 장 모드는 localStorage 가 비어도 없다.
AC-40. 출처 라벨 렌더: 키 `'|'` 는 "Latest", `'|bebop'` 은 "#bebop", `'author-1|'` 은 첫 행 display_name 이다.
AC-41. Given 스냅샷 counts `{ b: 4 }`, user2, `fetchMyLikedSet` 이 빈 집합. Then 마운트 때 `fetchMyLikedSet` 이 한 번이다. When 장 1 의 `.c-like` 클릭. Then "heart icon 5" 와 `feedStore.setCount('b', 5)`. When 장 2 로 넘긴다. Then `fetchMyLikedSet` 이 여전히 한 번이다.
AC-42. Given user 가 b 의 작성자(행 셋 모두 author-1, user1), b 가 현재 장(인덱스 1), 멈춤. When More actions, Delete lick, Delete. Then `feedStore.remove('b')`, 장이 둘, 카운터 "2 / 2", 현재 장 c, `replaceState` 가 `'/lick/c'` 로, `lastViewedId` 가 `'c'`, 토스트 "Lick deleted", `navigate` 안 불림, `play` 안 불림. 재생 중이었으면 c 가 0 부터 재생된다. Given URL `/lick/c`(마지막 장). When 삭제. Then 현재 장이 b, 카운터 "2 / 2" 다. Given 스냅샷 행이 하나뿐. When 삭제. Then `navigate('/me')`.
AC-43. Given 목록 모드. When `keyDown('ArrowDown')` 을 body 에. Then 페이저 `scrollBy` 가 `{ top: 500, behavior: 'smooth' }` 로 불리고 기본 동작이 막혔다. `ArrowUp` 은 `{ top: -500, behavior: 'smooth' }` 다. 한 장 모드의 `ArrowDown` 은 `scrollBy` 를 부르지 않고 `defaultPrevented` 가 false 다.

## 구현 태스크

동작 단위로 나눈다. 태스크마다 "구현, 단위 테스트, 개발 서버에서 실제 실행, 해당 S-n 통과, 커밋" 이다. 커밋 나누기는 전역 규칙(이동과 변경 분리, Python 외 코드도 작은 커밋)을 따른다.
파일 삭제는 Claude Code 권한 분류기가 막으면(`harness/PROGRESS.md` 막힌 것 절) 사용자에게 `git rm` 명령을 요청한다.

첫 묶음: 한 장 모드로 LickDetail 을 대체한다. 오버레이(`PlayOverlay`)와 카드 재생 버튼은 그대로다. 카드 본문은 아직 state 없이 navigate 하므로 모든 진입이 한 장 모드다.

| id | 동작 | 포함 AC | 처음 동작시키는 S | 완료 조건 |
|---|---|---|---|---|
| T1 | routing: `EntryState`, `readEntryState`, `navigate(path, state?)` 와 depth, `routeSeq` | AC-1, AC-2, AC-3 | 없음(바탕) | 단위 테스트, feed-cache AC-7 그대로 통과 |
| T2 | LickPage 한 장 모드: 불러오기와 상태 화면, 장 구성(머리, 배지, 메타 링크, 유사 릭 안내, 악보 프레임, 태그, 액션 행), 상단 바의 닫기, Root 의 lick 라우트 교체와 `key={routeSeq()}`. `LickDetail.tsx`, `ScoreFrame.tsx` 삭제와 `LickDetail.test.tsx` 의 이전(표대로) | AC-8, AC-16, AC-17, AC-18, AC-27, AC-29 | S23 앞 절(없는 릭) | 단위 테스트, `s23-notfound.png` |
| T3 | 셸 분기와 레이아웃: `community--lick`, `.c-lp*` 스타일(`.c-play*` 를 옮겨 씀), 액션 행 스타일과 Share 라벨, 토스트 자리, 데스크톱 가운데 열 패널과 키 안내, `window.scrollTo(0, 0)`. 지우는 것 절의 상세 CSS(`.c-detail` 부터 푸터 절 `.c-tags` 까지) 삭제 | AC-7 | S10, S11 | 단위 테스트, `s10-*.png`, `s11-*.png` |
| T4 | 재생: 빈 곳 탭, 음표 탭과 이중 처리 방지, 4박 간격 반복과 카운트다운, 멈춤 표시, 팝오버나 메뉴가 열린 채 시작한 탭, 긴 릭 판정 | AC-19, AC-20, AC-21, AC-22, AC-31 | S2, S5, S6, S4 첫 Then, S17 첫 Then(한 장 모드, 단건 응답 치환) | 단위 테스트, `s2-*.png`, `s5-*.png`, `s6-*.png`, `s4-countdown.png`, `s4-restart.png` |
| T5 | 템포: 상단 바 TempoControl, 오른쪽 정렬 팝오버, 재생 중 이어 재생, 간격 중 0 부터 | AC-23 | S7 의 Faster 까지 | 단위 테스트, `s7-tempo.png` |
| T6 | 액션: 좋아요(`setCount`, 대상마다 단일 요청, user 변경 때 집합), 공유, 복제 편집, 한 장 모드 삭제, 토스트 | AC-24, AC-25, AC-26, AC-28 | S13 의 좋아요와 공유와 복제 편집 왕복, S16(단건 응답 치환으로), S23 뒷 절(단건 응답 치환으로), S22(휴대폰), S15 의 한 장 모드 절(휴대폰) | 단위 테스트, `s13-like.png`, `s13-share.png`, `s16-*.png`, `s23-badscore.png` |
| T7 | 키보드: 닫기 버튼 포커스, Space, Esc, 팝오버와 메뉴와 다이얼로그 거르기, `OverflowMenu` 의 문서 Esc | AC-15, AC-30 | 없음(S19 는 둘째 묶음) | 단위 테스트, 데스크톱 한 장 모드에서 Space 와 Esc 를 손으로 확인 |

첫 묶음이 끝난 상태에서 통과해야 하는 시나리오: S2, S5, S6, S10, S11, S23 전부. S4 의 첫 Then, S7 의 Faster 까지, S13 의 좋아요와 공유와 복제 편집 왕복(카운터 확인 제외), S16 과 S17 첫 Then 은 단건 응답 치환으로 한 장 모드에서 통과한다. `harness/check.sh` 가 통과하고 오버레이 재생(swipe-play S1 ~ S16)이 지금처럼 동작한다.

둘째 묶음: 목록 모드, 오버레이와 Feed `playAt` 제거, 앵커, 편집기 Exit, 데스크톱과 키보드, 문서.

| id | 동작 | 포함 AC | 처음 동작시키는 S | 완료 조건 |
|---|---|---|---|---|
| T8 | 저장소: `lastViewedId`, `setLastViewed`, `parseFeedKey`, `feedLabel` | AC-5, AC-6 | 없음(바탕) | 단위 테스트, feed-cache AC-1 ~ AC-6 그대로 통과 |
| T9 | 목록 모드 진입: 모드 판정, 시작 장, 카운터와 출처 라벨, 자동 재생 조건. LickCard 의 `from` 과 재생 버튼 navigate, FeedList 가 `from={key}` 를 넘기고 `playAt` 과 오버레이 마운트를 뺀다. LickCard 와 Feed 테스트 변경(표대로) | AC-10, AC-11, AC-12, AC-32, AC-33, AC-40 | S1, S2(목록 모드로 다시) | 단위 테스트, `s1-*.png`, `s2-*.png` 재촬영 |
| T10 | 넘기기: 페이저와 현재 장, `replaceState`, 장 전환 재생, 템포와 팝오버 리셋, 힌트, 앵커 쓰기 | AC-34, AC-35, AC-39 | S3, S4 뒷 Then, S7 전부, S12, S17 전부, S20, S21 | 단위 테스트, `s3-*.png`, `s4-swipe.png`, `s7-reset.png`, `s12-*.png`, `s17-*.png`, `s20-*.png`, `s21-fast.png` |
| T11 | 오버레이 제거: `PlayOverlay.tsx` 와 테스트 삭제(표대로 이전 확인), Feed 의 라벨과 `onCount`, `1152f70` 의 prop 전달 되돌리기, `.c-play*` CSS, `--scrim`, 주석의 옛 이름 | 없음 | S24 | `s24-grep.txt`, check.sh |
| T12 | 미리 받기와 `appendPage`, 목록 끝과 실패 | AC-36, AC-37, AC-38 | S18 | 단위 테스트, `s18-*.png` |
| T13 | 목록 모드 좋아요와 삭제 뒤 이웃 이동 | AC-41, AC-42 | S14, S15(휴대폰) | 단위 테스트 |
| T14 | 돌아온 목록 앵커: FeedList 복원의 목표 식, 되쓰기에 칸 없음, LickCard `data-lick-id` | AC-13, AC-14 | S8, S9 | 단위 테스트, feed-cache AC-8 ~ AC-15 그대로 통과, `s8-*.png`, `s9-forward.png` |
| T15 | 편집기 Exit 의 state: `lastCommunityEntry`, Root `onExit`, Root 의 `lastCommunityPath` 삭제 | AC-4, AC-9 | S13 의 카운터 확인 | 단위 테스트, `s13-edit-back.png` |
| T16 | 데스크톱 목록 모드와 방향키 | AC-43 | S19 | 단위 테스트, `s19-*.png` |
| T17 | 문서 | 없음 | 없음 | 아래 문서 항목을 고치고 커밋 |

T17 문서 항목.
- `docs/product/SPEC.md` 4.1 절을 `### 4.1 릭 화면 (/lick/:id, lick-page)` 으로 고쳐 쓴다. 내용: 목록 카드에서 열면 그 목록 순서로 위아래로 넘기고 URL 이 현재 릭을 따라간다(replaceState), 카드 재생 버튼은 바로 재생하고 카드 본문은 멈춘 채 연다, 출처 없는 진입은 한 장이고 멈춘 채, 악보의 음표 탭은 그 음부터 재생이고 빈 곳 탭은 멈춤과 재개, 끝나면 4박 무음 뒤 반복, 템포는 상단 바이고 장마다 원 템포, 작성자와 태그와 원본은 링크, 닫기와 뒤로 가기는 목록으로, 폰과 태블릿은 전체 화면이고 데스크톱은 가운데 열. 끝에 "상세 규칙은 `docs/features/lick-page/03-spec.md`."
- 4절 열람 설명에 "음표 탭 = 그 위치부터 재생" 이 `/lick/:id` 에도 적용된다는 한 줄.
- 4.2 절에 "넘긴 뒤 돌아오면 마지막으로 본 릭의 카드 윗변이 화면 위 12px 에 오고, 넘기지 않았으면 떠날 때 위치다" 한 줄.
- `harness/DECISIONS.md` 에 `## 2026-11-13` 을 두고 항목: 상세와 오버레이를 `/lick/:id` 하나로 합쳤다. 넘기기는 replaceState 라 뒤로 가기 한 번이 목록이다. 출처는 `history.state` 의 `from` 이고 몇 번째 장인지는 URL id 에서 유도한다. 자동 재생은 navigate 이고 `autoplay` 일 때만이다. 닫기는 depth 규칙이다. 폰과 태블릿은 셸 없는 전체 화면, 데스크톱은 가운데 열. 돌아온 목록은 넘겼으면 마지막 카드 앵커. 반복 구간은 재생을 시작한 스텝부터다(Q1 의 답에 따라 고친다). 화면 key 는 popstate 일련번호다.
- `harness/PROGRESS.md` 갱신. swipe-play 평가자 발견 5(startIndex 가 줄 때 R5 효과)는 오버레이와 함께 사라졌다고 남은 작업 후보에서 지운다.
- `docs/features/swipe-play/03-spec.md` 와 `docs/features/feed-cache/03-spec.md` 는 고치지 않는다(당시 기준의 기록이다).

## 테스트 목록

| id | 종류 | 파일 |
|---|---|---|
| S1 ~ S13, S16 ~ S21, S23 | 시나리오 | Playwright 스크립트(스크래치패드), 증거 `harness/evidence/lick-page/s*.png` |
| S24 | 시나리오(명령) | `harness/evidence/lick-page/s24-grep.txt`, `check.txt` |
| S14, S15, S22 | 시나리오(휴대폰) | `harness/evidence/lick-page/verdict.md` 휴대폰 확인 표 |
| LP-AC-1 ~ LP-AC-4 | 단위 | `src/community/routing.test.ts` |
| LP-AC-5, LP-AC-6 | 단위 | `src/community/feed-store.test.ts` |
| LP-AC-7 ~ LP-AC-9 | 단위 | `src/community/Root.test.tsx` |
| LP-AC-10, LP-AC-11 | 단위 | `src/community/components/LickCard.test.tsx` |
| LP-AC-12 ~ LP-AC-14 | 단위 | `src/community/views/Feed.test.tsx` |
| LP-AC-15 | 단위 | `src/community/components/OverflowMenu.test.tsx` (새 파일) |
| LP-AC-16 ~ LP-AC-43 | 단위 | `src/community/views/LickPage.test.tsx` (새 파일) |
| swipe-play AC-1 ~ AC-4 | 단위(그대로) | `src/adapters/player.test.ts` |
| feed-cache AC-1 ~ AC-15, AC-18 ~ AC-20 | 단위(그대로) | 각 파일 그대로 |

## 검증 증거

verify 단계에서 `harness/evidence/lick-page/` 에 남길 것.
- `check.txt`: `harness/check.sh` 출력.
- 시나리오별 스크린샷. 파일명은 시나리오 기준에 적은 대로.
- `s24-grep.txt`: S24 의 세 명령과 출력.
- `verdict.md`: 시나리오별 PASS 와 실행 조건(뷰포트, 응답 치환 여부). 숫자로 재는 값(S1 셸 치수, S8 첫 프레임 측정과 1초 뒤 값, S18 목록 요청 수, S19 패널 치수)을 표에 적는다. 휴대폰 확인 표에 S14, S15, S22 의 확인 날짜와 결과를 적는다. Web Audio 시계 때문에 멈췄으면 그 측정값을 적는다.

## 제품 명세와 다른 점

- `docs/product/SPEC.md` 4.1 절의 "라우트가 아니라 목록 위 오버레이" 와 "음표 탭으로 그 위치부터 재생하는 열람 동작은 여기에 없다" 와 "작성자와 태그는 표시만" 을 뒤집는다. 2026-11-11 사용자 결정(INTAKE 개정 3)이다. T17 이 4.1 절을 고쳐 쓴다.
- SPEC 4절 열람의 "음표 탭 = 그 위치부터 끝까지 재생" 은 이 화면에서 4박 간격 반복과 함께 적용된다. 끝까지 재생한 뒤 멈추지 않고 그 음부터 반복한다(R10, Q1).
- SPEC 4.2 절의 "떠날 때의 행과 스크롤 위치로 되살린다" 는 넘기지 않았을 때로 좁아진다. 넘겼으면 마지막 릭 카드 앵커다(2026-11-13 사용자 결정 Q2).

## 기획과 디자인에서 명세가 정한 것과 다른 점

- 새로고침과 depth (E4). 기획 구조 2 는 "첫 항목(딥링크, 새로고침)은 state 가 없어 0" 이라 했지만 기획 사실 절대로 새로고침은 state 를 남긴다. 새로고침 뒤 닫기는 `history.back()` 이고 직전 항목은 같은 사이트다. S10 은 Latest 에서 연 뒤 새로고침하므로 닫기 결과가 `/` 로 기획과 같다. 딥링크 경우를 S10 에 더했다.
- 한 장 모드의 깨진 blob (E19). 상세는 "Couldn't read this score" 와 Back to Latest 만 그렸다. 이 화면은 목록 모드의 깨진 악보 장(디자인 `#s23-badscore`)과 같은 장을 그린다. 같은 데이터를 두 모양으로 그리지 않기 위해서다.
- 데스크톱 한 장 모드의 키 안내 (E36). 디자인은 목록 모드 문구만 정했다. 한 장 모드에는 넘길 장이 없어 "Space pauses. Esc closes." 로 둔다. 자리(24px)는 같다.
- `OverflowMenu` 의 문서 Esc (R28). 디자인의 "포커스 위치와 상관없이 Esc 는 열린 것만 닫는다" 를 메뉴에도 지키려면 메뉴 밖에 포커스가 있을 때도 닫혀야 한다. 지금 메뉴는 메뉴 안 keydown 에서만 닫힌다. 카드의 메뉴에도 같이 적용된다.
- 푸터 절 `.c-tags` 규칙 삭제(지우는 것 절). 상세 푸터용 규칙이 전역 `.c-tags` 에 걸려 있어 장 본문의 태그 위치를 틀어 지운다. 카드에는 보이는 변화가 없다.
- 편집기 Exit 의 기록 시점(R33). 지금 Root 는 라우트가 바뀔 때 경로를 기록해 넘기기의 `replaceState` 로 바뀐 URL 을 놓친다. navigate 할 때 떠나는 위치를 기록하는 쪽으로 옮긴다. 경로만 기록하는 것(쿼리 제외)은 지금과 같다.

## 열린 질문

Q1. 음표 탭, 재개, 재생 중 템포 변경 뒤의 반복 시작점.
- 배경. 이 화면은 늘 4박 간격 반복(`{ gapBeats: 4 }`)으로 재생한다. player 는 간격 뒤 그 재생을 시작한 스텝(fromStep)부터 다시 시작한다. 기획 12절이 "player.ts 는 바뀌지 않는다" 로 정해 이 명세는 그대로 따른다(R10).
- 예시. 4마디 릭 3마디 첫 음을 탭하면 3 ~ 4마디만 반복된다. 재생 중 3마디에서 템포를 105 로 바꿔도 그 뒤 반복은 3마디부터다. 0 부터 연 재생은 처음부터 반복이다.
- 파급. 그대로 두면 바꿀 것이 없다. 처음부터 반복하게 하려면 `LoopGap` 에 다시 시작할 스텝(예: `restartStep: 0`)을 더하는 player 변경과 그 단위 테스트가 생긴다(골든 스냅샷은 영향 없음). 둘째 경우 R10, AC-20, AC-23 의 기대값이 바뀐다.
- 추천. 처음부터 반복. 템포를 바꾼 사람은 릭 전체를 새 속도로 다시 듣기를 기대하고, 반쯤 잘린 반복은 고장처럼 보인다. 탭한 음부터의 구간 반복은 연습 장면(다음 기능)의 몫이다.

Q2. 직전 항목이 편집기나 게시 화면일 때 닫기의 목적지.
- 배경. 닫기는 depth > 0 이면 `history.back()` 이다(기획 구조 2, R27). 편집기 Exit 와 게시 직후의 화면은 navigate 로 만든 항목이라 depth > 0 이고 직전 항목이 각각 편집기(`/edit#…`)와 게시 화면(`/publish#…`)이다.
- 예시. 넘기던 장에서 Duplicate & edit 로 편집기에 갔다가 Back 으로 돌아와 닫기를 누르면 편집기가 다시 열린다. 폰에서 게시한 뒤 열린 새 릭 화면에는 탭 바가 없어 닫기를 누르면 게시 화면으로 돌아가고, 거기서 탭 바로 Latest 에 가야 한다(S22).
- 파급. 그대로 두면 바꿀 것이 없다. 바꾸려면 navigate 가 떠나는 항목이 편집, 레거시 열람, 게시, 공유 리다이렉트이면 depth 를 0 으로 쓰게 한다(R2 한 줄). 그러면 두 경우 모두 닫기가 `navigate('/')` 로 Latest 를 새로 받는다. 출처 목록(태그 피드 등)으로는 돌아가지 않는다. R2, R27, AC-1, S22 가 바뀐다.
- 추천. depth 를 0 으로 쓰는 쪽. 닫기를 눌러 방금 떠난 편집기나 다시 게시 버튼이 있는 화면이 나오는 것보다 Latest 가 낫다. 다만 이것은 승인된 기획의 depth 정의를 바꾸므로 답을 받기 전에는 기획대로 둔다.
