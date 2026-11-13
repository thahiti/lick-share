PASS

# feed-cache 검증 판정

## 평가 조건

- HEAD: `b272f5b8235817b9b51c3bc50c90f66f3b6f2477` (`feature/feed-cache`). 기준 커밋 `155e290`, 구현 diff `git diff 155e290..HEAD`.
- 날짜: 2026-11-11.
- 평가자: Opus 5.5 (`claude-opus-5-5`), 독립 평가자(evaluator-light), 구현자 컨텍스트 없음.
- 기준: `docs/features/feed-cache/03-spec.md` (S9 는 2026-11-11 개정 문구 "1건 이상" 기준).
- 개발 서버: http://localhost:5199 (`vite --port 5199 --strictPort`, 작업 폴더 `/Users/randy/claude_code/lick_share/scorelink`, 개발 모드 StrictMode). 데이터는 운영 DB 읽기만 했다.
- 뷰포트: 폰 390x844, DPR 2, isMobile, hasTouch (S1 ~ S5, S9, S12). 데스크톱 1280x800, DPR 1 (S11). Chrome 헤드리스(`channel: 'chrome'`).
- 로그인: 없음(Playwright 는 Google OAuth 로그인 불가). 로그인이 필요한 S5(내 릭), S6, S7, S8, S10 은 아래 휴대폰 확인 표로 넘긴다.

## 판정 근거 요약

- `harness/check.sh` 를 직접 돌려 typecheck, lint, test 72 파일 717개, check-no-smp 가 모두 통과했다("통과. .last-check = b272f5b").
  명세 이전 717 - 25 = 692개(PROGRESS.md 의 이전 수)와 맞고, 기존 테스트에서 지운 줄은 import 줄뿐이다.
- AC-1 ~ AC-20 은 모두 명세 테스트 목록 표의 파일에 같은 id 로 있고 Given, When, Then 을 그대로 검사한다.
  Feed 테스트는 실제 `feedStore` 와 실제 FeedList 를 쓰고 API 만 mock 이다. LickDetail, Publish, MyLicks 는 실제 모듈에 `vi.spyOn`(호출 통과)이라 mock 의 동작만 검사하는 테스트는 없다.
- 규칙 R1 ~ R15 가 코드에 있다. R5 는 useState 초기값에서 복원하고 첫 페이지와 총 개수 요청을 막는다. R7 은 같은 useLayoutEffect 에서 scrollTo 와 rAF scrollTo 두 번이다. R8 은 useLayoutEffect 정리 함수에서 scrollY 를 읽고 같은 자리에서 set 한다. R9 ~ R12 의 호출 순서가 명세대로다.
- 대본 `fc-scen.mjs` 를 읽고 명세의 시나리오, 첫 프레임 측정, 목록 요청 정의를 그대로 잰다고 판단했다(차이 두 가지는 발견 사항 4). 평가자가 직접 돌린 S1 ~ S5, S9, S11, S12 가 모두 통과했다.
  S9 는 대본이 S1 끝 상태를 줄여 만들므로 진짜 S1 끝 상태에서 한 번 더 쟀고 같은 결과였다.
- 명세 밖 공개 함수, 테이블, 정책은 없다. 구현자가 보고한 좋아요 실패 되돌림의 순서는 R11 과 어긋나지 않는다(발견 사항 1).
- 차단 발견 없음.

## AC 표

| id | 결과 | 근거 파일과 줄 | 비고 |
|---|---|---|---|
| AC-1 | PASS | `src/community/feed-store.test.ts:28` | `'|'`, `'u1|'`, `'|jazz'` |
| AC-2 | PASS | `src/community/feed-store.test.ts:40` | 같은 참조 반환, 재 set 교체, 모르는 키 undefined |
| AC-3 | PASS | `src/community/feed-store.test.ts:52`, `:62`, `:71` | 잇기와 커서 c0, done true, counts x=3. 빈 행은 행과 커서 유지. 없는 키는 만들지 않음 |
| AC-4 | PASS | `src/community/feed-store.test.ts:76` | 대상 행이 없는 `'|jazz'` 에도 orig-1=8 |
| AC-5 | PASS | `src/community/feed-store.test.ts:84` | 한쪽은 sim-1 이 마지막 행이라 커서 c2. 행만 빠지고 커서, counts, done, total, scrollY 유지 |
| AC-6 | PASS | `src/community/feed-store.test.ts:118` | |
| AC-7 | PASS | `src/community/routing.test.ts:50` | `renderHook(useRoute)`, history, navigate 뒤 tag 와 navigate, 합성 popstate 뒤 history |
| AC-8 | PASS | `src/community/views/Feed.test.tsx:342` | await 없이 카드 2장과 좋아요 수 7(두 카드 모두 원본 orig-1 기준), fetchFeedPage 와 countLicks 미호출, scrollTo(0, 1200) 1회, rAF 콜백 실행 뒤 2회 |
| AC-9 | PASS | `src/community/views/Feed.test.tsx:361` | 커서 null 로 1회, scrollTo 미호출 |
| AC-10 | PASS | `src/community/views/Feed.test.tsx:373` | 스냅샷 전체를 `toEqual`, scrollY 777 |
| AC-11 | PASS | `src/community/views/Feed.test.tsx:391` | total 12, 재 render 직후 "12 licks", countLicks 1회 |
| AC-12 | PASS | `src/community/views/Feed.test.tsx:407` | 옛 스냅샷이 있던 키가 undefined |
| AC-13 | PASS | `src/community/views/Feed.test.tsx:445` | 언마운트 뒤 해결된 둘째 페이지 버림, 행 20과 커서 20번째, 복원 뒤 같은 커서로 1회, 제목 40개 중복 없음. 발견 사항 2 참고 |
| AC-14 | PASS | `src/community/views/Feed.test.tsx:419` | `.c-sentinel` 있음, 에러 문구 없음 |
| AC-15 | PASS | `src/community/views/Feed.test.tsx:429` | `vi.spyOn(feedStore, 'remove')` 가 'orig-1' 로 호출 |
| AC-16 | PASS | `src/community/views/LickDetail.test.tsx:333`, `:347` | ('orig-1', 8) 뒤 addLike 거절에 ('orig-1', 7). 유사 릭은 canonical_id 'orig-1' |
| AC-17 | PASS | `src/community/views/LickDetail.test.tsx:358` | `invocationCallOrder` 로 remove 가 navigate('/me') 보다 먼저 |
| AC-18 | PASS | `src/community/views/Publish.test.tsx:189`, `:203` | clear 가 navigate('/lick/abc') 보다 먼저, duplicate 와 error 는 미호출 |
| AC-19 | PASS | `src/community/views/MyLicks.test.tsx:114`, `:125` | ok 면 invalidate('user-1|'), taken 이면 미호출 |
| AC-20 | PASS | `src/community/Root.test.tsx:104` | 'auto' 로 둔 뒤 render 하면 'manual' |

## 규칙 확인

| 규칙 | 위치 | 확인 내용 |
|---|---|---|
| R1 | `src/community/feed-store.ts:9`, `src/community/views/Feed.tsx:31` | `feedKey` 가 Feed 의 리마운트 key 식(`Feed.tsx:219`)과 같다. deletable 은 키에 없다 |
| R2 | `src/community/feed-store.ts:39 ~ 72` | 모듈 수준 Map 하나. appendPage, setCount, remove, invalidate, clear 가 명세대로. appendPage 를 부르는 곳은 없다 |
| R3 | `src/community/routing.ts:42 ~ 46`, `:52`, `:62 ~ 63` | pushState 뒤 dispatch 직전에 `pending = 'navigate'`. onPop 이 setRoute 전에 `last = pending; pending = 'history'` |
| R4 | `src/community/Root.tsx:51 ~ 55` | 마운트 이펙트에서 한 번, 되돌리지 않음 |
| R5 | `src/community/views/Feed.tsx:34 ~ 45` | useState 초기값에서 세 조건으로 스냅샷을 고르고 행, counts, done, loaded true, error false, 커서, total 을 초기값으로. `started` 를 true 로 두어 첫 페이지 요청이 없다(`:133 ~ 138`) |
| R6 | `src/community/views/Feed.tsx:82 ~ 100` | 행이 있으면 set, 없으면 invalidate. 에러, 다이얼로그, 오버레이 인덱스는 저장하지 않는다 |
| R7 | `src/community/views/Feed.tsx:68 ~ 73` | 같은 useLayoutEffect 에서 scrollTo 와 rAF scrollTo. 새 마운트는 건너뛴다 |
| R8 | `src/community/views/Feed.tsx:82 ~ 100` | useLayoutEffect 정리 함수에서 `Math.round(window.scrollY)` 를 읽고 같은 함수에서 set. 최신 상태는 커밋마다 옮기는 ref(`:76 ~ 79`) |
| R9 | `src/community/views/Publish.tsx:163 ~ 164` | ok 일 때만 clear 뒤 navigate |
| R10 | `src/community/views/LickDetail.tsx:287`, `:290`, `src/community/views/Feed.tsx:146 ~ 148` | 상세는 remove 가 navigate('/me') 앞. 목록 다이얼로그는 상태에서 뺀 직후 remove |
| R11 | `src/community/views/LickDetail.tsx:264 ~ 271` | 화면 수를 바꾸는 자리에서 바뀐 수로 setCount, 실패 되돌림에서 되돌린 수로 setCount. 발견 사항 1 |
| R12 | `src/community/views/MyLicks.tsx:41 ~ 42` | ok 일 때만 setRenames 앞에서 invalidate |
| R13 | `src/community/views/Feed.tsx:42`, `:196` | error 는 false 로 시작, done false 면 센티널 |
| R14 | `src/community/views/Feed.tsx:103 ~ 109`, `:115` | `alive` ref 로 언마운트 뒤 결과를 버리고, 커서는 반영 때만 전진 |
| R15 | `src/community/views/Feed.tsx:54 ~ 66` | 복원 마운트는 스냅샷 total, countLicks 이펙트를 건너뛴다 |

레이어와 범위.
- `src/community/feed-store.ts` 의 import 는 `import type { LickRow } from './api/licks'` 하나뿐이다. React 와 DOM 을 쓰지 않는다.
- `src/community/routing.ts` 변경 뒤 기존 parseRoute 테스트를 포함해 전체 테스트가 통과한다.
- DB 스키마, `src/community/api/`, CSS 변경이 없다. 골든 스냅샷 변경이 없다.
- 공개로 늘어난 것은 `feedKey`, `FeedSnapshot`, `FeedStore`, `feedStore`, `NavKind`, `lastNavKind` 로 모두 명세에 있다.
- 문서 T7: `docs/product/SPEC.md` 4.2 절, `harness/DECISIONS.md` 한 항목, `harness/PROGRESS.md` 갱신이 있다.

## 시나리오 표

측정은 평가자가 2026-11-11 에 `fc-scen.mjs` 로 직접 돌린 값이다. 출력 폴더 `/private/tmp/claude-501/-Users-randy-claude-code/8f85982f-d5e5-406d-91a3-adb392f2db9a/scratchpad/eval-fc/`. 페이지 오류는 모든 실행에서 0건이다.
카드와 scrollY 는 "카드 수 / scrollY" 로 적는다. before 는 카드를 누르기 직전, first 는 첫 프레임 측정, after 는 1초 뒤(S5 는 Feed 마운트 뒤 0.5초, S12 는 2초 뒤)다. 목록 요청은 뒤로 가기(S3 는 탭 누르기, S9 는 새로고침) 뒤의 수다.

| id | before | first | after | 목록 요청 | 결과 | 비고 |
|---|---|---|---|---|---|---|
| S1 | 40 / 3173 | 40 / 3173 | 40 / 3173 | 0 | PASS | 아홉째 카드를 보이게 둔 뒤의 scrollY 가 yBefore. `s1-before.png` 와 `s1-restored.png` 화면이 같다 |
| S2 | 40 / 3173 (S1 기준) | 40 / 3173 | 40 / 3173 | 0 | PASS | goForward 로 상세 뒤 goBack |
| S3 | 상세 | 측정 없음 | 20 / 0 | 1 | PASS | 탭 바 Latest. S2 끝 상태(= S1 끝 상태)에서 |
| S4 | 40 / 3086 | 40 / 3086 | 40 / 3086 | 0 | PASS | 헤더 "280 licks" 에서 "280 licks". 총 개수 조회 포함 0건 |
| S5 (유저 페이지) | 40 / 2400 | 측정 없음 | 40 / 2400 | 0 | PASS | `/user/JSztbE7e`. 프로필 요청 1건 |
| S9 | 40 / 3173 | 측정 없음 | 20 / 0 | 3 | PASS | 평가자가 진짜 S1 끝 상태(상세 갔다가 복원, `scrollRestoration` manual)에서 새로고침. 세 요청 모두 같은 URL `order=created_at.desc&limit=20` 이고 사이드바 2건(StrictMode)과 Feed 1건이다. 대본 실행도 20 / 0, 3건 |
| S11 | 40 / 2400 | 40 / 2400 | 40 / 2400 | 0 | PASS | 데스크톱 1280x800 |
| S12 | 40 / 11172 | 측정 없음 | 60장 | 1 | PASS | 셋째 페이지 20행, 카드 제목 순서가 세 페이지 응답을 이은 것과 같고 중복 0. 셋째 페이지 응답 2회(떠날 때 진행 중이라 버린 것과 복원 뒤 다시 받은 것) |

## 발견 사항

| 번호 | 파일과 줄 | 관련 AC 또는 규칙 | 차단 여부 | 내용 |
|---|---|---|---|---|
| 1 | `src/community/views/LickDetail.tsx:270 ~ 271` | R11 | 비차단 | 구현자가 명세 밖이라고 보고한 선택. 실패 되돌림의 `feedStore.setCount(target, count)` 가 기존 `alive` 검사보다 앞에 있다. R11 은 "요청이 실패해 되돌릴 때도 부른다" 고만 하고 화면이 살아 있는지를 조건으로 두지 않는다. 저장소는 화면과 따로 남으므로 언마운트 뒤에도 되돌리는 것이 R11 의 문구와 목적(복원 목록의 수를 서버와 맞춤)에 맞다. 공개 함수나 정책을 늘리지 않는다. 어긋남 없음으로 판단한다. 남는 경우 하나: 실패 전에 이미 뒤로 가기로 목록이 복원돼 있으면 그 FeedList 의 상태는 낙관적 수를 들고 있고, 언마운트 때 R6 이 그 키에 낙관적 수를 다시 쓴다. 명세가 다루지 않는 경우이고 구현 결함은 아니다 |
| 2 | `src/community/views/Feed.test.tsx:445` | AC-13, R14 | 비차단 | AC-13 테스트는 `Feed.tsx:115` 의 `alive` 검사가 없어도 통과하는 구조다(추론, 변형 실행은 하지 않음). 스냅샷은 언마운트 순간 레이아웃 정리에서 커서 값을 복사하므로, 그 뒤 끝난 페이지가 죽은 인스턴스의 ref 를 바꿔도 스냅샷과 복원은 영향을 받지 않는다. 테스트는 AC 문구를 그대로 검사하고 `alive` 플래그는 코드에 있으므로 판정에 영향 없다. 브라우저 S12 도 같은 이유로 통과한다 |
| 3 | `src/community/views/Feed.test.tsx:243`, `:268`, `:288` | AC-17, AC-19 | 비차단 | swipe-play 의 AC-19, AC-17 테스트가 같은 파일에 있어 id 로 찾으면 feed-cache 의 AC-17(`LickDetail.test.tsx:358`), AC-19(`MyLicks.test.tsx:114`)와 섞인다. feed-cache 쪽은 명세 표의 파일에 정확히 있다 |
| 4 | `/private/tmp/claude-501/-Users-randy-claude-code/8f85982f-d5e5-406d-91a3-adb392f2db9a/scratchpad/fc-scen.mjs:181 ~ 195`, `:225 ~ 237` | S9, S12 | 비차단 | 대본의 S9 는 상세를 다녀오지 않고 40장, scrollY 2400 에서 새로고침한다. 명세의 Given 은 S1 끝 상태라 평가자가 그 상태에서 다시 재 같은 결과를 얻었다(시나리오 표). S12 는 셋째 페이지의 첫 요청을 `page.route` 로 1.5초 늦춰 떠날 때 진행 중이게 만든다. 명세 문구에는 없지만, 뒤로 가기 뒤 요청이 정확히 1건(셋째 페이지)이라는 Then 이 떠날 때 셋째 페이지가 반영되지 않은 상태를 전제하므로 그 Given 을 확정적으로 만드는 장치로 본다 |
| 5 | `src/community/views/MyLicks.tsx:41 ~ 42`, `src/community/views/Feed.tsx:82 ~ 100` | R12, E8 | 비차단 | 참고. 이름 바꾸기 리마운트에서 새 FeedList 는 렌더 단계에서 비워진 키를 읽어 새 마운트가 되고, 그 뒤 커밋에서 옛 FeedList 의 정리 함수가 옛 이름 스냅샷을 다시 쓴다(추론). 그 키를 읽는 곳은 새 FeedList 의 초기값뿐이고 그 인스턴스가 떠날 때 set 이나 invalidate 로 덮으므로 동작 영향은 없다 |

## 실행한 명령과 결과

- `bash harness/check.sh`: typecheck, lint 통과, vitest 72 파일 717개 통과, check-no-smp OK. "통과. .last-check = b272f5b".
- 대본(스크래치패드 디렉터리에서 실행): `node fc-scen.mjs s1`, `s4`, `s5`, `s9`, `s11`, `s12` 각각 `http://localhost:5199` 와 위 출력 폴더. 모두 "PASS", 종료 코드 0.
- S9 재측정: 같은 디렉터리에서 `node --input-type=module -e` 로 S1 흐름(40장, 아홉째 카드, 상세, 뒤로 가기) 뒤 `page.reload()`. S1 끝 40 / 3173, `history.scrollRestoration` manual, 새로고침 뒤 20 / 0, 목록 요청 3건.
- 증거 폴더의 `check.txt` 는 구현자가 `7730955` 에서 남긴 것이다. 그 뒤 커밋 `b272f5b` 는 증거 파일만 더했다.

## 휴대폰 확인

| 시나리오 | 확인 날짜 | 결과 |
|---|---|---|
| S5 (내 릭) | 미확인 | 미확인 |
| S6 | 미확인 | 미확인 |
| S7 | 미확인 | 미확인 |
| S8 | 미확인 | 미확인 |
| S10 | 미확인 | 미확인 |
