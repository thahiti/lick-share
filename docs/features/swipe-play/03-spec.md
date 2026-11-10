# swipe-play: 카드 재생 버튼으로 여는 전체 화면 넘기기 재생 명세

작성일: 2026-11-10. 모델: fable. 상태: 승인됨. 재승인 2026-11-11: R3, R6, R15 (평가자 발견 반영).
이 문서가 구현과 검증의 유일한 기준이다. 기획서 `01-plan.md` 와 디자인 `02-design.md` 는 참고 자료다.

## 입력과 출력

입력:
- 목록 행 `LickRow[]` (id, title, blob, author_id, canonical_id, tags, created_at, profiles). FeedList 가 이미 받아 둔 것.
- 좋아요 수 `Map<string, number>` (키는 `likeTargetId`). FeedList 의 counts.
- `loadMore(): Promise<boolean>` 와 `hasMore: boolean`. FeedList 의 것.
- 시작 인덱스(누른 카드의 위치), 출처 라벨, `Player`, `User | null`.

출력:
- 소리. `player.play(song, { melody: true, accomp: true, metro: true }, 0, total, { gapBeats: 4 })`.
- 화면. 전체 화면 오버레이 한 장(`role="dialog"`, `aria-modal="true"`).
- 부수 효과. history 항목 하나(pushState). 좋아요 추가와 제거(기존 API). localStorage 키 `swipe-play-hint` 값 `1`.

DB 스키마와 `src/community/api/` 변경은 없다.

레이어:
- `src/adapters/player.ts`: 반복 간격(`LoopGap`)과 `onGap` 구독. 순수 규칙은 그대로다(시계와 싱크는 포트).
- `src/community/components/PlayOverlay.tsx`: 오버레이. 페이저, 재생 상태, 카운트다운, 액션, 키보드, history.
- `src/community/components/LickCard.tsx`: `onPlay` prop 과 재생 버튼.
- `src/community/views/Feed.tsx`: 열림 상태, 카드에 `onPlay` 전달, 오버레이 마운트, 좋아요 수 반영. `Feed` 는 `player` 와 `user` prop 을 새로 받는다.
- `src/community/Root.tsx`, `views/UserPage.tsx`, `views/MyLicks.tsx`: `player` 와 `user` 를 Feed 에 넘긴다. UserPage 는 `user` prop 을 새로 받는다.
- `src/community/community.css`: `.c-card-play`, `.c-play*` 스타일. 색은 tokens.css 토큰만.
- 검색 결과(`SearchResults.tsx`)는 `onPlay` 를 넘기지 않는다.

## 규칙

R1. 반복 간격 (player).
    `play` 의 다섯째 인자 `loop` 는 `boolean | LoopGap` 이고 `LoopGap` 은 `{ gapBeats: number }` 다.
    `LoopGap` 이면 진행 스텝이 toStep 에 닿을 때 정지하지 않고 간격에 들어간다.
    간격 길이는 `gapBeats x 4 x secPerStep(tempo)` 초다. 간격 동안 소리를 새로 스케줄하지 않고 onTick 을 부르지 않는다.
    간격이 끝나면 fromStep 부터 다시 스케줄하고 onEnded 를 부르지 않는다. 간격 중에도 `isPlaying()` 은 true 다.
    `loop === true` 와 `setLoop(boolean)` 의 동작은 지금과 같다(즉시 되감기).
R2. 간격 진행 알림 (player).
    `onGap(cb: (beatsLeft: number | null) => void): () => void`.
    간격에 들어갈 때 `gapBeats` 를, 남은 박 수가 줄 때마다 그 값을(4, 3, 2, 1), 간격이 끝나 다시 재생할 때 `null` 을 부른다.
    남은 박 수는 `ceil((간격 종료 시각 - 지금) / 박 길이)` 다. 같은 값은 한 번만 부른다.
    간격 중 `stop()` 이나 새 `play()` 가 오면 `null` 을 부르고 간격을 버린다. 이때 onEnded 는 기존대로 불린다.
R3. 카드 재생 버튼.
    `LickCard` 는 `onPlay?: () => void` 를 받는다. 있으면 `.c-cardhit` 버튼의 형제로 `<button type="button" class="c-card-play" aria-label="Play">` 를 그린다. 없으면 그리지 않는다.
    버튼은 44px 원형, 배경 `--brand-primary`, 아이콘 `play`, 악보 영역 오른쪽 아래에 겹친다. 누르면 `onPlay` 만 부르고 상세로 가지 않는다.
    blob 을 읽을 수 없는 카드에는 `onPlay` 가 있어도 그리지 않는다. 열어도 재생할 것이 없다 (재승인 2026-11-11).
R4. 열기와 닫기.
    FeedList 는 `playAt: number | null` 을 둔다. 카드의 `onPlay` 는 그 카드의 인덱스로 연다. 이미 열려 있으면 무시한다.
    오버레이는 마운트 때 `history.pushState({ swipePlay: true }, '')` 를 한 번 하고 `popstate` 를 구독한다. popstate 가 오면 닫는다.
    닫기 버튼과 Esc 는 `history.back()` 을 부른다(그 결과 popstate 로 닫힌다). 데스크톱의 스크림 클릭도 같다.
    닫힐 때 `player.stop()` 을 부르고 구독을 전부 해제한다. FeedList 는 `playAt` 을 null 로 바꾸고 목록과 스크롤 위치를 건드리지 않는다.
R5. 즉시 재생.
    열리면 시작 인덱스의 곡을 0 스텝부터 `{ melody: true, accomp: true, metro: true }` 와 `{ gapBeats: 4 }` 로 재생한다. 템포는 곡의 템포다.
    재생 의도 `playing` 은 열릴 때 true 다.
R6. 페이저와 현재 장.
    페이저는 세로 `scroll-snap-type: y mandatory` 컨테이너이고 장마다 `scroll-snap-align: start`, 높이는 컨테이너와 같다.
    현재 인덱스는 IntersectionObserver(임계값 0.6)로 60% 이상 보인 상태가 120ms 유지된 장으로 정한다.
    한 번에 두 장을 넘길 때 지나가는 중간 장이 잠깐 재생되지 않게 하기 위해서다 (재승인 2026-11-11). 현재 인덱스가 바뀌면:
    - `playing` 이 true 면 그 곡을 0 스텝부터 R5 처럼 재생한다(앞 곡은 새 play 가 멈춘다).
    - `playing` 이 false 면 재생하지 않고 멈춤 표시를 보인다.
    보였다가 60% 전에 지나간 장은 현재가 되지 않으므로 재생되지 않는다.
R7. 멈춤과 재개.
    현재 장의 악보 영역을 누르면 `playing` 을 뒤집는다.
    true 에서 false: `player.stop()`. 마지막 onTick 값을 `lastEl` 로 둔다. 플레이헤드는 `lastEl` 자리에 남는다.
    false 에서 true: `floor(lastEl)` 부터 R5 와 같은 옵션으로 재생한다. `lastEl` 이 없거나 `total` 이상이면 0 부터다.
    카운트다운 중(간격 중) 누르면 stop 이고 `lastEl` 은 `total` 로 둔다(재개는 0 부터).
    악보의 음표 탭은 오버레이에서 멈춤과 재개와 같다. 음표부터 재생하는 기능은 없다.
R8. 플레이헤드와 카운트다운.
    onTick 값은 현재 장의 Score 에 `playheadStep` 으로 넘긴다. 다른 장에는 넘기지 않는다.
    onGap 값이 숫자면 현재 장 악보 위에 그 숫자와 "Again in" 캡션, 점 4개(지난 박만 채움)를 그리고 악보를 흐리게 한다. null 이면 지운다.
R9. 미리 불러오기와 끝.
    현재 인덱스가 `licks.length - 2` 이상이고 `hasMore` 면 `loadMore()` 를 부른다. 진행 중이면 다시 부르지 않는다.
    `hasMore` 가 false 인 마지막 장에는 태그 아래에 "This is the last lick in {출처}" 를 보인다. 실패하면 "Couldn't load more" 와 Retry 버튼을 보이고 Retry 는 `loadMore()` 를 다시 부른다.
R10. 힌트.
    localStorage `swipe-play-hint` 가 `1` 이 아니면 열릴 때 "Swipe up for the next lick" 알약을 액션 행 위에 보인다.
    현재 인덱스가 처음 바뀌면 숨기고 `1` 을 저장한다. 읽기와 쓰기 실패는 무시한다(힌트를 보인다).
R11. 액션.
    좋아요는 상세와 같은 규칙이다. 대상은 `likeTargetId(lick)`. 비로그인은 "Sign in to like" 토스트. 로그인은 낙관적 토글과 단일 요청 가드, 실패 시 되돌림과 "Like failed" 토스트.
    열릴 때 `fetchMyLikedSet(user.id)` 를 한 번 받아 눌림 상태를 정한다(비로그인은 빈 집합).
    토글 결과는 `onCount(targetId, count)` 로 FeedList 에 알리고 FeedList 는 counts 를 갱신한다.
    공유는 상세와 같다(`/s/:id`, `navigator.share` 가 있으면 그것, 아니면 클립보드와 "Link copied" 토스트).
    복제 편집은 `player.stop()`, popstate 구독 해제, `history.replaceState(null, '', '/edit#' + blob)`, `popstate` 이벤트 발송 순서다. 오버레이 항목이 편집 항목으로 바뀌어 편집의 Back 이 목록으로 돌아온다.
R12. 표시만.
    작성자 이름과 태그는 글자로만 그린다. 링크나 버튼이 아니다.
R13. 키보드와 데스크톱.
    열리면 닫기 버튼에 포커스를 둔다. Esc 는 닫기(R4), ArrowDown 과 ArrowUp 은 페이저를 장 높이만큼 아래와 위로 스크롤(`scrollBy`, smooth), Space 는 R7 의 토글이다. 입력 필드가 없으므로 전부 오버레이 루트에서 받는다.
    1024px 이상에서는 스크림(`rgba(17, 17, 17, 0.55)`) 위 가운데 680px 열, 최대 높이 92dvh, 힌트 대신 스크림 아래에 "Up and Down keys move between licks. Esc closes." 를 보인다.
R14. 출처 라벨.
    Latest 는 "Latest", 태그 피드는 "#" 과 태그, 작성자 피드(유저 페이지, 내 릭)는 첫 행의 `profiles.display_name`, 없으면 "Licks".
R15. 긴 릭.
    장의 본문(`.c-play-body`)은 `overflow-y: auto` 다. 악보 프레임이 본문보다 길면 본문 안에서 스크롤되고 액션 행은 장 하단에 남는다.
    본문이 넘치고 아직 끝까지 내리지 않았을 때만 프레임 아래쪽 그늘과 "Scroll for the rest of the score" 캡션을 보인다(`scrollHeight - clientHeight - scrollTop > 2` 로 판정). 끝까지 내리면 지운다 (재승인 2026-11-11).
R16. 장의 구성.
    위에서 아래로 악보 프레임(Score, mode view, 폭은 실측), 제목(17px 600), 작성자와 날짜(11px mut2), 태그 칩, (R9 의 끝 캡션), 액션 행(Duplicate and edit, 좋아요 수, Share).
    상단 바는 페이저 밖에 하나다: 닫기 버튼(34px 원형), "{현재 인덱스 + 1} / {licks.length}" 카운터, 출처 라벨.

## 엣지케이스

E1. blob 을 `decodeSong` 이 못 읽는 장은 악보 자리에 "Couldn't read this score" 를 보이고 재생하지 않는다. 넘기면 다음 장은 정상이다. 현재 장이 그 장이면 `playing` 과 무관하게 소리가 없다.
E2. `loadMore` 실패는 R9 의 Retry 다. 실패해도 이미 받은 장은 그대로 넘길 수 있다.
E3. 두 장을 빠르게 지나가면 중간 장은 60% 를 채우지 못해 현재가 되지 않는다. 현재가 바뀔 때만 play 를 부르므로 지나간 장의 소리는 나지 않는다.
E4. 열려 있는 동안 목록이 바뀌어(내 릭 삭제) 현재 인덱스가 길이 이상이 되면 마지막 장으로 맞춘다. 목록이 비면 닫는다.
E5. 카드 재생 버튼을 연타해도 오버레이는 하나다(R4).
E6. 오버레이가 열린 채 라우트가 바뀌면(복제 편집) FeedList 가 언마운트되고 오버레이의 정리(R4)가 돈다. 소리는 멈춘다.
E7. 간격 중 넘기면 새 play 가 간격을 버리고(R2 의 null) 다음 곡이 바로 난다.
E8. 로그아웃 상태에서 좋아요는 토스트만 띄우고 상태를 바꾸지 않는다. 열려 있는 동안 로그인 상태가 바뀌면 다음 토글부터 반영한다.
E9. 화면 회전이나 리사이즈는 장 높이와 악보 폭을 다시 잰다(CSS 100% 와 useElementWidth). 재생은 이어진다.
E10. 오디오 컨텍스트가 suspended 면 카드 버튼 탭(pointerdown)이 먼저 resume 한다. 간격 뒤 재시작은 제스처가 필요 없다.
E11. 템포 60 의 4박 간격은 4초다. 카운트다운은 1초마다 4, 3, 2, 1 이다.
E12. 뒤로 가기로 닫은 뒤 다시 열면 history 항목이 새로 하나 생긴다. 누적되지 않는다.

## 시나리오 기준 (S-n)

`.claude/skills/verify/SKILL.md` 방식으로 개발 서버(5199)에서 Playwright 로 실행한다. 데이터는 운영 DB 의 Latest 피드다.
S9 와 S15 는 Playwright `page.route` 로 피드 응답을 바꿔 확인한다(S9 는 행 3개로 잘라 마지막 장을 만들고, S15 는 첫 행 blob 을 8마디 해시로 바꾼다). 운영 DB 에는 아무것도 넣지 않는다.
폰 폭은 390x844, 데스크톱은 1280x800.

S1. Given Latest 가 열려 있다. When 첫 카드의 `.c-card-play` 를 누른다. Then `.c-play[role=dialog]` 가 보이고 1초 안에 `[data-playhead]` 가 있으며, 제목, 작성자, 태그, 좋아요 버튼, Share, Duplicate and edit 가 보인다. 카드 본문(`.c-cardhit`)을 누르면 `/lick/:id` 로 간다. 증거: `s1-card.png`, `s1-open.png`.
S2. Given S1 상태. When 현재 장의 악보를 누른다. Then 플레이헤드가 멈춰 있고(두 번 캡처한 x 가 같다) 멈춤 표시가 보인다. 다시 누르면 플레이헤드가 그 x 보다 오른쪽에서 다시 움직인다. 증거: `s2-paused.png`, `s2-resumed.png`.
S3. Given S1 상태(재생 중). When 페이저를 한 장 아래로 스크롤해 멈춘다. Then 카운터가 "2 / N" 이고 1초 안에 둘째 장에 `[data-playhead]` 가 있고 첫 장에는 없다. 증거: `s3-next.png`.
S4. Given S2 의 멈춤 상태. When 한 장 넘긴다. Then 둘째 장에 멈춤 표시가 있고 `[data-playhead]` 가 없다. 증거: `s4-paused-next.png`.
S5. Given S3 상태. When 한 장 위로 넘긴다. Then 카운터가 "1 / N" 이고 첫 장에 플레이헤드가 처음 근처에서 움직인다. 증거: `s5-prev.png`.
S6. Given S1 상태. When 곡 길이(`total x secPerStep`)만큼 기다린다. Then 카운트다운 숫자와 "Again in" 이 보이고, 4박이 더 지나면 숫자가 사라지고 플레이헤드가 처음부터 다시 움직인다. 증거: `s6-countdown.png`, `s6-restart.png`.
S7. Given S6 의 카운트다운 중. When 한 장 넘긴다. Then 카운트다운이 없고 둘째 장에 플레이헤드가 있다. 다시 S6 상태를 만들어 악보를 누르면 카운트다운이 사라지고 멈춤 표시가 보인다. 증거: `s7-swipe.png`, `s7-tap.png`.
S8. Given S1 상태. When 두 장을 300ms 안에 연달아 넘긴다. Then 카운터가 "3 / N" 이고 셋째 장에만 플레이헤드가 있다. 증거: `s8-fast.png`.
S9. Given 피드 응답을 3행으로 바꿔 S1 을 연다. When 셋째 장까지 넘긴다. Then "This is the last lick in Latest" 가 보이고 더 넘겨도 카운터가 "3 / 3" 이다. 증거: `s9-end.png`.
S10. Given Latest 를 두 페이지 스크롤해 둔 상태에서 보이는 카드로 S1 을 연다. When 닫기 버튼을 누른다. Then 오버레이가 사라지고 `window.scrollY` 가 열기 전과 같고 피드 요청(`/rest/v1/licks`)이 추가로 가지 않았다. 브라우저 뒤로 가기로 닫아도 같다. 증거: `s10-closed.png`.
S11. Given 비로그인으로 S1 상태. When 좋아요 버튼을 누른다. Then "Sign in to like" 토스트가 보이고 수가 그대로다. Share 를 누르면 클립보드에 `/s/:id` 가 들어가고 "Link copied" 토스트가 보인다. Duplicate and edit 를 누르면 `/edit#v2` 로 가고 편집의 Back 을 누르면 Latest 가 보인다. 증거: `s11-like.png`, `s11-share.png`, `s11-edit.png`.
S12. Given 1280px 에서 Latest. When 카드 재생 버튼을 누른다. Then 스크림 위 가운데 열(폭 680px)로 열리고 아래에 키 안내가 보인다. ArrowDown 으로 카운터가 "2 / N" 이 되고 Esc 로 닫힌다. 증거: `s12-desktop.png`.
S13. Given `/tag/jazz`. When 첫 카드의 재생 버튼을 누른다. Then 출처 라벨이 "#jazz" 이고 넘기면 그 목록의 둘째 릭이 나온다. 증거: `s13-tag.png`.
S14. Given localStorage 를 비우고 S1 을 연다. Then 힌트 알약이 보인다. When 한 장 넘긴다. Then 힌트가 사라지고, 닫고 다시 열어도 힌트가 없다. 증거: `s14-hint.png`.
S15. Given 첫 행 blob 을 8마디 해시로 바꿔 S1 을 연다. Then 본문이 스크롤 가능하고(`scrollHeight > clientHeight`) 캡션 "Scroll for the rest of the score" 가 보이며 액션 행은 화면 하단에 있다. 본문을 끝까지 내린 뒤 한 장 더 넘기면 둘째 장이 된다. 증거: `s15-long.png`.
S16. Given S1 상태. When 작성자 이름과 태그를 누른다. Then URL 이 바뀌지 않고 오버레이가 그대로다. 증거: `s16-static.png`.

## 단위 기준 (AC-n)

player (`src/adapters/player.test.ts`, FakeClock 과 FakeAudioSink):
AC-1. Given `play(demoSong, opts, 0, 16, { gapBeats: 4 })`. When 시각이 toStep 을 지난다. Then isPlaying 이 true 이고 onEnded 가 안 불리고 melody 이벤트가 새로 스케줄되지 않는다. 4박(16 x SPS)이 더 지나면 t=0 부터 melody 가 다시 스케줄된다.
AC-2. Given AC-1. Then onGap 이 4, 3, 2, 1, null 순서로 각각 한 번씩 불린다.
AC-3. Given 간격 중. When `stop()`. Then onGap(null) 과 onEnded 가 불리고 4박 뒤에도 재스케줄이 없다. 새 `play()` 도 같다(null 뒤 새 곡 이벤트).
AC-4. `loop=true` 와 `setLoop(false)` 의 기존 테스트가 그대로 통과한다. `onTick` 은 간격 중 불리지 않는다.

LickCard (`src/community/components/LickCard.test.tsx`, 새 파일):
AC-5. Given `onPlay` 가 있다. Then `[aria-label="Play"]` 가 있고 누르면 onPlay 가 한 번 불리며 `navigate` 는 불리지 않는다.
AC-6. Given `onPlay` 가 없다. Then 재생 버튼이 없다.

PlayOverlay (`src/community/components/PlayOverlay.test.tsx`, 새 파일. player 는 FakeClock 과 FakeAudioSink 로 만든 실제 player, IntersectionObserver 는 콜백을 꺼내 수동으로 부른다):
AC-7. Given 행 3개와 startIndex 1 로 마운트. Then `pushState` 가 한 번 불리고 player 가 둘째 곡을 재생 중이며(sink 에 melody 이벤트, t=0) 카운터가 "2 / 3" 이다.
AC-8. Given AC-7. When 악보를 클릭. Then isPlaying 이 false 다. 다시 클릭하면 마지막 tick 의 floor 스텝부터 재생한다(sink 첫 melody 이벤트의 t 가 그 스텝에 맞다).
AC-9. Given 재생 중. When IO 콜백으로 셋째 장이 60% 보인다. Then 셋째 곡이 0 부터 재생된다. 멈춘 상태에서 같은 일을 하면 play 가 불리지 않는다.
AC-10. Given 행 3개, hasMore true, 현재 인덱스 0. When 현재 인덱스가 1 이 된다. Then loadMore 가 한 번 불린다. 해결 전에 인덱스가 2 가 돼도 다시 불리지 않는다.
AC-11. When `popstate` 이벤트. Then onClose 가 불리고 isPlaying 이 false 다. 닫기 버튼 클릭은 `history.back` 을 부른다.
AC-12. When Esc. Then `history.back`. When ArrowDown. Then 페이저 `scrollBy` 가 장 높이만큼 불린다. When Space. Then AC-8 의 토글.
AC-13. Given localStorage 가 비었다. Then 힌트가 보인다. When 현재 인덱스가 바뀐다. Then 힌트가 사라지고 `swipe-play-hint` 가 `1` 이다. 처음부터 `1` 이면 힌트가 없다.
AC-14. Given user 가 null. When 좋아요 클릭. Then "Sign in to like" 토스트, addLike 안 불림. Given user 있음. Then addLike 가 대상 id 로 불리고 onCount 가 (대상 id, 기존 수 + 1) 로 불린다. 실패하면 되돌리고 "Like failed".
AC-15. When Duplicate and edit 클릭. Then isPlaying 이 false, `replaceState` 가 `/edit#` + blob 으로 불리고 `pushState` 는 더 불리지 않는다.
AC-16. When onGap(3) 이 전달된다. Then 현재 장에 "3" 과 "Again in" 이 보인다. onGap(null) 이면 사라진다.
AC-17. 출처 라벨: 태그 피드는 "#jazz", 작성자 피드는 첫 행의 display_name, Latest 는 "Latest".
AC-18. Given 둘째 행 blob 이 깨졌다. When 둘째 장이 현재가 된다. Then "Couldn't read this score" 가 보이고 play 가 불리지 않는다(sink 에 새 이벤트 없음).

Feed (`src/community/views/Feed.test.tsx`, 기존 mock 패턴):
AC-19. When 카드의 재생 버튼을 누른다. Then `.c-play` 가 마운트되고 startIndex 가 그 카드다. 오버레이가 onCount 를 부르면 그 카드의 좋아요 수가 바뀐다. onClose 뒤 `.c-play` 가 없고 목록 DOM 은 그대로다(같은 요소 참조).

## 구현 태스크

| id | 동작 | 포함 AC | 처음 동작시키는 S | 완료 조건 |
|---|---|---|---|---|
| T1 | player 반복 간격과 onGap | AC-1, AC-2, AC-3, AC-4 | 없음(S6 의 바탕) | 단위 테스트 통과, 골든 스냅샷 변화 없음 |
| T2 | 카드 재생 버튼 | AC-5, AC-6 | S1 앞부분(버튼 표시) | 단위 테스트, `s1-card.png` |
| T3 | 오버레이 열기, 즉시 재생, 닫기, history | AC-7, AC-11, AC-19 | S1, S10 | 단위 테스트, `s1-open.png`, `s10-closed.png` |
| T4 | 멈춤과 재개, 현재 장 판정과 재생 전환, 미리 불러오기, 끝 표시, 힌트 | AC-8, AC-9, AC-10, AC-13, AC-18 | S2, S3, S4, S5, S8, S9, S14 | 단위 테스트, 해당 스크린샷 |
| T5 | 카운트다운 표시 | AC-16 | S6, S7 | 단위 테스트, `s6-*.png`, `s7-*.png` |
| T6 | 좋아요, 공유, 복제 편집, 표시만 | AC-14, AC-15 | S11, S16 | 단위 테스트, `s11-*.png`, `s16-static.png` |
| T7 | 키보드, 데스크톱 레이아웃, 출처 라벨, 태그와 유저 피드 연결 | AC-12, AC-17 | S12, S13 | 단위 테스트, `s12-desktop.png`, `s13-tag.png` |
| T8 | 긴 릭 본문 스크롤과 캡션 | 없음(CSS 와 판정) | S15 | `s15-long.png` |
| T9 | `docs/product/SPEC.md` 4절에 넘기기 재생 절 추가, PROGRESS 갱신 | 없음 | 없음 | 문서 커밋 |

## 테스트 목록

| id | 종류 | 파일 |
|---|---|---|
| S1~S16 | 시나리오 | Playwright 스크립트(스크래치패드), 증거 `harness/evidence/swipe-play/s*.png` |
| AC-1~AC-4 | 단위 | `src/adapters/player.test.ts` |
| AC-5, AC-6 | 단위 | `src/community/components/LickCard.test.tsx` |
| AC-7~AC-16, AC-18 | 단위 | `src/community/components/PlayOverlay.test.tsx` |
| AC-17, AC-19 | 단위 | `src/community/views/Feed.test.tsx` |

## 검증 증거

verify 단계에서 `harness/evidence/swipe-play/` 에 남길 것.
- `check.txt`: `harness/check.sh` 출력.
- 시나리오별 스크린샷. 파일명은 시나리오 기준에 적은 대로.
- `verdict.md`: 시나리오별 PASS 와 실행 조건(뷰포트, 응답 치환 여부).

## 제품 명세와 다른 점

- `docs/product/SPEC.md` 4절의 "음표 탭 = 그 위치부터 재생" 은 오버레이에 적용하지 않는다(R7). 탐색 장면에서는 멈춤과 재개가 더 자주 필요하고, 음표부터 재생은 상세에 남는다.
- 반복은 SPEC 에 없던 간격 있는 반복이다(R1). 상세의 Loop 토글은 기존 즉시 되감기를 유지한다.
