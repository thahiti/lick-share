PASS

# swipe-play 검증 판정 (재평가)

1차 평가 2026-11-10 (HEAD `c637f2f`, NEEDS_WORK). 재평가 2026-11-11 (HEAD `3b1a79c`). 평가자: fable (독립 평가자, 구현자 컨텍스트 없음).
기준: `docs/features/swipe-play/03-spec.md`. 구현 diff: `git diff d9c8f92..HEAD` (`feature/swipe-play`). 1차 뒤 고친 소스 커밋은 `b1dc064`, `464814a`, 문서 `e6b5fcf`.
개발 서버: http://localhost:5200 (운영 DB 의 Latest 피드. 첫 릭 "스타" 4마디 100bpm, 태그 없음).
뷰포트: 폰 390x844 (isMobile, hasTouch, DPR 2). S12 만 1280x800.

## 판정 근거 요약

1차의 차단 사유 두 가지가 모두 해소됐다.

1. R7. 카운트다운 중 탭으로 멈춘 뒤 다시 탭하면 0 부터 재개된다. `PlayOverlay.tsx:391 ~ 396` 이 stop 전에 간격 여부를 읽어 `lastEl` 을 total 로 둔다. 브라우저에서 재개 뒤 플레이헤드가 첫 줄 x 72.1 에서 123.9 로 움직였고 카운트다운은 9.8초 뒤에야 다시 떴다(1차에는 끝 x 340 에 머물고 0.6초 뒤 카운트다운). 단위 테스트 `R7` 은 간격 전에 스텝 50 tick 을 흘려 결함이 있으면 첫 음이 83 으로 나오게 고쳤다.
2. 하드코딩 색상. `.c-card-play` 그림자가 `var(--shadow-float)` (tokens.css:60) 로 바뀌었다. 브라우저 computed box-shadow 가 토큰 값과 같다.

시안과 달랐던 힌트 위치도 84px 로 고쳐 액션 행을 가리지 않는다(힌트 bottom 760 < 액션 행 top 779). 02-design.md 에 새 토큰 셋과 close 아이콘을 기록했다.
S1 ~ S16 전부 명세의 Then 을 만족한다. 재승인 대기 중인 명세 차이(120ms 유지, R3, R15)는 발견 사항으로만 남긴다.

## AC 표

| id | 결과 | 근거 파일과 줄 | 비고 |
|---|---|---|---|
| AC-1 | PASS | `src/adapters/player.test.ts:176` | toStep 뒤 isPlaying true, onEnded 없음, 간격 중 스케줄 없음, 4박 뒤 t=0 melody |
| AC-2 | PASS | `src/adapters/player.test.ts:195` | onGap 4, 3, 2, 1, null 각 한 번 |
| AC-3 | PASS | `src/adapters/player.test.ts:206` | stop 과 새 play 모두 null 뒤 재스케줄 없음, onEnded 1회 |
| AC-4 | PASS | `src/adapters/player.test.ts:230`, 기존 `loop=true`, `setLoop(false)` 테스트 변경 없음 | 간격 중 onTick 없음 |
| AC-5 | PASS | `src/community/components/LickCard.test.tsx:24` | Play 버튼, onPlay 1회, navigate 없음, `.c-cardhit` 밖 |
| AC-6 | PASS | `src/community/components/LickCard.test.tsx:36` | |
| AC-7 | PASS | `src/community/components/PlayOverlay.test.tsx:140` | pushState 1회, 둘째 곡 t=0, "2 / 3" |
| AC-8 | PASS | `src/community/components/PlayOverlay.test.tsx:164` | 스텝 4 에서 멈춤, 재개 첫 melody 가 스텝 4 음(81) t=0 |
| AC-9 | PASS | `src/community/components/PlayOverlay.test.tsx:181` | 재생 중 settle(2) 는 셋째 곡 0 부터, 멈춘 뒤 settle(0) 은 sink 이벤트 없음 |
| AC-10 | PASS | `src/community/components/PlayOverlay.test.tsx:195` | loadMore 1회, 해결 전 인덱스 2 에서도 1회 |
| AC-11 | PASS | `src/community/components/PlayOverlay.test.tsx:150` | 닫기 버튼은 history.back, popstate 에 onClose 와 정지 |
| AC-12 | PASS | `src/community/components/PlayOverlay.test.tsx:372` | Esc 는 back, ArrowDown 과 ArrowUp 은 scrollBy `{ top: +-500(clientHeight), behavior: smooth }`, Space 토글. 1차의 약점(top 미검사)이 고쳐졌다 |
| AC-13 | PASS | `src/community/components/PlayOverlay.test.tsx:220` | 힌트 표시, 장 전환 뒤 숨김과 `1` 저장, 재마운트 시 없음 |
| AC-14 | PASS | `src/community/components/PlayOverlay.test.tsx:280`, `:287` | 비로그인 토스트와 addLike 미호출, 로그인 addLike 와 onCount(b, 3), 실패 되돌림과 Like failed |
| AC-15 | PASS | `src/community/components/PlayOverlay.test.tsx:343` | isPlaying false, replaceState `/edit#` + blob, pushState 추가 없음 |
| AC-16 | PASS | `src/community/components/PlayOverlay.test.tsx:242` | 4 와 Again in, 한 박 뒤 3 과 점 1개, 간격 끝에 사라짐 |
| AC-17 | PASS (위치 다름) | `src/community/views/Feed.test.tsx:273` | 명세 표는 `PlayOverlay.test.tsx` 인데 `Feed.test.tsx` 에 있다. 라벨 계산이 Feed.tsx 에 있어 검사 대상은 맞다. 태그 예시 "#bebop" |
| AC-18 | PASS | `src/community/components/PlayOverlay.test.tsx:231` | 안내문 표시, isPlaying false, sink 이벤트 없음 |
| AC-19 | PASS | `src/community/views/Feed.test.tsx:228`, `:253` | `.c-play` 마운트와 "2 / 2", onCount 로 카드 수 5, popstate 뒤 `.c-play` 없음과 카드 요소 참조 동일 |

AC 이름이 없는 규칙 테스트: E2, R9, R7 (`:259`, 간격 전 tick 추가), R11, R12, R13, R4, E4 (`:410`, 새로 추가. 목록이 줄면 "2 / 2", 비면 onClose 와 정지).

## 시나리오 표

재평가에서 다시 수행한 것은 S1 카드, S7 탭, S14 와 S3, S10 스모크다. 나머지는 1차(HEAD `c637f2f`) 결과이며 그 뒤 바뀐 소스는 `PlayOverlay.tsx` 의 toggle 과 E4 효과, CSS 두 줄, 토큰 한 줄뿐이다.

| id | 결과 | 스크린샷 | 관찰 |
|---|---|---|---|
| S1 | PASS | `s1-card.png` (재촬영), `s1-open.png` | 카드 20장 모두 44px 원형 `--brand-primary`(rgb 15, 110, 86) 버튼, 그림자 computed `rgba(17, 17, 17, 0.25) 0px 2px 6px` = `--shadow-float`. 클릭 뒤 467ms 에 dialog, 492ms 에 `[data-playhead]`(재평가 스모크 460ms). 제목, 작성자, 좋아요, Share, Duplicate and edit 보임. 첫 릭은 태그가 없어 태그는 S16 의 둘째 카드(#정윤)로 확인. `.c-cardhit` 클릭은 `/lick/usLErtPCvRI` |
| S2 | PASS | `s2-paused.png`, `s2-resumed.png` | 멈춤 x 227.5 두 번 같음, 멈춤 표시 보임. 재개 뒤 266.2, 312.0 (같은 줄) |
| S3 | PASS | `s3-next.png` | "2 / 20", 둘째 장 플레이헤드 있음, 첫 장 없음. 재평가 스모크도 같음 |
| S4 | PASS | `s4-paused-next.png` | "2 / 20", 둘째 장 플레이헤드 없음, 멈춤 표시 보임 |
| S5 | PASS | `s5-prev.png` | "1 / 20", 첫 장 플레이헤드 161.8 에서 202.3 으로 첫 줄에서 이동 |
| S6 | PASS | `s6-countdown.png`, `s6-restart.png` | 열고 9.3초 뒤 "4" 와 "Again in", svg opacity 0.35. 숫자 4, 3, 2, 1, 점 0 ~ 3개. 간격 2.40초(E11). 끝나면 플레이헤드 첫 줄 56.1 에서 86.0 |
| S7 | PASS | `s7-swipe.png`, `s7-tap.png` (재촬영) | 카운트다운 중 넘기면 카운트다운 0개, 둘째 장 플레이헤드, "2 / 20". 카운트다운 중 탭은 카운트다운 사라지고 멈춤 표시(플레이헤드는 끝 x 339.8 에 남음). 다시 탭하면 첫 줄 x 72.1 에서 123.9 로 움직이고 멈춤 표시 없음, 카운트다운은 9.8초 뒤(R7 해소) |
| S8 | PASS | `s8-fast.png` | 150ms 간격 두 번 스크롤 뒤 "3 / 20", 셋째 장에만 플레이헤드. 중간 장 재생 여부는 발견 1 의 타이밍 조사 |
| S9 | PASS | `s9-end.png` | 응답 3행 치환. "3 / 3", "This is the last lick in Latest", 더 넘겨도 "3 / 3", 추가 피드 요청 0 |
| S10 | PASS | `s10-closed.png` | 60장 받아 scrollY 3649 에서 11번째 카드로 열고 닫기 버튼과 뒤로 가기 모두 3649 유지, 추가 피드 요청 0. E12: history.length 누적 없음. 재평가 스모크(닫기 버튼)도 같음 |
| S11 | PASS | `s11-like.png`, `s11-share.png`, `s11-edit.png` | 비로그인 좋아요: "Sign in to like", 좋아요 수 0 유지, likes 쓰기 요청 0. Share(navigator.share 제거): 클립보드 `/s/usLErtPCvRI`, "Link copied". Duplicate and edit: `/edit#v2...`, history.length 유지, 편집의 Back(`[data-btn="back"]`) 으로 `/` 카드 20장 |
| S12 | PASS | `s12-desktop.png` | 패널 680 가운데, max-height 736, 스크림 rgba(17, 17, 17, 0.55), 키 안내 보임, 힌트 없음, 포커스 Close. ArrowDown "2 / 20", Esc 닫힘, 스크림 클릭 닫힘, Space 는 토글만 |
| S13 | PASS | `s13-tag.png` | "#jazz", 넘기면 "2 / 20" 이고 둘째 장 제목이 목록 둘째 카드와 같음 |
| S14 | PASS | `s14-hint.png` (재촬영) | localStorage 비운 뒤 힌트 보임. 힌트 bottom 760, 액션 행 top 779 로 겹치지 않음(css bottom 84px). 한 장 넘기면 힌트 0개, `swipe-play-hint` = 1. 닫고 다시 열어도 없음 |
| S15 | PASS | `s15-long.png` | blob 8마디 치환. scrollHeight 1015 > clientHeight 729, 캡션 보임, 액션 행 bottom 844 = viewport. 끝까지 내린 뒤 넘기면 "2 / 20" |
| S16 | PASS | `s16-static.png` | 작성자와 태그 모두 SPAN, 밑줄 없음. 눌러도 URL 같고 오버레이 유지 |

## 발견 사항 (판정에 영향 없음)

1. 명세에 없는 동작, 재승인 대기: 현재 장 판정의 120ms 유지. `PlayOverlay.tsx:27` `SETTLE_MS = 120`. 1차 타이밍 조사 결과. 한 번에 두 장 smooth 스크롤이면 중간 장이 60% 이상 28ms 만 보여 재생되지 않는다(E3 성립). 두 번 나눠 smooth 스크롤(50 ~ 250ms 간격)하면 헤드리스 Chrome 이 중간 장을 0.8 ~ 1.0초 보여 주고 그동안 중간 장이 재생된 뒤 셋째 장으로 넘어간다. S8 의 Then 은 성립하며 이 경우는 R6 의 60% 규칙대로 현재가 되는 것이라 결함으로 보지 않는다.
2. R3 와 다른 조건, 재승인 대기: `LickCard.tsx:43` `{onPlay && song && (...)}`. blob 을 읽지 못하는 카드에는 재생 버튼을 그리지 않는다. 운영 Latest 20장은 영향 없음.
3. R15 와 다른 판정, 재승인 대기: `PlayOverlay.tsx:108` `scrollHeight - clientHeight - scrollTop > 2`. 끝까지 내리면 그늘과 캡션을 지운다.
4. 테스트 위치: AC-17 이 `Feed.test.tsx:273` 에 있다(명세 표는 `PlayOverlay.test.tsx`). Given, When, Then 은 같다.
5. E4 경로의 작은 불일치(UI 로 도달 불가): `Feed.tsx` 가 `startIndex={Math.min(playAt, licks.length - 1)}` 를 넘기므로 열린 채 목록이 줄어 playAt 이 길이를 넘으면 startIndex prop 이 바뀌고 `PlayOverlay.tsx` 의 R5 효과(`startFrom(startIndex, 0)`)와 시작 장 스크롤 효과가 다시 돈다. 멈춘 상태였어도 마지막 장이 0 부터 재생된다. 새 E4 효과(`:425 ~ 433`)는 playing 을 존중하지만 이 prop 경로가 먼저 돈다. 삭제 메뉴가 오버레이 아래에 있어 지금 UI 로는 재현되지 않고 AC 도 없다.
6. 확인한 규칙 준수: `service_role` 없음. SMP 검사 통과. 순수 레이어 변경 없음(player.ts 는 adapters). 하드코딩 색상 없음(새 값은 전부 tokens.css). E10 은 `src/main.tsx:13` 의 전역 pointerdown resume 이 담당. 토스트 1.6초는 상세(`LickDetail.tsx:137`)와 같다. 02-design.md "레이아웃 티어" 에 `--scrim`, `--scroll-shade`, `--shadow-float`, `close` 아이콘이 기록됐다.

## 실행한 명령과 결과

재평가 (2026-11-11, HEAD `3b1a79c`)
- `bash harness/check.sh`: typecheck, lint, test 71 파일 692개 통과, check-no-smp OK. "통과. .last-check = 3b1a79c".
- `npx vitest run src/adapters/player.test.ts src/community/components/LickCard.test.tsx src/community/components/PlayOverlay.test.tsx src/community/views/Feed.test.tsx --reporter=verbose`: 4 파일 62개 통과 (E4 테스트 1개 추가).
- Playwright `g.mjs` (스크래치 `/private/tmp/claude-501/-Users-randy-claude-code/8f85982f-d5e5-406d-91a3-adb392f2db9a/scratchpad/eval/`): S1 카드 그림자, S14 힌트 기하, S7 탭과 R7 재개, S3 와 S10 스모크. 페이지 오류 0. 출력 `g.out`.
- 증거 폴더 `check.txt` 는 구현자가 `eb3eed9` 에서 남긴 것이다. 그 뒤 커밋 `3b1a79c` 는 스크린샷만 바꿨다.

1차 (2026-11-10, HEAD `c637f2f`)
- `bash harness/check.sh`: 71 파일 691개 통과.
- 같은 vitest 명령: 4 파일 61개 통과.
- Playwright `a.mjs` (S1, S10, S14, S2, S4, S3, S5, S8, S9, S16), `b.mjs` (S6, S7), `c.mjs` (S11, S13, S15), `d.mjs` (S12), `e.mjs` (S8 타이밍), `f.mjs` (Space). 출력 `a.out` ~ `f.out`. 페이지 오류 0.

## 실행 조건

- 폰 390x844, DPR 2, isMobile, hasTouch. S12 는 1280x800 DPR 1. Chrome 헤드리스, `--autoplay-policy=no-user-gesture-required`.
- 응답 치환: S9 (`/rest/v1/licks` 배열을 3행으로), S15 (첫 행 blob 과 제목 치환). S11 은 `navigator.share` 제거와 clipboard 권한. 운영 DB 에는 아무것도 쓰지 않았다.
- 힌트는 S14 외에는 `swipe-play-hint = 1` 로 두고 시작했다.
