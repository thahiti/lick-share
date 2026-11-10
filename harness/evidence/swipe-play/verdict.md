NEEDS_WORK

# swipe-play 검증 판정

평가일: 2026-11-10. 평가자: fable (독립 평가자, 구현자 컨텍스트 없음).
기준: `docs/features/swipe-play/03-spec.md`. 구현 diff: `git diff d9c8f92..HEAD` (`feature/swipe-play`, HEAD `c637f2f`).
개발 서버: http://localhost:5200 (운영 DB 의 Latest 피드. 첫 릭 "스타" 4마디 100bpm, 태그 없음).
뷰포트: 폰 390x844 (isMobile, hasTouch, DPR 2). S12 만 1280x800. 스크린샷은 이 폴더에 전부 다시 찍었다.

## 판정 근거 요약

NEEDS_WORK 에 해당하는 항목 두 개.

1. R7 위반. 카운트다운 중 악보를 눌러 멈춘 뒤 다시 누르면 0 부터가 아니라 마지막 tick 의 floor 스텝(마지막 스텝)부터 재개된다. 브라우저에서 확인했고 단위 테스트 `R7` 은 이 상태를 만들지 않아 잡지 못한다.
2. 하드코딩 색상. `src/community/community.css:49` 의 `.c-card-play` 그림자 `rgba(17, 17, 17, 0.25)`. 명세 레이어 절("색은 tokens.css 토큰만")과 CLAUDE.md 스타일 규칙에 어긋난다.

그 밖에 S1 ~ S16 은 명세의 Then 을 전부 만족했다. 상세는 아래 표와 발견 사항.

## AC 표

| id | 결과 | 근거 파일과 줄 | 비고 |
|---|---|---|---|
| AC-1 | PASS | `src/adapters/player.test.ts:176` | toStep 뒤 isPlaying true, onEnded 없음, 간격 중 스케줄 없음, 4박 뒤 t=0 melody |
| AC-2 | PASS | `src/adapters/player.test.ts:195` | onGap 4, 3, 2, 1, null 각 한 번 |
| AC-3 | PASS | `src/adapters/player.test.ts:206` | stop 과 새 play 모두 null 뒤 재스케줄 없음, onEnded 1회 |
| AC-4 | PASS | `src/adapters/player.test.ts:230`, 기존 `loop=true`, `setLoop(false)` 테스트 (같은 파일 150 ~ 168 줄 부근) 변경 없음 | 간격 중 onTick 없음 |
| AC-5 | PASS | `src/community/components/LickCard.test.tsx:24` | Play 버튼, onPlay 1회, navigate 없음, `.c-cardhit` 밖 |
| AC-6 | PASS | `src/community/components/LickCard.test.tsx:36` | |
| AC-7 | PASS | `src/community/components/PlayOverlay.test.tsx:140` | pushState 1회, 둘째 곡 t=0, "2 / 3" |
| AC-8 | PASS | `src/community/components/PlayOverlay.test.tsx:164` | 스텝 4 에서 멈춤, 재개 첫 melody 가 스텝 4 음(81) t=0 |
| AC-9 | PASS | `src/community/components/PlayOverlay.test.tsx:181` | 재생 중 settle(2) 는 셋째 곡 0 부터, 멈춘 뒤 settle(0) 은 sink 이벤트 없음 |
| AC-10 | PASS | `src/community/components/PlayOverlay.test.tsx:195` | loadMore 1회, 해결 전 인덱스 2 에서도 1회 |
| AC-11 | PASS | `src/community/components/PlayOverlay.test.tsx:150` | 닫기 버튼은 history.back, popstate 에 onClose 와 정지 |
| AC-12 | PASS (약함) | `src/community/components/PlayOverlay.test.tsx:370` | Esc, ArrowDown, ArrowUp, Space 검사. 단 scrollBy 의 `top` 이 장 높이인지는 검사하지 않는다(jsdom clientHeight 0). 브라우저 S12 와 F 스크립트로 보완 확인 |
| AC-13 | PASS | `src/community/components/PlayOverlay.test.tsx:220` | 힌트 표시, 장 전환 뒤 숨김과 `1` 저장, 재마운트 시 없음 |
| AC-14 | PASS | `src/community/components/PlayOverlay.test.tsx:280`, `:287` | 비로그인 토스트와 addLike 미호출, 로그인 addLike 와 onCount(b, 3), 실패 되돌림과 Like failed |
| AC-15 | PASS | `src/community/components/PlayOverlay.test.tsx:343` | isPlaying false, replaceState `/edit#` + blob, pushState 추가 없음 |
| AC-16 | PASS | `src/community/components/PlayOverlay.test.tsx:242` | 4 와 Again in, 한 박 뒤 3 과 점 1개, 간격 끝에 사라짐 |
| AC-17 | PASS (위치 다름) | `src/community/views/Feed.test.tsx:273` | 명세 테스트 목록은 `PlayOverlay.test.tsx` 인데 `Feed.test.tsx` 에 있다. 라벨 계산이 Feed.tsx 에 있어 검사 대상은 맞다. 태그 예시는 "#jazz" 대신 "#bebop" |
| AC-18 | PASS | `src/community/components/PlayOverlay.test.tsx:231` | 안내문 표시, isPlaying false, sink 이벤트 없음 |
| AC-19 | PASS | `src/community/views/Feed.test.tsx:228`, `:253` | `.c-play` 마운트와 "2 / 2", onCount 로 카드 수 5, popstate 뒤 `.c-play` 없음과 카드 요소 참조 동일 |

AC 이름이 없는 추가 테스트(E2, R9, R7, R11, R12, R13, R4)도 있다. 그중 `R7` (`PlayOverlay.test.tsx:259`) 은 아래 발견 1 참조.

## 시나리오 표

| id | 결과 | 스크린샷 | 관찰 |
|---|---|---|---|
| S1 | PASS | `s1-card.png`, `s1-open.png` | 카드 20장 모두 44px 원형 `--brand-primary`(rgb 15, 110, 86) 버튼. 클릭 뒤 467ms 에 dialog, 492ms 에 `[data-playhead]`. 제목, 작성자, 좋아요, Share, Duplicate and edit 보임. 첫 릭은 태그가 없어 태그는 S16 의 둘째 카드(#정윤)로 확인. `.c-cardhit` 클릭은 `/lick/usLErtPCvRI` |
| S2 | PASS | `s2-paused.png`, `s2-resumed.png` | 멈춤 x 227.5 두 번 같음, 멈춤 표시 보임. 재개 뒤 266.2, 312.0 (같은 줄 y 8) |
| S3 | PASS | `s3-next.png` | "2 / 20", 둘째 장 플레이헤드 있음(스크롤 뒤 0.5초 대기 후 260ms 안), 첫 장 없음 |
| S4 | PASS | `s4-paused-next.png` | "2 / 20", 둘째 장 플레이헤드 없음, 멈춤 표시 보임 |
| S5 | PASS | `s5-prev.png` | "1 / 20", 첫 장 플레이헤드 161.8 에서 202.3 으로 첫 줄에서 이동, 둘째 장 없음 |
| S6 | PASS | `s6-countdown.png`, `s6-restart.png` | 열고 9.3초 뒤 "4" 와 "Again in", 악보 svg opacity 0.35. 숫자 4, 3, 2, 1, 점 0, 1, 2, 3 개. 간격 2.40초(E11 과 일치). 끝나면 숫자 사라지고 플레이헤드 첫 줄 56.1 에서 86.0 |
| S7 | PASS (단 R7 발견 1) | `s7-swipe.png`, `s7-tap.png` | 카운트다운 중 넘기면 카운트다운 0개, 둘째 장 플레이헤드 있음, "2 / 20". 다시 만든 카운트다운 중 탭은 카운트다운 사라지고 멈춤 표시. 명세 S7 의 Then 은 만족. 이어서 다시 탭한 재개는 0 이 아니라 끝 스텝부터였다(발견 1) |
| S8 | PASS | `s8-fast.png` | 150ms 간격 두 번 스크롤 뒤 "3 / 20", 셋째 장에만 플레이헤드. 단 중간 장이 도중에 재생됐다(발견 3 의 타이밍 조사 참조) |
| S9 | PASS | `s9-end.png` | 응답 3행 치환. "3 / 3", "This is the last lick in Latest" 보임, 더 넘겨도 "3 / 3", 추가 피드 요청 0 |
| S10 | PASS | `s10-closed.png` | 두 페이지 더 받아 60장, scrollY 3649 에서 11번째 카드로 열고 닫기 버튼: 3649 유지, 추가 피드 요청 0. 뒤로 가기도 같음. E12: 다시 열고 뒤로 가기 해도 history.length 6 에서 늘지 않음 |
| S11 | PASS | `s11-like.png`, `s11-share.png`, `s11-edit.png` | 비로그인 좋아요: "Sign in to like", 좋아요 수 0 유지(aria-pressed false 유지), likes 쓰기 요청 0. Share(navigator.share 제거): 클립보드 `/s/usLErtPCvRI`, "Link copied". Duplicate and edit: `/edit#v2...`, history.length 4 유지(replaceState), 편집의 Back(`[data-btn="back"]`) 으로 `/` 카드 20장, 오버레이 없음 |
| S12 | PASS | `s12-desktop.png` | 패널 폭 680, 좌우 300 씩 가운데, max-height 736(92dvh), 스크림 rgba(17, 17, 17, 0.55), 키 안내 보임, 힌트 없음, 포커스 Close. ArrowDown 으로 "2 / 20" 과 둘째 장 플레이헤드, Esc 로 닫힘. 스크림 클릭도 닫힘(R4). Space 는 닫기 버튼에 포커스가 있어도 토글만 한다(멈춤 뒤 재개, 오버레이 유지) |
| S13 | PASS | `s13-tag.png` | `/tag/jazz` 출처 "#jazz", 넘기면 "2 / 20" 이고 둘째 장 제목이 목록 둘째 카드와 같음("Simple Scale Turnaround Singalong") |
| S14 | PASS | `s14-hint.png` | localStorage 비운 뒤 힌트 보임. 한 장 넘기면 힌트 0개, `swipe-play-hint` = 1. 닫고 다시 열어도 없음. 단 알약 위치는 시안과 다르다(발견 4) |
| S15 | PASS | `s15-long.png` | 첫 행 blob 8마디 치환. `.c-play-body` scrollHeight 1015 > clientHeight 729, overflow-y auto, "Scroll for the rest of the score" 보임, 액션 행 bottom 844 = viewport. 끝까지 내린 뒤 넘기면 "2 / 20" 과 둘째 장 플레이헤드 |
| S16 | PASS | `s16-static.png` | 작성자와 태그 모두 SPAN, 밑줄 없음. 눌러도 URL 같고 오버레이 유지, "2 / 20" |

## 발견 사항

1. R7 위반 (NEEDS_WORK 사유). `src/community/components/PlayOverlay.tsx:386 ~ 398` `toggle`. 재생 중 탭은 `player.stop()` 만 하고 `lastEl` 을 건드리지 않는다. player 는 간격 진입 프레임에서 onTick 을 부르지 않으므로(`src/adapters/player.ts` onFrame, `el >= toStep` 분기에서 return) 카운트다운 중 `lastEl` 은 마지막 스텝 직전 값(예: 63.9)이다. 그래서 `:394` 의 `Math.floor(lastEl.current)` 는 63 이 되고 재개가 마지막 스텝부터 시작해 0.15초 뒤 다시 카운트다운이 뜬다. 명세 R7 "카운트다운 중 누르면 stop 이고 lastEl 은 total 로 둔다(재개는 0 부터)" 와 어긋난다.
   브라우저 증거: 카운트다운 중 탭 뒤 재개하면 플레이헤드가 x 340.4 (마지막 줄 y 362) 에 그대로 있고 601ms 뒤 카운트다운이 다시 떴다. 0 부터였다면 첫 줄에서 움직이고 약 9.6초 뒤에 떠야 한다.
   테스트 `PlayOverlay.test.tsx:259` "R7 카운트다운 중 탭하면 멈추고 재개는 0 부터" 는 간격 진입 전에 tick 을 한 번도 흘리지 않아 `lastEl` 이 초기값 0 인 채로 검사한다. Given 이 실제 상태와 다르므로 이 규칙을 보증하지 않는다.
2. 하드코딩 색상 (NEEDS_WORK 사유). `src/community/community.css:49` `.c-card-play { box-shadow: 0 2px 6px rgba(17, 17, 17, 0.25); }`. 명세 레이어 절 "색은 tokens.css 토큰만", CLAUDE.md "하드코딩 색상 금지". tokens.css 에 `--shadow-card`, `--shadow-popover` 가 있다. (기준 커밋의 community.css 에도 `rgb(0 0 0 / 0.08)` 294줄, `#fff` 766줄이 있으나 이번 diff 가 새로 더한 줄이다.)
3. 명세에 없는 동작: 현재 장 판정의 120ms 유지. `PlayOverlay.tsx:27` `SETTLE_MS = 120`, `:361 ~ 383`. 알려진 사항이고 사용자 재승인 대기 중이라 단독 사유로 삼지 않는다. S8 과 E3 의 실제 성립 여부를 재기 위해 중간 장(인덱스 1)이 60% 이상 보인 시간과 중간 장에 플레이헤드가 생긴 시각을 같이 쟀다.
   - 한 번에 두 장 smooth 스크롤: 중간 장 60% 이상 28ms, 중간 장 재생 없음, 끝 "3 / 20". E3 성립.
   - 두 번 smooth 스크롤 50, 150, 250ms 간격: 중간 장 60% 이상 787, 869, 992ms. 중간 장이 566 ~ 624ms 에 재생됐다가 셋째 장으로 넘어감. 끝 "3 / 20", 셋째 장에만 플레이헤드. S8 의 Then 은 성립하나 "지나간 장의 소리는 나지 않는다" 는 성립하지 않는다. 다만 이 경우 중간 장이 0.8초 넘게 60% 이상 보였으므로 R6 의 60% 규칙대로면 현재가 되는 것이 맞다. 두 번의 programmatic smooth 스크롤이 헤드리스 Chrome 에서 이렇게 움직이는 것이지 구현의 결함으로 보지 않는다.
   - 두 번 instant 스크롤 100, 200ms 간격: 중간 장 60% 이상 310, 328ms, 중간 장 재생 있음.
   결론: 120ms 조건은 한 프레임짜리 통과를 막고, 그보다 오래 보인 장은 R6 대로 재생한다. 승인 여부는 사용자 몫.
4. 시안과 다른 힌트 위치(02-design.md "기존 화면과 다르게 한 점" 에 기록 없음). `community.css` `.c-play-hint { bottom: calc(24px + safe-area) }` 인데 시안 `docs/features/swipe-play/mockup.html:62` 은 `bottom: calc(84px + safe-area)` 로 액션 행 위다. 구현은 알약이 액션 행 위에 겹쳐 "Duplicate & edit" 글자와 좋아요 수를 가린다(`s14-hint.png`). 명세 R10 "액션 행 위에 보인다" 는 시안 기준으로 읽으면 어긋난다.
5. R3 와 다른 조건. `src/community/components/LickCard.tsx:43` `{onPlay && song && (...)}`. 명세는 `onPlay` 가 있으면 그린다고만 했는데 blob 을 읽지 못하는 카드에는 버튼을 그리지 않는다. 운영 Latest 20장은 전부 디코딩돼 화면 차이는 없었다. `Feed.test.tsx:238` 주석이 이 동작에 기댄다.
6. R15 와 다른 판정. `PlayOverlay.tsx:108` `scrollHeight - clientHeight - scrollTop > 2`. 명세는 `scrollHeight > clientHeight` 로만 판정하는데 구현은 끝까지 내리면 그늘과 캡션을 지운다(S15 에서 끝까지 내린 뒤 cue 없음 확인). 명세에 없는 동작이나 사용성에는 해가 없다.
7. 테스트 위치와 약한 검사. AC-17 이 `Feed.test.tsx:273` 에 있다(명세 표는 `PlayOverlay.test.tsx`). AC-12 는 scrollBy 의 `top` 값을 검사하지 않는다. 둘 다 Given, When, Then 자체가 다르지는 않다.
8. 디자인 문서와의 작은 차이. `src/styles/tokens.css` 에 `--scroll-shade` 를 더했는데 02-design.md 는 "새 토큰은 스크림 하나" 라고 했다. `src/ui/components/common/Icon.tsx` 에 `close` 패스를 더했는데 DESIGN.md 5절과 02-design.md 에 없다. 둘 다 규칙 위반은 아니다.
9. E4 미구현(도달 불가). `Feed.tsx` 는 마운트 때 `Math.min(playAt, licks.length - 1)` 로만 보정하고 PlayOverlay 는 열린 뒤 목록이 줄어도 인덱스를 맞추거나 비면 닫지 않는다. 삭제 메뉴가 오버레이 아래에 있어 UI 로는 재현할 수 없다. AC 가 없어 판정에 넣지 않는다.
10. 확인한 규칙 준수. `service_role` 없음. SMP 검사 통과. 순수 레이어 변경 없음(player.ts 는 adapters). E10 은 `src/main.tsx:13` 의 전역 pointerdown resume 이 담당한다. 토스트 1.6초는 상세(`LickDetail.tsx:137`)와 같다. 스크림 토큰은 tokens.css 에 있다.

## 실행한 명령과 결과

- `bash harness/check.sh` (리포 루트): typecheck, lint, test 71 파일 691개 통과, check-no-smp OK. "통과. .last-check = c637f2f".
- `npx vitest run src/adapters/player.test.ts src/community/components/LickCard.test.tsx src/community/components/PlayOverlay.test.tsx src/community/views/Feed.test.tsx --reporter=verbose`: 4 파일 61개 통과. AC-1 ~ AC-19 이름 전부 확인.
- Playwright (스크래치 `/private/tmp/claude-501/-Users-randy-claude-code/8f85982f-d5e5-406d-91a3-adb392f2db9a/scratchpad/eval/`, node_modules 는 npx 캐시 심링크, Chrome 헤드리스, `--autoplay-policy=no-user-gesture-required`):
  - `a.mjs`: S1, S10, S14, S2, S4, S3, S5, S8, S9, S16. 페이지 오류 0.
  - `b.mjs`: S6, S7 과 R7 재개 조사. 페이지 오류 0.
  - `c.mjs`: S11(clipboard 권한, `navigator.share` 제거), S13, S15(`/rest/v1/licks` 첫 행 blob 을 `long8.txt` 로 치환). 페이지 오류 0.
  - `d.mjs`: S12 와 스크림 클릭. 페이지 오류 0.
  - `e.mjs`: S8, E3 타이밍 조사(발견 3).
  - `f.mjs`: 데스크톱에서 Space 토글(AC-12 보완).
  출력은 같은 폴더의 `a.out` ~ `f.out`.
- 증거 폴더의 `check.txt` 는 구현자가 남긴 것(HEAD 0b7c18d)이며 이 판정에서는 갱신하지 않았다. 스크린샷 22장은 전부 이 판정에서 다시 찍은 것이다.

## 실행 조건

- 폰 390x844, DPR 2, isMobile, hasTouch. S12 는 1280x800 DPR 1.
- 응답 치환: S9 (`/rest/v1/licks` 배열을 3행으로), S15 (첫 행 blob 과 제목 치환). 운영 DB 에는 아무것도 쓰지 않았다(S11 좋아요는 비로그인이라 요청 자체가 없었다).
- 힌트는 S14 외에는 `swipe-play-hint = 1` 로 두고 시작했다.
